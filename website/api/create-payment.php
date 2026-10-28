<?php
/**
 * Builds a signed PayFast payment request server-side and redirects the
 * browser to PayFast's hosted checkout. Called by the form on pay.html.
 *
 * The free trial happens inside the app (30 days from first open), so a
 * customer reaching this page has decided to pay: the first charge is today
 * and the subscription renews monthly or yearly after that.
 *
 * The price is looked up here from the plan name, never taken from the
 * browser, so nobody can edit the page to pay R1.
 */

require __DIR__ . '/config.php';
require __DIR__ . '/payfast.php';

const PLAN_PRICES = [
    'hustler'            => ['name' => 'Hustler',            'monthly' => 59.99, 'yearly' => 599],
    'grinder'            => ['name' => 'Grinder',            'monthly' => 199,   'yearly' => 1990],
    'builder'            => ['name' => 'Builder',            'monthly' => 399,   'yearly' => 3990],
    'enterprise'         => ['name' => 'Enterprise',         'monthly' => 999,   'yearly' => 9990],
    'accountant_partner' => ['name' => 'Accountant Partner', 'monthly' => 1499,  'yearly' => null],
];

function clean(?string $v): string
{
    return trim(strip_tags($v ?? ''));
}

$plan    = clean($_GET['plan'] ?? '');
$billing = clean($_GET['billing'] ?? 'monthly') === 'yearly' ? 'yearly' : 'monthly';
$first   = clean($_GET['first'] ?? '');
$last    = clean($_GET['last'] ?? '');
$email   = clean($_GET['email'] ?? '');
$phone   = clean($_GET['phone'] ?? '');
$biz     = clean($_GET['biz'] ?? '');
$ref     = strtoupper(clean($_GET['ref'] ?? ''));

$errors = [];
if (!isset(PLAN_PRICES[$plan])) $errors[] = 'plan';
if ($first === '') $errors[] = 'first name';
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'valid email';
if ($phone === '') $errors[] = 'phone number';

if ($errors) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Missing or invalid: " . implode(', ', $errors) . ". Please go back and try again, or WhatsApp us at 082 082 9050.";
    exit;
}

$planInfo = PLAN_PRICES[$plan];
if ($billing === 'yearly' && $planInfo['yearly'] === null) $billing = 'monthly';
$price = $billing === 'yearly' ? $planInfo['yearly'] : $planInfo['monthly'];

if (PAYFAST_PASSPHRASE === '' && !PAYFAST_SANDBOX) {
    // Refuse to take real payments with no passphrase configured.
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Payments are temporarily unavailable. Please WhatsApp us at 082 082 9050 to complete your order.";
    pf_log('Refused checkout: PAYFAST_PASSPHRASE is empty while PAYFAST_SANDBOX is false');
    exit;
}

$paymentId = 'SETWEL-' . date('YmdHis') . '-' . substr(bin2hex(random_bytes(3)), 0, 6);
$viewToken = bin2hex(random_bytes(12)); // lets the thank-you page (and only it) fetch the new key
$amount = number_format((float)$price, 2, '.', '');

$data = [
    'merchant_id'       => PAYFAST_MERCHANT_ID,
    'merchant_key'      => PAYFAST_MERCHANT_KEY,
    'return_url'        => SITE_URL . '/thank-you.html?id=' . urlencode($paymentId) . '&t=' . $viewToken,
    'cancel_url'        => SITE_URL . '/pricing.html',
    'notify_url'        => SITE_URL . '/api/payment-notify.php',
    'name_first'        => $first,
    'name_last'         => $last,
    'email_address'     => $email,
    'cell_number'       => preg_replace('/\s+/', '', $phone),
    'm_payment_id'      => $paymentId,
    'amount'            => $amount,
    'item_name'         => substr('Setwel Biz Suite ' . $planInfo['name'], 0, 100),
    'item_description'  => substr(ucfirst($billing) . ' subscription' . ($biz !== '' ? ' - ' . $biz : ''), 0, 255),
    'subscription_type' => '1',
    'billing_date'      => date('Y-m-d'),
    'recurring_amount'  => $amount,
    'frequency'         => $billing === 'yearly' ? '6' : '3', // PayFast: 3 = monthly, 6 = annual
    'cycles'            => '0', // until cancelled
];

pf_store_pending_payment($paymentId, [
    'plan' => $plan,
    'amount' => $amount,
    'name' => trim($first . ' ' . $last),
    'email' => $email,
    'phone' => $phone,
    'biz' => $biz,
    'billing' => $billing,
    'ref' => $ref,
    'view_token' => $viewToken,
    'created_at' => date('c'),
]);

pf_redirect_to_payfast($data, PAYFAST_PASSPHRASE, PAYFAST_SANDBOX);
