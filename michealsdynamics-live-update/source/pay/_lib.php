<?php
/* Micheals Dynamics — PayFast payment links: shared helpers.
   The PayFast details live in md-payfast-config.php in your HOME folder (one level above
   the website folder), so they can never be downloaded from the website. */
if (!defined('MD_PAY')) { http_response_code(404); exit; }

function md_config() {
    static $cfg = false;
    if ($cfg !== false) return $cfg;
    $cfg = null;
    $paths = array_filter([
        getenv('MD_PAYFAST_CONFIG') ?: null,
        dirname(__DIR__, 2) . '/md-payfast-config.php',
    ]);
    foreach ($paths as $p) {
        if (is_file($p)) { $c = require $p; if (is_array($c)) { $cfg = $c; break; } }
    }
    return $cfg;
}

function md_cfg_problems($c) {
    $p = [];
    if (!$c) return ['The settings file md-payfast-config.php was not found in your home folder.'];
    if (!preg_match('/^\d{6,}$/', (string)($c['merchant_id'] ?? ''))) $p[] = 'merchant_id is missing or not digits only.';
    if (!preg_match('/^[a-z0-9]{10,}$/i', (string)($c['merchant_key'] ?? ''))) $p[] = 'merchant_key is missing or has spaces.';
    if (strlen((string)($c['link_secret'] ?? '')) < 32) $p[] = 'link_secret must be at least 32 characters.';
    if (strlen((string)($c['admin_password'] ?? '')) < 10) $p[] = 'admin_password must be at least 10 characters.';
    if (!filter_var($c['notify_email'] ?? '', FILTER_VALIDATE_EMAIL)) $p[] = 'notify_email is not a valid email address.';
    if (!preg_match('#^https://#', (string)($c['site_url'] ?? ''))) $p[] = 'site_url must start with https://';
    return $p;
}

function md_h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function md_money($a) { return 'R' . number_format((float)$a, 2, '.', ','); }

/* Amount as "1234.50", or null if invalid. PayFast's minimum is R5.00. */
function md_amount($raw) {
    $raw = str_replace([' ', ',', 'R', 'r'], ['', '', '', ''], trim((string)$raw));
    if (!preg_match('/^\d{1,7}(\.\d{1,2})?$/', $raw)) return null;
    $v = (float)$raw;
    if ($v < 5 || $v > 1000000) return null;
    return number_format($v, 2, '.', '');
}
function md_ref($raw) {
    $raw = trim((string)$raw);
    return preg_match('/^[A-Za-z0-9][A-Za-z0-9\-_\/]{0,39}$/', $raw) ? $raw : null;
}
function md_clean($raw, $max = 100) {
    return trim(mb_substr(preg_replace('/[\x00-\x1F\x7F<>]/u', '', (string)$raw), 0, $max));
}

/* Signature that stops anyone changing the amount on a link you created. */
function md_link_sig($c, $ref, $amount, $name, $email) {
    return hash_hmac('sha256', "link|$ref|$amount|$name|$email", $c['link_secret']);
}
function md_pay_sig($c, $ref, $amount) {
    return substr(hash_hmac('sha256', "paid|$ref|$amount", $c['link_secret']), 0, 40);
}

function md_pf_host($c) { return !empty($c['sandbox']) ? 'sandbox.payfast.co.za' : 'www.payfast.co.za'; }

/* PayFast signature: fields in the order sent, empty ones skipped, passphrase last. */
function md_pf_signature(array $data, $passphrase) {
    $parts = [];
    foreach ($data as $k => $v) {
        if ($k === 'signature' || $v === '' || $v === null) continue;
        $parts[] = $k . '=' . urlencode(trim((string)$v));
    }
    $s = implode('&', $parts);
    if ((string)$passphrase !== '') $s .= '&passphrase=' . urlencode(trim((string)$passphrase));
    return md5($s);
}

function md_mail($c, $to, $subject, $text, $replyTo = null) {
    $from = $c['from_email'] ?? ('noreply@' . parse_url($c['site_url'], PHP_URL_HOST));
    $headers = "From: Micheals Dynamics <$from>\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    if ($replyTo && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) $headers .= "Reply-To: $replyTo\r\n";
    $subject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    if (getenv('MD_MAIL_LOG')) { file_put_contents(getenv('MD_MAIL_LOG'), json_encode([$to, $subject, $text]) . "\n", FILE_APPEND); return true; }
    return @mail($to, $subject, $text, $headers);
}

function md_log($line) {
    $file = dirname(__DIR__, 2) . '/md-payfast-log.txt';
    @file_put_contents($file, date('Y-m-d H:i:s') . ' ' . $line . "\n", FILE_APPEND | LOCK_EX);
}
function md_log_has($needle) {
    $file = dirname(__DIR__, 2) . '/md-payfast-log.txt';
    return $needle !== '' && is_file($file) && strpos((string)file_get_contents($file), $needle) !== false;
}

function md_page($title, $body) {
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    echo '<!doctype html><html lang="en-ZA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
       . '<meta name="robots" content="noindex"><title>' . md_h($title) . ' | Micheals Dynamics</title><style>'
       . 'body{margin:0;font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#10202A;background:#F4F7F8}'
       . '.top{background:#0B6E78;color:#fff;padding:14px 16px;font-weight:700}.top a{color:#fff;text-decoration:none}'
       . '.wrap{max-width:560px;margin:0 auto;padding:24px 16px 60px}.card{background:#fff;border:1px solid #DCE4E6;border-radius:12px;padding:20px;margin-bottom:16px}'
       . 'h1{font-size:1.5rem;margin:0 0 12px}.amt{font-size:2rem;font-weight:800;color:#0B6E78;margin:6px 0}.muted{color:#5A6A70;font-size:.92rem}'
       . '.btn{display:block;width:100%;box-sizing:border-box;text-align:center;background:#0B6E78;color:#fff;border:0;border-radius:10px;padding:14px;font:inherit;font-weight:700;cursor:pointer;text-decoration:none;margin-top:12px}'
       . '.btn--wa{background:#157A3E}.btn--ghost{background:#fff;color:#0B6E78;border:2px solid #0B6E78}'
       . 'label{display:block;font-weight:600;margin:12px 0 4px}input{width:100%;box-sizing:border-box;min-height:46px;border:1px solid #9AABB0;border-radius:8px;padding:10px 12px;font:inherit}'
       . '.err{background:#FDECEA;border-left:4px solid #B42318;padding:10px 12px;border-radius:6px}.ok{background:#E9F6EE;border-left:4px solid #1F7A3A;padding:10px 12px;border-radius:6px}'
       . 'textarea{width:100%;box-sizing:border-box;border:1px solid #9AABB0;border-radius:8px;padding:10px;font:inherit}'
       . 'dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0}dt{color:#5A6A70}dd{margin:0;font-weight:600;word-break:break-word}'
       . '</style></head><body><div class="top"><a href="/">Micheals Dynamics</a></div><div class="wrap">' . $body . '</div></body></html>';
}
