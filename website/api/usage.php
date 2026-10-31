<?php
/**
 * Shared helpers for the app endpoints (scan.php, send-email.php):
 * read the JSON request, work out who is asking (paid licence or trial device),
 * and count usage against each plan's limits. Counters are small JSON files in
 * data/usage/ (no database needed).
 */

function app_reply(int $code, array $body): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body);
    exit;
}

function app_input(int $maxBytes): array
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') app_reply(405, ['error' => 'Use POST.']);
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || strlen($raw) > $maxBytes) app_reply(413, ['error' => 'That file is too big. Please use a smaller photo.']);
    $data = json_decode($raw, true);
    if (!is_array($data)) app_reply(400, ['error' => 'Bad request.']);
    return $data;
}

/**
 * Who is calling. A valid, paid-up licence key gives that licence's plan.
 * Anyone else is treated as a trial user, identified by the app's device id.
 */
function app_caller(array $in): array
{
    $key = trim((string)($in['key'] ?? ''));
    if ($key !== '') {
        $lic = lic_get($key);
        $grace = 7 * 86400;
        if ($lic && ($lic['status'] ?? '') !== 'revoked' && strtotime($lic['paid_until']) + $grace >= time()) {
            return ['id' => 'key:' . $lic['key'], 'plan' => $lic['plan'], 'trial' => false, 'licence' => $lic];
        }
    }
    // A staff laptop connected by online sync works under the owner's licence
    $sync = (string)($in['sync'] ?? '');
    if ($sync !== '') {
        require_once __DIR__ . '/sync-store.php';
        $found = sync_licence_for_token($sync);
        $lic = $found['licence'] ?? null;
        if ($lic && ($lic['status'] ?? '') !== 'revoked' && strtotime($lic['paid_until']) + 7 * 86400 >= time()) {
            return ['id' => 'key:' . $lic['key'], 'plan' => $lic['plan'], 'trial' => false, 'licence' => $lic];
        }
    }
    $device = preg_replace('/[^A-Za-z0-9_]/', '', (string)($in['device'] ?? ''));
    if (strlen($device) < 8) app_reply(400, ['error' => 'Please update Setwel to the latest version.']);
    return ['id' => 'dev:' . substr($device, 0, 64), 'plan' => 'trial', 'trial' => true, 'licence' => null];
}

function usage_file(string $bucket): string
{
    $dir = pf_data_dir() . '/usage';
    if (!is_dir($dir)) mkdir($dir, 0750, true);
    return $dir . '/' . preg_replace('/[^a-z0-9_-]/i', '', $bucket) . '.json';
}

/**
 * Adds one to a counter if it is still under the limit. Returns the new count,
 * or null if the limit is reached. $limit null = no limit.
 */
function usage_take(string $bucket, string $id, ?int $limit): ?int
{
    $file = usage_file($bucket);
    $fh = fopen($file, 'c+');
    flock($fh, LOCK_EX);
    $size = filesize($file);
    $all = $size > 0 ? json_decode(fread($fh, $size), true) : [];
    if (!is_array($all)) $all = [];
    $count = (int)($all[$id] ?? 0);
    if ($limit !== null && $count >= $limit) {
        flock($fh, LOCK_UN);
        fclose($fh);
        return null;
    }
    $all[$id] = $count + 1;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($all));
    flock($fh, LOCK_UN);
    fclose($fh);
    return $count + 1;
}

/** Gives one back, used when the work failed so the customer isn't charged a scan. */
function usage_refund(string $bucket, string $id): void
{
    $file = usage_file($bucket);
    $fh = fopen($file, 'c+');
    flock($fh, LOCK_EX);
    $size = filesize($file);
    $all = $size > 0 ? json_decode(fread($fh, $size), true) : [];
    if (is_array($all) && !empty($all[$id])) {
        $all[$id]--;
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($all));
    }
    flock($fh, LOCK_UN);
    fclose($fh);
}

function client_ip(): string
{
    return preg_replace('/[^0-9a-f:.]/i', '', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
}
