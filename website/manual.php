<?php
/**
 * The Setwel training manual, for paying customers only.
 *
 * Sign in with a licence key (form on manual.html, or ?k= from the app).
 * The key is checked against data/licences on every visit, so a cancelled or
 * expired subscription loses access. Trainer notes are for Accountant Partners.
 * The pages are built into api/private/ by tools/build_site.py; that folder is
 * never served directly. Each copy shows who it is licensed to.
 */

require __DIR__ . '/api/config.php';
require __DIR__ . '/api/payfast.php';
require __DIR__ . '/api/licences.php';
require __DIR__ . '/api/usage.php';

const MANUAL_COOKIE = 'setwel_manual';
const MANUAL_HOURS = 12;
const MANUAL_GRACE_DAYS = 7; // same grace as the app after a missed renewal
const MANUAL_TRIES_PER_HOUR = 20;

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: private, no-store');
header('Referrer-Policy: no-referrer');

function manual_secret(): string
{
    return hash('sha256', 'setwel-manual|' . LICENCE_SIGNING_KEY, true);
}

function manual_set_cookie(string $value, int $expires): void
{
    setcookie(MANUAL_COOKIE, $value, [
        'expires' => $expires, 'path' => '/manual.php', 'secure' => !empty($_SERVER['HTTPS']),
        'httponly' => true, 'samesite' => 'Lax',
    ]);
}

/** Licence record if the key may read the manual, otherwise an error message. */
function manual_check(string $key)
{
    $lic = lic_get($key);
    if (!$lic) return 'We could not find that key. Check for typing mistakes, or WhatsApp us on 082 082 9050.';
    if (($lic['status'] ?? '') === 'revoked') return 'This key has been switched off. Please WhatsApp us on 082 082 9050.';
    if (strtotime($lic['paid_until'] ?? '') + MANUAL_GRACE_DAYS * 86400 < time()) {
        return 'This subscription has ended. Renew it on the pricing page to open the manual again.';
    }
    return $lic;
}

function manual_gate(string $error = ''): void
{
    $page = file_get_contents(__DIR__ . '/api/private/manual-gate.html');
    $msg = $error === '' ? '' : '<p style="color:#b42318;margin-top:8px">' . htmlspecialchars($error) . '</p>';
    http_response_code($error === '' ? 200 : 403);
    echo str_replace('<!--ERROR-->', $msg, $page);
    exit;
}

if (isset($_GET['signout'])) {
    manual_set_cookie('', time() - 3600);
    header('Location: /manual.html');
    exit;
}

// Signing in: a key from the form (POST) or from the app (?k=). Then redirect so the key leaves the address bar.
$given = $_POST['key'] ?? $_GET['k'] ?? null;
if ($given !== null) {
    if (usage_take('manual-tries-' . date('Y-m-d-H'), client_ip(), MANUAL_TRIES_PER_HOUR) === null) {
        manual_gate('Too many tries. Please wait an hour, or WhatsApp us on 082 082 9050.');
    }
    $key = lic_normalise((string)$given);
    $lic = lic_valid_format($key) ? manual_check($key) : 'A licence key looks like SETW-ABCD-EFGH-JKLM. Please check it and try again.';
    if (is_string($lic)) manual_gate($lic);

    $expires = time() + MANUAL_HOURS * 3600;
    $body = $key . '|' . $expires;
    manual_set_cookie($body . '|' . hash_hmac('sha256', $body, manual_secret()), $expires);
    pf_log('Manual opened', ['key' => $key]);
    header('Location: /manual.php');
    exit;
}

// Reading: needs a valid signed cookie, and the licence must still be paid up.
$parts = explode('|', (string)($_COOKIE[MANUAL_COOKIE] ?? ''));
if (count($parts) !== 3 || (int)$parts[1] < time()
    || !hash_equals(hash_hmac('sha256', $parts[0] . '|' . $parts[1], manual_secret()), $parts[2])) {
    manual_gate();
}
$lic = manual_check($parts[0]);
if (is_string($lic)) {
    manual_set_cookie('', time() - 3600);
    manual_gate($lic);
}

$who = trim(($lic['name'] ?? '') . (($lic['biz'] ?? '') !== '' ? ', ' . $lic['biz'] : ''));
$stamp = 'Licensed to ' . ($who !== '' ? $who : 'a Setwel customer') . ' (key ending ' . substr($lic['key'], -4) . ').';

$trainers = $lic['plan'] === 'accountant_partner'
    ? file_get_contents(__DIR__ . '/api/private/manual-trainers.html')
    : '<p>The trainer notes (session plan, practice exercises and sign-off checklist) are part of the <a href="/accountants.html">Accountant Partner plan</a>.</p>';

$page = file_get_contents(__DIR__ . '/api/private/manual-page.html');
echo str_replace(['<!--LICENSED-TO-->', '<!--TRAINERS-->'], [htmlspecialchars($stamp), $trainers], $page);
