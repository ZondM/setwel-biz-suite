<?php
/**
 * PayFast helper functions — signature generation, ITN verification,
 * and a small flat-file store for pending payments (no database needed).
 *
 * Signature spec: https://developers.payfast.co.za/docs#step_2_signature
 * ITN spec:       https://developers.payfast.co.za/docs#step_3_itn
 */

// Field order matters for signature generation — this must match the order
// PayFast documents, not the order you happen to build the array in.
const PF_FIELD_ORDER = [
    'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
    'name_first', 'name_last', 'email_address', 'cell_number',
    'm_payment_id', 'amount', 'item_name', 'item_description',
    'custom_int1', 'custom_int2', 'custom_int3', 'custom_int4', 'custom_int5',
    'custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
    'email_confirmation', 'confirmation_address',
    'payment_method',
    'subscription_type', 'billing_date', 'recurring_amount', 'frequency', 'cycles',
];

/**
 * Build the MD5 signature PayFast expects. Must be called with the SAME
 * field set (minus 'signature' itself) that gets submitted or that PayFast
 * posted back to the ITN handler.
 */
function pf_generate_signature(array $data, string $passphrase = ''): string
{
    $pairs = [];
    foreach (PF_FIELD_ORDER as $key) {
        if (isset($data[$key]) && $data[$key] !== '') {
            $pairs[] = $key . '=' . urlencode(trim((string)$data[$key]));
        }
    }
    $paramString = implode('&', $pairs);
    if ($passphrase !== '') {
        $paramString .= '&passphrase=' . urlencode(trim($passphrase));
    }
    return md5($paramString);
}

/**
 * Signature for an incoming ITN. Different from the checkout signature: PayFast
 * signs every posted field in the order it was sent (blank ones included),
 * up to the signature field. This follows PayFast's own ITN sample code.
 * https://developers.payfast.co.za/docs#step_4_confirm_payment
 */
function pf_itn_signature(array $post, string $passphrase = ''): string
{
    $pairs = [];
    foreach ($post as $key => $val) {
        if ($key === 'signature') break;
        $pairs[] = $key . '=' . urlencode(stripslashes((string)$val));
    }
    $paramString = implode('&', $pairs);
    if ($passphrase !== '') {
        $paramString .= '&passphrase=' . urlencode(trim($passphrase));
    }
    return md5($paramString);
}

/**
 * PayFast recommends confirming the source of an ITN by reverse-DNS-resolving
 * the caller's IP and checking it belongs to payfast.co.za, rather than
 * trusting a hardcoded IP list (which changes over time).
 */
function pf_valid_source_ip(string $ip): bool
{
    if ($ip === '') return false;
    $host = gethostbyaddr($ip);
    if ($host === false || $host === $ip) return false;
    return (bool)preg_match('/\.payfast\.co\.za$/i', rtrim($host, '.'));
}

/**
 * PayFast's documented server-to-server check: POST the exact ITN data back
 * to PayFast and confirm it replies "VALID". This catches spoofed requests
 * that pass signature + IP checks (e.g. a replayed old ITN).
 */
function pf_server_validate(array $postData, bool $sandbox): bool
{
    $host = $sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';
    $url  = 'https://' . $host . '/eng/query/validate';

    $body = http_build_query($postData);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
    ]);
    $response = curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        pf_log('pf_server_validate curl error: ' . $error, $postData);
        return false;
    }
    return trim($response) === 'VALID';
}

function pf_data_dir(): string
{
    $dir = __DIR__ . '/../data';
    if (!is_dir($dir)) mkdir($dir, 0750, true);
    return $dir;
}

/** Record what we expect to be charged for a payment ID, before redirecting to PayFast. */
function pf_store_pending_payment(string $paymentId, array $details): void
{
    $file = pf_data_dir() . '/pending-payments.json';
    $fh = fopen($file, 'c+');
    if (!$fh) return;
    flock($fh, LOCK_EX);
    $size = filesize($file);
    $all = $size > 0 ? json_decode(fread($fh, $size), true) : [];
    if (!is_array($all)) $all = [];
    $all[$paymentId] = $details;
    // Keep the file from growing forever — drop anything older than 90 days.
    $cutoff = time() - 90 * 86400;
    foreach ($all as $id => $d) {
        if (!empty($d['created_at']) && strtotime($d['created_at']) < $cutoff) {
            unset($all[$id]);
        }
    }
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($all, JSON_PRETTY_PRINT));
    flock($fh, LOCK_UN);
    fclose($fh);
}

function pf_get_pending_payment(string $paymentId): ?array
{
    $file = pf_data_dir() . '/pending-payments.json';
    if (!file_exists($file)) return null;
    $all = json_decode(file_get_contents($file), true);
    return is_array($all) && isset($all[$paymentId]) ? $all[$paymentId] : null;
}

function pf_mark_payment_complete(string $paymentId, array $itnData): void
{
    $file = pf_data_dir() . '/completed-payments.json';
    $fh = fopen($file, 'c+');
    if (!$fh) return;
    flock($fh, LOCK_EX);
    $size = filesize($file);
    $all = $size > 0 ? json_decode(fread($fh, $size), true) : [];
    if (!is_array($all)) $all = [];
    $all[$paymentId] = [
        'completed_at' => date('c'),
        'amount_gross' => $itnData['amount_gross'] ?? null,
        'payment_status' => $itnData['payment_status'] ?? null,
        'pf_payment_id' => $itnData['pf_payment_id'] ?? null,
    ];
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($all, JSON_PRETTY_PRINT));
    flock($fh, LOCK_UN);
    fclose($fh);
}

function pf_log(string $message, array $context = []): void
{
    $line = date('c') . ' ' . $message . ' ' . json_encode($context) . "\n";
    file_put_contents(pf_data_dir() . '/payfast.log', $line, FILE_APPEND | LOCK_EX);
}

function pf_notify_team(?array $order, array $itnData): void
{
    if (!defined('NOTIFY_EMAIL') || NOTIFY_EMAIL === '') return;
    $plan = $order['plan'] ?? 'Unknown plan';
    $name = $order['name'] ?? 'Unknown';
    $email = $order['email'] ?? 'unknown';
    $phone = $order['phone'] ?? 'unknown';
    $amount = $itnData['amount_gross'] ?? ($order['amount'] ?? '?');
    $subject = 'Payment received: ' . $plan . ' — R' . $amount;
    $body = "A payment has been confirmed by PayFast.\n\n"
        . "Plan: {$plan}\n"
        . "Amount: R{$amount}\n"
        . "Customer: {$name}\n"
        . "Email: {$email}\n"
        . "Phone: {$phone}\n"
        . "PayFast payment ID: " . ($itnData['pf_payment_id'] ?? '?') . "\n"
        . "Our payment ID: " . ($itnData['m_payment_id'] ?? '?') . "\n\n"
        . "The licence key was created and emailed to the customer automatically.";
    @mail(NOTIFY_EMAIL, $subject, $body, 'From: no-reply@setwelbusiness.co.za');
}

/**
 * Sign a PayFast payment data array and output the auto-submitting redirect
 * page that sends the browser on to PayFast's hosted checkout. Used by
 * create-payment.php. The free trial happens inside the app, so customers
 * only reach PayFast when they choose to pay.
 */
function pf_redirect_to_payfast(array $data, string $passphrase, bool $sandbox): void
{
    $data['signature'] = pf_generate_signature($data, $passphrase);
    $action = $sandbox
        ? 'https://sandbox.payfast.co.za/eng/process'
        : 'https://www.payfast.co.za/eng/process';
    ?>
<!DOCTYPE html>
<html lang="en-ZA">
<head>
<meta charset="UTF-8">
<title>Redirecting to secure payment…</title>
<style>
body{font-family:Inter,system-ui,sans-serif;background:#0A0808;color:#F2EDE8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}
.box{padding:24px}
p{color:#A09088}
</style>
</head>
<body>
<div class="box">
<p>Redirecting you to PayFast's secure payment page&hellip;</p>
<noscript><p>JavaScript is required. <a href="#" onclick="document.getElementById('pf-form').submit();return false;" style="color:#E8801A">Click here to continue</a>.</p></noscript>
</div>
<form id="pf-form" action="<?= htmlspecialchars($action, ENT_QUOTES) ?>" method="POST">
<?php foreach ($data as $k => $v): ?>
<input type="hidden" name="<?= htmlspecialchars($k, ENT_QUOTES) ?>" value="<?= htmlspecialchars($v, ENT_QUOTES) ?>">
<?php endforeach; ?>
</form>
<script>document.getElementById('pf-form').submit();</script>
</body>
</html>
<?php
    exit;
}

/**
 * Skip upcoming charges on a PayFast subscription (used for referral free months).
 * PayFast API: PUT /subscriptions/{token}/pause. Returns true only if PayFast confirms.
 * https://developers.payfast.co.za/api#pause-a-subscription
 */
function pf_pause_subscription(string $token, int $cycles = 1): bool
{
    $headers = [
        'merchant-id' => PAYFAST_MERCHANT_ID,
        'version' => 'v1',
        'timestamp' => date('c'),
    ];
    $body = ['cycles' => (string)$cycles];

    $sig = $headers + $body;
    if (PAYFAST_PASSPHRASE !== '') $sig['passphrase'] = PAYFAST_PASSPHRASE;
    ksort($sig);
    $pairs = [];
    foreach ($sig as $k => $v) $pairs[] = $k . '=' . urlencode(trim($v));
    $headers['signature'] = md5(implode('&', $pairs));

    $url = 'https://api.payfast.co.za/subscriptions/' . rawurlencode($token) . '/pause' . (PAYFAST_SANDBOX ? '?testing=true' : '');
    $h = [];
    foreach ($headers as $k => $v) $h[] = $k . ': ' . $v;
    $h[] = 'Content-Type: application/x-www-form-urlencoded';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => http_build_query($body),
        CURLOPT_HTTPHEADER => $h,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    $response = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    pf_log('PayFast pause subscription: HTTP ' . $code, ['token' => $token, 'response' => $response]);
    return $code === 200;
}
