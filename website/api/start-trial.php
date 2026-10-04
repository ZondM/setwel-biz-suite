<?php
/**
 * Starts a 30-day free trial — NO payment is taken and no card is collected
 * here. This matches pay.html's promise exactly ("No card required",
 * "no payment taken today"). We just record who signed up for which plan,
 * email them a confirmation, and leave it there.
 *
 * 30 days later, send-trial-reminders.php (run from a server cron job —
 * see that file's own header for setup) emails a PayFast activation link.
 * activate-subscription.php is the only place a subscription customer is
 * ever actually sent to PayFast and charged.
 */

require __DIR__ . '/config.php';
require __DIR__ . '/payfast.php';

function clean(?string $v): string
{
    return trim(strip_tags($v ?? ''));
}

$plan    = clean($_GET['plan'] ?? '');
$billing = clean($_GET['billing'] ?? 'Monthly'); // Monthly | Annual
$price   = clean($_GET['price'] ?? '');
$first   = clean($_GET['first'] ?? '');
$last    = clean($_GET['last'] ?? '');
$email   = clean($_GET['email'] ?? '');
$phone   = clean($_GET['phone'] ?? '');
$biz     = clean($_GET['biz'] ?? '');

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

$trialData = [
    'plan'    => $plan,
    'billing' => $billing,
    'price'   => number_format((float)$price, 2, '.', ''),
    'first'   => $first,
    'last'    => $last,
    'email'   => $email,
    'phone'   => $phone,
    'biz'     => $biz,
];

$stored = pf_store_trial($trialData);
$id = $stored['id'];

pf_email_trial_started($stored);
pf_notify_team_trial_started($stored, $id);
pf_log('Trial started (no payment taken) — ' . $id, $trialData);

header('Location: /thank-you.html?type=trial');
exit;
