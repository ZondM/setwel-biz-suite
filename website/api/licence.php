<?php
/**
 * Licence check for the app. POST {"key": "SETW-XXXX-XXXX-XXXX"}.
 * Returns {"token": "..."} (signed, checked offline by the app) or {"error": "..."}.
 *
 * The desktop app and the phone version call this when the customer enters
 * a key, and again quietly whenever they're online, so renewals and
 * referral months are picked up automatically.
 */

require __DIR__ . '/config.php';
require __DIR__ . '/payfast.php';
require __DIR__ . '/licences.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
// The phone version runs on this same site; the desktop app is not a browser page, so no CORS is needed.

function reply(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    reply(405, ['error' => 'Use POST.']);
}

$input = json_decode(file_get_contents('php://input'), true);
$key = lic_normalise((string)($input['key'] ?? ''));

if (!lic_valid_format($key)) {
    reply(400, ['error' => 'A licence key looks like SETW-ABCD-EFGH-JKLM. Please check it and try again.']);
}

$lic = lic_get($key);
if (!$lic) {
    pf_log('Licence check: unknown key ' . $key);
    reply(404, ['error' => 'We could not find that key. Check for typing mistakes, or WhatsApp us on 082 082 9050.']);
}
if (($lic['status'] ?? '') === 'revoked') {
    reply(403, ['error' => 'This key has been switched off. Please WhatsApp us on 082 082 9050.']);
}

$problem = lic_signing_problem();
if ($problem !== null) {
    pf_log('Licence check FAILED: ' . $problem, ['key' => $key]);
    reply(503, ['error' => 'Setwel cannot issue licences right now (server setup). Please WhatsApp us on 082 082 9050 and we will sort it out quickly.']);
}

$lic['last_checked'] = date('c');
lic_save($lic);

reply(200, [
    'token' => lic_token($lic),
    'plan' => $lic['plan'],
    'paid_until' => $lic['paid_until'],
]);
