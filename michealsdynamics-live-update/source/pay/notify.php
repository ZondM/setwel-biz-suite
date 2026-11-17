<?php
/* PayFast payment confirmation (ITN). PayFast's server calls this after every payment.
   Only payments that pass all checks are reported as PAID. */
define('MD_PAY', 1);
require __DIR__ . '/_lib.php';

http_response_code(200);
header('Content-Type: text/plain');
if (function_exists('fastcgi_finish_request')) { echo 'OK'; fastcgi_finish_request(); }

$c = md_config();
if (!$c || md_cfg_problems($c) || $_SERVER['REQUEST_METHOD'] !== 'POST') exit;

$pf = [];
foreach ($_POST as $k => $v) $pf[$k] = stripslashes((string)$v);
$ref = (string)($pf['m_payment_id'] ?? '');

// 1. Signature
$parts = [];
foreach ($pf as $k => $v) { if ($k === 'signature') continue; $parts[] = $k . '=' . urlencode($v); }
$paramString = implode('&', $parts);
$check = $paramString . ((string)($c['passphrase'] ?? '') !== '' ? '&passphrase=' . urlencode(trim($c['passphrase'])) : '');
if (!hash_equals(md5($check), (string)($pf['signature'] ?? ''))) { md_log("REJECTED bad signature ref=$ref"); exit; }

// 2. Our merchant account
if ((string)($pf['merchant_id'] ?? '') !== (string)$c['merchant_id']) { md_log("REJECTED wrong merchant ref=$ref"); exit; }

// 3. Amount paid matches the amount on the payment link we created
$amount = md_amount($pf['amount_gross'] ?? '');
if (!$amount || !hash_equals(md_pay_sig($c, $ref, $amount), (string)($pf['custom_str1'] ?? ''))) {
    md_log("REJECTED amount does not match link ref=$ref amount=" . ($pf['amount_gross'] ?? ''));
    md_mail($c, $c['notify_email'], "WARNING: payment for $ref did not match its link",
        "A PayFast payment for order $ref (R" . ($pf['amount_gross'] ?? '?') . ") did not match the payment link you created.\n"
        . "Do NOT dispatch until you have checked it in your PayFast account.\nPayFast ID: " . ($pf['pf_payment_id'] ?? ''));
    exit;
}

// 4. Ask PayFast to confirm this notification is genuine
$url = $c['validate_url'] ?? ('https://' . md_pf_host($c) . '/eng/query/validate'); // validate_url: for testing only
$ch = curl_init($url);
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $paramString, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20]);
$resp = trim((string)curl_exec($ch));
curl_close($ch);
if ($resp !== 'VALID') { md_log("REJECTED not confirmed by PayFast ref=$ref resp=" . substr($resp, 0, 40)); exit; }

$status = (string)($pf['payment_status'] ?? '');
$pfId = (string)($pf['pf_payment_id'] ?? '');
if ($status !== 'COMPLETE') { md_log("STATUS $status ref=$ref pf=$pfId"); exit; }
if (md_log_has("PAID ref=$ref pf=$pfId ")) exit; // PayFast sometimes sends the same notice twice

$name = trim(($pf['name_first'] ?? '') . ' ' . ($pf['name_last'] ?? ''));
$email = (string)($pf['email_address'] ?? '');
md_log("PAID ref=$ref pf=$pfId amount=$amount email=$email");

md_mail($c, $c['notify_email'], "PAID: order $ref - " . md_money($amount),
    "Payment received through PayFast.\n\nOrder: $ref\nAmount: " . md_money($amount) . "\nCustomer: $name\nEmail: $email\nPayFast payment ID: $pfId\n"
    . "Fee: " . ($pf['amount_fee'] ?? '') . "  Net: " . ($pf['amount_net'] ?? '') . "\n\nYou can now dispatch this order.", $email);
if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
    md_mail($c, $email, "Payment received - order $ref",
        "Hi $name,\n\nThank you. We received your payment of " . md_money($amount) . " for order $ref.\n"
        . "We'll let you know when your order is on its way.\n\nMicheals Dynamics\n074 742 3962 | michealsdynamicresults@gmail.com\n"
        . "Micheals Dynamics Results (Pty) Ltd | Reg. 2024/551935/07 | SAHPRA licence 00005896MD | Not VAT registered", $c['notify_email']);
}
