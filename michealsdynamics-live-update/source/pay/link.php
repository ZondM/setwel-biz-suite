<?php
/* For the owner: create a PayFast payment link for a confirmed order.
   Open https://michealsdynamics.co.za/pay/link.php and log in with admin_password from the settings file. */
define('MD_PAY', 1);
require __DIR__ . '/_lib.php';

session_name('mdpay');
session_set_cookie_params(['lifetime' => 0, 'path' => '/pay/', 'secure' => !empty($_SERVER['HTTPS']), 'httponly' => true, 'samesite' => 'Strict']);
session_start();

$c = md_config();
$problems = md_cfg_problems($c);
if ($problems) {
    md_page('Payment links', '<div class="card"><h1>Payment links — setup needed</h1><div class="err"><ul><li>'
        . implode('</li><li>', array_map('md_h', $problems)) . '</li></ul></div>'
        . '<p class="muted">Edit md-payfast-config.php in your cPanel home folder (not inside the website folder), then reload this page.</p></div>');
    exit;
}
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
$csrf = $_SESSION['csrf'];
$post = $_SERVER['REQUEST_METHOD'] === 'POST';
if ($post && !hash_equals($csrf, (string)($_POST['csrf'] ?? ''))) { http_response_code(403); md_page('Expired', '<div class="card"><p class="err">Page expired. <a href="link.php">Reload</a> and try again.</p></div>'); exit; }

if ($post && isset($_POST['logout'])) { $_SESSION = []; session_destroy(); header('Location: link.php'); exit; }

if (empty($_SESSION['ok'])) {
    $msg = '';
    if ($post && isset($_POST['password'])) {
        if (hash_equals((string)$c['admin_password'], (string)$_POST['password'])) {
            session_regenerate_id(true); $_SESSION['ok'] = 1; header('Location: link.php'); exit;
        }
        sleep(2);
        $msg = '<p class="err">Wrong password.</p>';
    }
    md_page('Payment links', '<div class="card"><h1>Payment links</h1>' . $msg . '<form method="post">'
        . '<input type="hidden" name="csrf" value="' . md_h($csrf) . '"><label>Password<input type="password" name="password" required autocomplete="current-password"></label>'
        . '<button class="btn">Log in</button></form></div>');
    exit;
}

$v = ['ref' => '', 'amount' => '', 'name' => '', 'email' => '', 'phone' => ''];
$out = $err = '';
if ($post && isset($_POST['ref'])) {
    foreach ($v as $k => $_) $v[$k] = trim((string)($_POST[$k] ?? ''));
    $ref = md_ref($v['ref']); $amount = md_amount($v['amount']); $name = md_clean($v['name'], 80); $email = $v['email'];
    if (!$ref) $err = 'Order number: use letters, numbers and - only (e.g. MD-1023).';
    elseif (!$amount) $err = 'Amount: enter the full total in Rand, e.g. 1520.00 (minimum R5.00).';
    elseif ($name === '') $err = 'Enter the customer\'s name.';
    elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) $err = 'Enter a valid customer email (PayFast sends their receipt there).';
    else {
        $link = rtrim($c['site_url'], '/') . '/pay/?' . http_build_query(['ref' => $ref, 'amount' => $amount, 'name' => $name, 'email' => $email, 's' => md_link_sig($c, $ref, $amount, $name, $email)]);
        $text = "Hi $name, thank you for your order $ref with Micheals Dynamics. Total: " . md_money($amount) . ". Pay securely here: $link";
        $phone = preg_replace('/\D/', '', $v['phone']);
        if (strpos($phone, '0') === 0) $phone = '27' . substr($phone, 1);
        $wa = 'https://wa.me/' . ($phone ? $phone : '') . '?text=' . rawurlencode($text);
        $out = '<div class="card"><p class="ok">Payment link ready for <b>' . md_h($ref) . '</b> — ' . md_money($amount) . '</p>'
            . '<label>Link</label><textarea rows="4" readonly onclick="this.select()">' . md_h($link) . '</textarea>'
            . '<a class="btn btn--wa" href="' . md_h($wa) . '" target="_blank" rel="noopener">Send on WhatsApp</a>'
            . '<a class="btn btn--ghost" href="mailto:' . md_h($email) . '?subject=' . rawurlencode("Payment link for order $ref") . '&body=' . rawurlencode($text) . '">Send by email</a>'
            . '<p class="muted">The amount is locked: if anyone changes it, the link stops working. You get an email when it is paid.</p></div>';
        $v = ['ref' => '', 'amount' => '', 'name' => '', 'email' => '', 'phone' => ''];
    }
}

md_page('Payment links', $out . '<div class="card"><h1>Create a payment link</h1>'
    . ($err ? '<p class="err">' . md_h($err) . '</p>' : '')
    . (!empty($c['sandbox']) ? '<p class="err">TEST MODE is on (sandbox = true). Links will not take real money.</p>' : '')
    . '<p class="muted">Use this after you have confirmed stock, delivery and the final total with the customer.</p>'
    . '<form method="post"><input type="hidden" name="csrf" value="' . md_h($csrf) . '">'
    . '<label>Order number<input name="ref" required maxlength="40" value="' . md_h($v['ref']) . '" placeholder="e.g. MD-1023"></label>'
    . '<label>Total to pay (R), including delivery<input name="amount" required inputmode="decimal" value="' . md_h($v['amount']) . '" placeholder="e.g. 1520.00"></label>'
    . '<label>Customer name<input name="name" required maxlength="80" value="' . md_h($v['name']) . '"></label>'
    . '<label>Customer email<input type="email" name="email" required value="' . md_h($v['email']) . '"></label>'
    . '<label>Customer WhatsApp number (optional)<input name="phone" inputmode="tel" value="' . md_h($v['phone']) . '" placeholder="e.g. 082 123 4567"></label>'
    . '<button class="btn">Create payment link</button></form></div>'
    . '<form method="post"><input type="hidden" name="csrf" value="' . md_h($csrf) . '"><button class="btn btn--ghost" name="logout" value="1">Log out</button></form>');
