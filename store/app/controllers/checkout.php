<?php
/** Cart, checkout, payments and the customer's order page. */

function cart_page(): void
{
    $lines = cart_lines();
    render('cart', ['lines' => $lines, 'totals' => cart_totals($lines), 'meta' => ['title' => 'Your cart', 'robots' => 'noindex']]);
}

function cart_add_action(): void
{
    $p = product_by_id((int)($_POST['product_id'] ?? 0));
    if (!$p || !$p['visible'] || !can_buy($p)) {
        flash('error', 'Sorry, that product cannot be ordered online right now. Please request a quote.');
        back('/shop');
    }
    $qty = max(1, min(999, (int)($_POST['qty'] ?? 1)));
    cart_add((int)$p['id'], $qty);
    flash('success', $p['name'] . ' added to your cart.');
    if (!empty($_POST['buy_now'])) {
        redirect('/checkout');
    }
    back('/cart');
}

function cart_update_action(): void
{
    foreach ((array)($_POST['qty'] ?? []) as $id => $qty) {
        cart_set((int)$id, max(0, min(999, (int)$qty)));
    }
    if (!empty($_POST['remove'])) {
        cart_set((int)$_POST['remove'], 0);
    }
    redirect('/cart');
}

function payment_methods(): array
{
    $m = [];
    if (setting('payfast_enabled') === '1' && setting('payfast_merchant_id') && setting('payfast_merchant_key')) {
        $m['payfast'] = ['PayFast — card, Instant EFT, SnapScan & more', 'Pay securely now. Your order is confirmed immediately.'];
    }
    if (setting('eft_enabled') === '1') {
        $m['eft'] = ['Manual bank EFT', 'Pay into our bank account and upload your proof of payment. We dispatch once payment reflects (1–2 working days).'];
    }
    return $m;
}

function checkout_page(): void
{
    $lines = cart_lines();
    if (!$lines) {
        flash('info', 'Your cart is empty.');
        redirect('/cart');
    }
    $methods = payment_methods();
    $errors = [];
    if (is_post()) {
        $d = [];
        foreach (['customer_name', 'email', 'phone', 'company', 'customer_vat', 'address1', 'address2', 'city', 'province', 'postal_code', 'notes'] as $k) {
            $d[$k] = mb_substr(trim((string)($_POST[$k] ?? '')), 0, $k === 'notes' ? 2000 : 190);
        }
        $d['delivery_method'] = ($_POST['delivery_method'] ?? '') === 'collect' && setting('allow_collection') === '1' ? 'collect' : 'courier';
        $d['payment_method'] = array_key_exists($_POST['payment_method'] ?? '', $methods) ? $_POST['payment_method'] : '';
        if ($d['customer_name'] === '') {
            $errors['customer_name'] = 'Please enter your full name.';
        }
        if (!valid_email($d['email'])) {
            $errors['email'] = 'Please enter a valid email address.';
        }
        if (strlen(preg_replace('/\D/', '', $d['phone'])) < 9) {
            $errors['phone'] = 'Please enter a phone number the courier can call.';
        }
        if ($d['delivery_method'] === 'courier') {
            foreach (['address1' => 'street address', 'city' => 'town / city', 'postal_code' => 'postal code'] as $k => $label) {
                if ($d[$k] === '') {
                    $errors[$k] = 'Please enter your ' . $label . '.';
                }
            }
            if (!in_array($d['province'], provinces(), true)) {
                $errors['province'] = 'Please choose your province.';
            }
        }
        if ($d['payment_method'] === '') {
            $errors['payment_method'] = 'Please choose how you want to pay.';
        }
        if (empty($_POST['terms'])) {
            $errors['terms'] = 'Please accept the terms and privacy policy.';
        }
        if (!$errors) {
            $totals = cart_totals($lines, $d['delivery_method']);
            $ref = random_ref('SA');
            while (q_val('SELECT id FROM orders WHERE ref = ?', [$ref])) {
                $ref = random_ref('SA');
            }
            $pdo = db();
            $pdo->beginTransaction();
            $orderId = db_insert('orders', $d + [
                'ref' => $ref, 'token' => bin2hex(random_bytes(20)), 'status' => 'pending_payment', 'payment_status' => 'unpaid',
                'subtotal' => $totals['subtotal'], 'delivery_fee' => $totals['delivery'], 'total' => $totals['total'], 'created_at' => now(), 'updated_at' => now(),
            ]);
            foreach ($lines as $l) {
                db_insert('order_items', ['order_id' => $orderId, 'product_id' => $l['product']['id'], 'sku' => $l['product']['sku'], 'name' => $l['product']['name'], 'price' => $l['price'], 'qty' => $l['qty'], 'line_total' => $l['total']]);
            }
            order_add_history($orderId, 'pending_payment', 'Order placed online (' . ($d['payment_method'] === 'payfast' ? 'PayFast' : 'EFT') . ').');
            $pdo->commit();
            cart_clear();
            $order = q_one('SELECT * FROM orders WHERE id = ?', [$orderId]);
            $_SESSION['my_orders'][$ref] = $order['token'];
            if ($d['payment_method'] === 'eft') {
                order_send_email($orderId, 'placed');
                order_notify_admin($orderId, 'New EFT order');
                redirect(url('order/' . $ref, ['t' => $order['token'], 'new' => 1]));
            }
            order_notify_admin($orderId, 'New order (awaiting PayFast payment)');
            redirect(url('order/' . $ref . '/pay', ['t' => $order['token']]));
        }
        keep_old($_POST);
    }
    render('checkout', [
        'lines' => $lines,
        'totals' => cart_totals($lines, (old('delivery_method') ?: ($_POST['delivery_method'] ?? 'courier')) === 'collect' ? 'collect' : 'courier'),
        'methods' => $methods,
        'errors' => $errors,
        'meta' => ['title' => 'Checkout', 'robots' => 'noindex', 'events' => [['ga' => 'begin_checkout', 'data' => ['currency' => 'ZAR', 'value' => cart_totals($lines)['subtotal']], 'fb' => 'InitiateCheckout']]],
    ]);
}

function load_customer_order(string $ref): array
{
    $token = (string)($_GET['t'] ?? $_POST['t'] ?? ($_SESSION['my_orders'][$ref] ?? ''));
    $o = $token !== '' ? order_by_ref($ref, $token) : null;
    if (!$o) {
        abort(404, 'We could not find that order. Please use the link in your order email.');
    }
    return $o;
}

function order_page(string $ref): void
{
    $o = load_customer_order($ref);
    $events = [];
    if (!empty($_GET['new']) || !empty($_GET['paid'])) {
        $events[] = ['ga' => 'purchase', 'data' => ['transaction_id' => $o['ref'], 'currency' => 'ZAR', 'value' => (float)$o['total']], 'fb' => 'Purchase', 'fbData' => ['currency' => 'ZAR', 'value' => (float)$o['total']]];
    }
    render('order', [
        'o' => $o,
        'items' => order_items((int)$o['id']),
        'history' => q_all('SELECT * FROM order_history WHERE order_id = ? ORDER BY id DESC', [$o['id']]),
        'meta' => ['title' => 'Order ' . $o['ref'], 'robots' => 'noindex', 'events' => $events],
    ]);
}

function order_invoice(string $ref): void
{
    $o = load_customer_order($ref);
    $pdf = invoice_pdf($o, order_items((int)$o['id']));
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="' . ($o['payment_status'] === 'paid' ? 'Receipt-' : 'Invoice-') . $o['ref'] . '.pdf"');
    header('Content-Length: ' . strlen($pdf));
    echo $pdf;
}

function order_pop_upload(string $ref): void
{
    $o = load_customer_order($ref);
    $files = uploaded_files('pop');
    $link = url('order/' . $o['ref'], ['t' => $o['token']]);
    if (!$files) {
        flash('error', 'Please choose your proof of payment file (PDF or photo).');
        redirect($link);
    }
    $res = store_private_file($files[0], 'pop', 8);
    if (isset($res['error'])) {
        flash('error', $res['error']);
        redirect($link);
    }
    db_update('orders', ['pop_path' => $res['name'], 'pop_uploaded_at' => now(), 'status' => $o['payment_status'] === 'paid' ? $o['status'] : 'payment_review', 'updated_at' => now()], 'id = ?', [$o['id']]);
    order_add_history((int)$o['id'], 'payment_review', 'Customer uploaded proof of payment.');
    order_notify_admin((int)$o['id'], 'Proof of payment uploaded');
    flash('success', 'Thank you — we received your proof of payment. We will confirm once the payment reflects.');
    redirect($link);
}

function order_pay(string $ref): void
{
    $o = load_customer_order($ref);
    if ($o['payment_status'] === 'paid') {
        redirect(url('order/' . $o['ref'], ['t' => $o['token']]));
    }
    if (!array_key_exists('payfast', payment_methods())) {
        flash('error', 'Online payment is not available right now. Please pay by EFT.');
        redirect(url('order/' . $o['ref'], ['t' => $o['token']]));
    }
    db_update('orders', ['payment_method' => 'payfast', 'updated_at' => now()], 'id = ?', [$o['id']]);
    render('pay', ['o' => $o, 'fields' => payfast_fields($o), 'action' => 'https://' . payfast_host() . '/eng/process', 'meta' => ['title' => 'Redirecting to PayFast', 'robots' => 'noindex']]);
}

function payfast_return(): void
{
    $o = load_customer_order((string)($_GET['ref'] ?? ''));
    flash('success', 'Thank you! If your payment went through, your order will show as paid within a minute (refresh this page).');
    redirect(url('order/' . $o['ref'], ['t' => $o['token'], 'paid' => 1]));
}

function payfast_cancel(): void
{
    $o = load_customer_order((string)($_GET['ref'] ?? ''));
    flash('info', 'Payment was cancelled. Your order is saved — you can pay with PayFast again or by EFT.');
    redirect(url('order/' . $o['ref'], ['t' => $o['token']]));
}

function payfast_notify(): void
{
    header('HTTP/1.0 200 OK');
    flush();
    $msg = payfast_handle_itn($_POST);
    log_message('payfast', $msg . ' | ' . json_encode(array_intersect_key($_POST, array_flip(['m_payment_id', 'pf_payment_id', 'payment_status', 'amount_gross']))));
}
