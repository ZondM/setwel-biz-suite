<?php
/**
 * PayFast payments (cards, EFT, Instant EFT and more).
 * Docs: https://developers.payfast.co.za/docs
 * Flow: checkout → we post a signed form to PayFast → customer pays → PayFast calls our
 * "notify" URL (ITN) in the background → we verify it and mark the order as paid.
 */

function payfast_host(): string
{
    return setting('payfast_mode') === 'live' ? 'www.payfast.co.za' : 'sandbox.payfast.co.za';
}

/** PayFast signature: fields in order, url-encoded, joined with &, plus passphrase, then MD5. */
function payfast_signature(array $data, string $passphrase = ''): string
{
    $parts = [];
    foreach ($data as $k => $v) {
        if ($k === 'signature' || $v === '' || $v === null) {
            continue;
        }
        $parts[] = $k . '=' . urlencode(trim((string)$v));
    }
    $str = implode('&', $parts);
    if ($passphrase !== '') {
        $str .= '&passphrase=' . urlencode(trim($passphrase));
    }
    return md5($str);
}

/** Fields for the payment form (the order of keys matters for the signature). */
function payfast_fields(array $order): array
{
    $names = preg_split('/\s+/', trim($order['customer_name']), 2);
    $data = [
        'merchant_id' => setting('payfast_merchant_id'),
        'merchant_key' => setting('payfast_merchant_key'),
        'return_url' => abs_url('payfast/return', ['ref' => $order['ref'], 't' => $order['token']]),
        'cancel_url' => abs_url('payfast/cancel', ['ref' => $order['ref'], 't' => $order['token']]),
        'notify_url' => abs_url('payfast/notify'),
        'name_first' => mb_substr($names[0] ?? '', 0, 100),
        'name_last' => mb_substr($names[1] ?? '', 0, 100),
        'email_address' => $order['email'],
        'm_payment_id' => $order['ref'],
        'amount' => number_format((float)$order['total'], 2, '.', ''),
        'item_name' => mb_substr(setting('business_name') . ' order ' . $order['ref'], 0, 100),
    ];
    $data['signature'] = payfast_signature($data, setting('payfast_passphrase'));
    return $data;
}

/** Handle PayFast's background notification (ITN). Returns a short log message. */
function payfast_handle_itn(array $post): string
{
    // 1. Signature
    $sig = $post['signature'] ?? '';
    $check = $post;
    unset($check['signature']);
    // ITN signature uses ALL posted fields (including empty ones) in posted order.
    $parts = [];
    foreach ($check as $k => $v) {
        $parts[] = $k . '=' . urlencode(stripslashes((string)$v));
    }
    $str = implode('&', $parts);
    $pass = setting('payfast_passphrase');
    $withPass = $pass !== '' ? $str . '&passphrase=' . urlencode(trim($pass)) : $str;
    if (!hash_equals(md5($withPass), (string)$sig)) {
        return 'Invalid signature';
    }
    // 2. Request came from PayFast
    if (setting('payfast_check_ip') === '1') {
        $valid = [];
        foreach (['www.payfast.co.za', 'sandbox.payfast.co.za', 'w1w.payfast.co.za', 'w2w.payfast.co.za'] as $h) {
            $valid = array_merge($valid, gethostbynamel($h) ?: []);
        }
        if ($valid && !in_array(client_ip(), $valid, true)) {
            return 'Request not from a PayFast server: ' . client_ip();
        }
    }
    // 3. Order and amount
    $order = q_one('SELECT * FROM orders WHERE ref = ?', [$post['m_payment_id'] ?? '']);
    if (!$order) {
        return 'Unknown order ' . ($post['m_payment_id'] ?? '');
    }
    if (abs((float)$order['total'] - (float)($post['amount_gross'] ?? 0)) > 0.01) {
        return 'Amount mismatch for ' . $order['ref'];
    }
    // 4. Confirm with PayFast's server
    $ch = curl_init('https://' . payfast_host() . '/eng/query/validate');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $str, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20]);
    $resp = (string)curl_exec($ch);
    curl_close($ch);
    if (trim($resp) !== 'VALID') {
        return 'PayFast server did not confirm (' . trim($resp) . ')';
    }
    // 5. Update order
    $status = $post['payment_status'] ?? '';
    if ($status === 'COMPLETE') {
        if ($order['payment_status'] !== 'paid') {
            db_update('orders', ['payment_status' => 'paid', 'status' => 'processing', 'paid_at' => now(), 'pf_payment_id' => $post['pf_payment_id'] ?? '', 'updated_at' => now()], 'id = ?', [$order['id']]);
            order_add_history((int)$order['id'], 'processing', 'Payment received via PayFast (ID ' . ($post['pf_payment_id'] ?? '') . ').');
            order_send_email((int)$order['id'], 'paid');
            order_notify_admin((int)$order['id'], 'Payment received (PayFast)');
        }
        return 'Order ' . $order['ref'] . ' paid';
    }
    if ($status === 'CANCELLED') {
        order_add_history((int)$order['id'], $order['status'], 'PayFast reported the payment as cancelled.');
        return 'Order ' . $order['ref'] . ' cancelled at PayFast';
    }
    return 'Status ' . $status . ' for ' . $order['ref'];
}
