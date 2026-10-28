<?php
/**
 * Lets the thank-you page show the new licence key once PayFast has
 * confirmed the payment. Needs the payment ID and the private view token
 * that was put in PayFast's return link, so nobody can look up other keys.
 */

require __DIR__ . '/config.php';
require __DIR__ . '/payfast.php';
require __DIR__ . '/licences.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$id = (string)($_GET['id'] ?? '');
$t = (string)($_GET['t'] ?? '');

$pending = pf_get_pending_payment($id);
if (!$pending || $t === '' || !hash_equals((string)($pending['view_token'] ?? ''), $t)) {
    http_response_code(404);
    echo json_encode(['error' => 'not found']);
    exit;
}

$lic = lic_find_by_payment($id);
echo json_encode($lic ? ['key' => $lic['key'], 'ref_code' => $lic['ref_code']] : ['pending' => true]);
