<?php
/**
 * The ONLY place a subscription customer is actually sent to PayFast to
 * pay. Reached by clicking the activation link emailed after their 30-day
 * free trial ends (see send-trial-reminders.php) — never guessable from
 * the trial ID alone, since the token is a random secret that only ever
 * leaves the server inside that one email.
 */

require __DIR__ . '/config.php';
require __DIR__ . '/payfast.php';

function clean(?string $v): string
{
    return trim(strip_tags($v ?? ''));
}

function showActivationError(string $message): void
{
    http_response_code(400);
    header('Content-Type: text/html; charset=utf-8');
    ?>
<!DOCTYPE html>
<html lang="en-ZA">
<head>
<meta charset="UTF-8">
<title>Setwel Biz Suite</title>
<style>
body{font-family:Inter,system-ui,sans-serif;background:#0A0808;color:#F2EDE8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:24px}
.box{max-width:420px}
p{color:#A09088;line-height:1.6}
a{color:#E8801A}
</style>
</head>
<body>
<div class="box">
<p><?= htmlspecialchars($message, ENT_QUOTES) ?></p>
<p>WhatsApp us at <a href="https://wa.me/27820829050">+27 82 082 9050</a> and we'll sort it out right away.</p>
</div>
</body>
</html>
<?php
    exit;
}

$id    = clean($_GET['id'] ?? '');
$token = clean($_GET['token'] ?? '');

if ($id === '' || $token === '') {
    showActivationError('This activation link is incomplete.');
}

$trial = pf_get_trial($id);
if (!$trial || !hash_equals((string)($trial['token'] ?? ''), $token)) {
    showActivationError('This activation link is invalid.');
}

if (!empty($trial['activated_at'])) {
    showActivationError('This subscription has already been activated — no further action is needed.');
}

if (PAYFAST_PASSPHRASE === '' && !PAYFAST_SANDBOX) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Payments are temporarily unavailable. Please WhatsApp us at +27 82 082 9050 to complete your subscription.";
    pf_log('Refused activation: PAYFAST_PASSPHRASE is empty while PAYFAST_SANDBOX is false', ['id' => $id]);
    exit;
}

$amount = number_format((float)$trial['price'], 2, '.', '');
$paymentId = 'SETWEL-' . date('YmdHis') . '-' . substr(bin2hex(random_bytes(3)), 0, 6);
$billing = $trial['billing'] ?? 'Monthly';

$data = [
    'merchant_id'        => PAYFAST_MERCHANT_ID,
    'merchant_key'       => PAYFAST_MERCHANT_KEY,
    'return_url'         => SITE_URL . '/thank-you.html',
    'cancel_url'         => SITE_URL . '/pay.html',
    'notify_url'         => SITE_URL . '/api/payment-notify.php',
    'name_first'         => $trial['first'],
    'name_last'          => $trial['last'] ?? '',
    'email_address'      => $trial['email'],
    'cell_number'        => preg_replace('/\s+/', '', $trial['phone'] ?? ''),
    'm_payment_id'       => $paymentId,
    'amount'             => $amount,
    'item_name'          => substr('Setwel Biz Suite ' . $trial['plan'], 0, 100),
    'item_description'   => substr($billing . ' subscription' . (($trial['biz'] ?? '') !== '' ? ' — ' . $trial['biz'] : ''), 0, 255),
    'subscription_type'  => ($billing === 'Annual') ? '2' : '1',
    'recurring_amount'   => $amount,
    'frequency'          => ($billing === 'Annual') ? '6' : '3', // PayFast: 3 = monthly, 6 = annual
    'cycles'             => '0', // indefinite, until cancelled
    'billing_date'       => date('Y-m-d'), // charged today — the trial has already run its course
];

pf_store_pending_payment($paymentId, [
    'plan' => $trial['plan'],
    'amount' => $amount,
    'name' => trim($trial['first'] . ' ' . ($trial['last'] ?? '')),
    'email' => $trial['email'],
    'phone' => $trial['phone'] ?? '',
    'biz' => $trial['biz'] ?? '',
    'type' => 'subscription',
    'billing' => $billing,
    'created_at' => date('c'),
    'trial_id' => $id,
]);
pf_update_trial($id, ['activated_at' => date('c')]);
pf_log('Trial activated, sending to PayFast — ' . $id, ['payment_id' => $paymentId]);

pf_redirect_to_payfast($data, PAYFAST_PASSPHRASE, PAYFAST_SANDBOX);
