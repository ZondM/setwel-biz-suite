<?php
/* Customer payment page: opened from the payment link you send on WhatsApp or email. */
define('MD_PAY', 1);
require __DIR__ . '/_lib.php';

$c = md_config();
$bad = function ($msg) {
    md_page('Payment', '<div class="card"><h1>Payment</h1><p class="err">' . md_h($msg) . '</p>'
        . '<p>Please contact us on WhatsApp <a href="https://wa.me/27747423962">074 742 3962</a> or email '
        . '<a href="mailto:michealsdynamicresults@gmail.com">michealsdynamicresults@gmail.com</a>.</p></div>');
    exit;
};
if (!$c || md_cfg_problems($c)) $bad('Online payment is not available right now.');

$ref = md_ref($_GET['ref'] ?? '');
$amount = md_amount($_GET['amount'] ?? '');
$name = md_clean($_GET['name'] ?? '', 80);
$email = trim((string)($_GET['email'] ?? ''));
$sig = (string)($_GET['s'] ?? '');
if (!$ref || !$amount || $email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || $name === '') $bad('This payment link is incomplete.');
if (!hash_equals(md_link_sig($c, $ref, $amount, $name, $email), $sig)) $bad('This payment link is not valid. It may have been changed or copied incorrectly.');

$parts = preg_split('/\s+/', $name, 2);
$site = rtrim($c['site_url'], '/');
$data = [
    'merchant_id' => (string)$c['merchant_id'],
    'merchant_key' => (string)$c['merchant_key'],
    'return_url' => $site . '/pay/done.php?ref=' . rawurlencode($ref),
    'cancel_url' => $site . '/pay/cancelled.php',
    'notify_url' => $site . '/pay/notify.php',
    'name_first' => mb_substr($parts[0], 0, 100),
    'name_last' => mb_substr($parts[1] ?? '', 0, 100),
    'email_address' => $email,
    'm_payment_id' => $ref,
    'amount' => $amount,
    'item_name' => mb_substr('Order ' . $ref . ' - Micheals Dynamics', 0, 100),
    'custom_str1' => md_pay_sig($c, $ref, $amount),
];
$data['signature'] = md_pf_signature($data, $c['passphrase'] ?? '');

$fields = '';
foreach ($data as $k => $v) $fields .= '<input type="hidden" name="' . md_h($k) . '" value="' . md_h($v) . '">';

md_page('Pay order ' . $ref, '<div class="card"><h1>Pay your order</h1>'
    . '<dl><dt>Order</dt><dd>' . md_h($ref) . '</dd><dt>Name</dt><dd>' . md_h($name) . '</dd><dt>Email</dt><dd>' . md_h($email) . '</dd></dl>'
    . '<p class="amt">' . md_money($amount) . '</p>'
    . '<form action="https://' . md_pf_host($c) . '/eng/process" method="post">' . $fields
    . '<button class="btn" type="submit">Pay securely with PayFast</button></form>'
    . '<p class="muted">Card or instant EFT via PayFast. Micheals Dynamics never sees your card details. '
    . 'Prices in ZAR; no VAT charged (not VAT registered).</p>'
    . (!empty($c['sandbox']) ? '<p class="err">TEST MODE: no real money will be taken.</p>' : '')
    . '</div>');
