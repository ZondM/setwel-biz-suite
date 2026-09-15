<?php
/**
 * Builds a signed PayFast payment request server-side and redirects the
 * browser to PayFast's hosted checkout.
 *
 * Called from pay.html / lifetime.html as a plain navigation:
 *   window.location.href = 'api/create-payment.php?' + params
 * (not fetch/AJAX — PayFast's checkout is itself a full-page redirect,
 * so there's nothing to gain from doing this as an async call.)
 *
 * The merchant_key and passphrase never reach the browser: only this
 * script (and config.php, which you must create per config.example.php
 * and never commit) ever sees them.
 */

require __DIR__ . '/config.php';
require __DIR__ . '/payfast.php';

function clean(?string $v): string
{
    return trim(strip_tags($v ?? ''));
}

$plan    = clean($_GET['plan'] ?? '');
$billing = clean($_GET['billing'] ?? 'Monthly'); // Monthly | Annual (subscriptions only)
$price   = clean($_GET['price'] ?? '');
$first   = clean($_GET['first'] ?? '');
$last    = clean($_GET['last'] ?? '');
$email   = clean($_GET['email'] ?? '');
$phone   = clean($_GET['phone'] ?? '');
$biz     = clean($_GET['biz'] ?? '');
$type    = clean($_GET['type'] ?? 'subscription'); // subscription | once-off

$errors = [];
if ($plan === '') $errors[] = 'plan';
if ($first === '') $errors[] = 'first name';
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'valid email';
if ($phone === '') $errors[] = 'phone number';
if ($price === '' || !is_numeric($price) || (float)$price <= 0) $errors[] = 'price';

if ($errors) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Missing or invalid: " . implode(', ', $errors) . ". Please go back and try again, or WhatsApp us at +27 82 082 9050.";
    exit;
}

if (PAYFAST_PASSPHRASE === '' && !PAYFAST_SANDBOX) {
    // Refuse to take real payments with no passphrase configured — that's
    // the exact insecure state this script exists to fix.
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Payments are temporarily unavailable. Please WhatsApp us at +27 82 082 9050 to complete your order.";
    pf_log('Refused checkout: PAYFAST_PASSPHRASE is empty while PAYFAST_SANDBOX is false');
    exit;
}

$paymentId = 'SETWEL-' . date('YmdHis') . '-' . substr(bin2hex(random_bytes(3)), 0, 6);
$amount = number_format((float)$price, 2, '.', '');

$data = [
    'merchant_id'       => PAYFAST_MERCHANT_ID,
    'merchant_key'      => PAYFAST_MERCHANT_KEY,
    'return_url'        => SITE_URL . '/thank-you.html',
    'cancel_url'        => SITE_URL . '/pay.html',
    'notify_url'        => SITE_URL . '/api/payment-notify.php',
    'name_first'        => $first,
    'name_last'         => $last,
    'email_address'     => $email,
    'cell_number'       => preg_replace('/\s+/', '', $phone),
    'm_payment_id'       => $paymentId,
    'amount'            => $amount,
    'item_name'         => substr('Setwel Biz Suite ' . $plan, 0, 100),
    'item_description'  => substr(
        ($type === 'once-off' ? 'Lifetime licence' : ($billing . ' subscription')) . ($biz !== '' ? ' — ' . $biz : ''),
        0, 255
    ),
];

if ($type === 'subscription') {
    $data['subscription_type'] = ($billing === 'Annual') ? '2' : '1';
    $data['recurring_amount']  = $amount;
    $data['frequency']         = ($billing === 'Annual') ? '6' : '3'; // PayFast: 3 = monthly, 6 = annual
    $data['cycles']            = '0'; // indefinite, until cancelled
    $data['billing_date']      = date('Y-m-d', strtotime('+30 days')); // first charge after the free trial
}

$data['signature'] = pf_generate_signature($data, PAYFAST_PASSPHRASE);

pf_store_pending_payment($paymentId, [
    'plan' => $plan,
    'amount' => $amount,
    'name' => trim($first . ' ' . $last),
    'email' => $email,
    'phone' => $phone,
    'biz' => $biz,
    'type' => $type,
    'billing' => $billing,
    'created_at' => date('c'),
]);

$action = PAYFAST_SANDBOX
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
