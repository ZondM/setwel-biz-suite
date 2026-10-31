<?php
/**
 * Online sync between the laptops of one business owner (a "team").
 *
 * The owner's laptop (all businesses) and staff laptops (one business each, quotes,
 * invoices and customers only) exchange changed records through this server.
 * Records are stored as the app sends them, in data/sync/sync.sqlite, which is never
 * served directly (data/.htaccess).
 *
 * POST {"action": ..., "token": device token, ...}
 *   setup   {key}                          owner laptop joins (or creates) the team for a paid licence
 *   link    {companyId, name, prefix}      owner makes a one-time code for a staff laptop
 *   join    {code}                         staff laptop joins with that code
 *   devices                                owner lists the team's laptops
 *   revoke  {deviceId}                     owner removes a laptop
 *   push    {changes: [{t, id, c, d}]}     upload changed rows (d = row, or null when deleted)
 *   pull    {since}                        download rows changed since a cursor
 */

require __DIR__ . '/config.php';
require __DIR__ . '/payfast.php';
require __DIR__ . '/licences.php';
require __DIR__ . '/usage.php';
require __DIR__ . '/sync-store.php';

const SYNC_PLANS = ['enterprise', 'accountant_partner']; // plans with several businesses
// Tables a staff laptop may receive, and the ones it may change (never delete).
const STAFF_PULL = ['companies', 'settings', 'customers', 'quotes', 'invoices'];
const STAFF_PUSH = ['customers', 'quotes', 'invoices', 'audit_log']; // audit_log: the owner's change history shows who did what
const OWNER_TABLES = ['companies', 'customers', 'suppliers', 'expense_categories', 'quotes', 'invoices', 'payments',
    'expenses', 'bills', 'settings', 'recurring_invoices', 'reminders', 'bank_lines', 'bank_rules', 'budgets', 'audit_log'];
const MAX_ROW_BYTES = 3 * 1024 * 1024; // a receipt photo can be large
const PULL_LIMIT = 400;
const CODE_HOURS = 48;

$in = app_input(12 * 1024 * 1024);
$action = (string)($in['action'] ?? '');
$db = sync_db();

/** The paid licence behind a team, or an error reply. */
function team_licence(array $team): array
{
    $lic = lic_get($team['licence_key']);
    if (!$lic || ($lic['status'] ?? '') === 'revoked') app_reply(403, ['error' => 'The licence for these laptops has been switched off. Please WhatsApp us on 082 082 9050.']);
    return $lic;
}

/** Licence details sent to every laptop on each sync, so staff laptops stay unlocked while the owner pays. */
function licence_info(array $lic, string $teamId): array
{
    return ['plan' => $lic['plan'], 'paid_until' => $lic['paid_until'], 'token' => lic_team_token($lic, $teamId)];
}

function device_from_token(PDO $db, string $token): array
{
    if (strlen($token) < 32) app_reply(401, ['error' => 'This laptop is not connected. Set up sync again in Settings.', 'code' => 'not_linked']);
    $st = $db->prepare('SELECT * FROM devices WHERE token_hash = ?');
    $st->execute([hash('sha256', $token)]);
    $dev = $st->fetch();
    if (!$dev) app_reply(401, ['error' => 'This laptop is not connected. Set up sync again in Settings.', 'code' => 'not_linked']);
    if ($dev['revoked']) app_reply(401, ['error' => 'The owner has removed this laptop from the business.', 'code' => 'revoked']);
    $db->prepare('UPDATE devices SET last_seen = ? WHERE id = ?')->execute([date('c'), $dev['id']]);
    return $dev;
}

function get_team(PDO $db, string $id): array
{
    $st = $db->prepare('SELECT * FROM teams WHERE id = ?');
    $st->execute([$id]);
    $team = $st->fetch();
    if (!$team) app_reply(401, ['error' => 'This laptop is not connected. Set up sync again in Settings.', 'code' => 'not_linked']);
    return $team;
}

function new_device(PDO $db, string $teamId, string $role, string $companyId, string $name, string $prefix): array
{
    $token = bin2hex(random_bytes(32));
    $id = 'dev_' . bin2hex(random_bytes(8));
    $db->prepare('INSERT INTO devices (id, team_id, token_hash, role, company_id, name, prefix, created, last_seen, revoked) VALUES (?,?,?,?,?,?,?,?,?,0)')
        ->execute([$id, $teamId, hash('sha256', $token), $role, $companyId, $name, $prefix, date('c'), date('c')]);
    return ['id' => $id, 'token' => $token];
}

$clean = fn($v, $max) => substr(trim(preg_replace('/[\x00-\x1F]/', '', (string)$v)), 0, $max);

switch ($action) {
    case 'setup': {
        // Owner laptop. The licence key is the owner's proof: whoever holds it can connect an owner laptop.
        if (usage_take('sync-setup-' . date('Y-m-d-H'), client_ip(), 20) === null) app_reply(429, ['error' => 'Too many tries. Please wait an hour.']);
        $lic = lic_get((string)($in['key'] ?? ''));
        if (!$lic) app_reply(403, ['error' => 'Online sync needs a paid Setwel licence. Enter your licence key first (Licence menu).']);
        if (($lic['status'] ?? '') === 'revoked' || strtotime($lic['paid_until']) + 7 * 86400 < time()) app_reply(403, ['error' => 'Your subscription has ended. Renew it to use online sync.']);
        if (!in_array($lic['plan'], SYNC_PLANS, true)) app_reply(403, ['error' => 'Staff laptops are part of the Enterprise and Accountant Partner plans.']);
        $st = $db->prepare('SELECT * FROM teams WHERE licence_key = ?');
        $st->execute([$lic['key']]);
        $team = $st->fetch();
        if (!$team) {
            $team = ['id' => 'team_' . bin2hex(random_bytes(8)), 'licence_key' => $lic['key']];
            $db->prepare('INSERT INTO teams (id, licence_key, created, seq) VALUES (?,?,?,0)')->execute([$team['id'], $lic['key'], date('c')]);
        }
        $dev = new_device($db, $team['id'], 'owner', '', $clean($in['name'] ?? 'Owner laptop', 60), '');
        pf_log('Sync: owner laptop connected', ['team' => $team['id'], 'device' => $dev['id']]);
        app_reply(200, ['token' => $dev['token'], 'deviceId' => $dev['id'], 'team' => $team['id'], 'licence' => licence_info($lic, $team['id'])]);
    }

    case 'link': {
        $dev = device_from_token($db, (string)($in['token'] ?? ''));
        if ($dev['role'] !== 'owner') app_reply(403, ['error' => 'Only the owner laptop can add laptops.']);
        team_licence(get_team($db, $dev['team_id']));
        $companyId = $clean($in['companyId'] ?? '', 64);
        $name = $clean($in['name'] ?? '', 60);
        $prefix = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($in['prefix'] ?? '')));
        if ($companyId === '' || $name === '') app_reply(400, ['error' => 'Choose the business and give the laptop a name.']);
        if ($prefix === '' || strlen($prefix) > 4) app_reply(400, ['error' => 'The invoice code must be 1 to 4 letters or numbers, for example FD.']);
        $st = $db->prepare('SELECT 1 FROM devices WHERE team_id = ? AND company_id = ? AND prefix = ? AND revoked = 0');
        $st->execute([$dev['team_id'], $companyId, $prefix]);
        $taken = (bool)$st->fetch();
        if (!$taken) { // a code made earlier for this prefix that hasn't been used yet
            $st = $db->prepare('SELECT 1 FROM codes WHERE team_id = ? AND company_id = ? AND prefix = ? AND used = 0 AND expires > ?');
            $st->execute([$dev['team_id'], $companyId, $prefix, time()]);
            $taken = (bool)$st->fetch();
        }
        if ($taken) app_reply(400, ['error' => "Another laptop in this business already uses the code $prefix. Choose a different one."]);
        $alphabet = LIC_ALPHABET;
        do {
            $code = '';
            for ($i = 0; $i < 8; $i++) $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            $st = $db->prepare('SELECT 1 FROM codes WHERE code = ?');
            $st->execute([$code]);
        } while ($st->fetch());
        $db->prepare('INSERT INTO codes (code, team_id, company_id, name, prefix, expires, used) VALUES (?,?,?,?,?,?,0)')
            ->execute([$code, $dev['team_id'], $companyId, $name, $prefix, time() + CODE_HOURS * 3600]);
        app_reply(200, ['code' => substr($code, 0, 4) . '-' . substr($code, 4), 'expiresHours' => CODE_HOURS]);
    }

    case 'join': {
        if (usage_take('sync-join-' . date('Y-m-d-H'), client_ip(), 20) === null) app_reply(429, ['error' => 'Too many tries. Please wait an hour.']);
        $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)($in['code'] ?? '')));
        $st = $db->prepare('SELECT * FROM codes WHERE code = ?');
        $st->execute([$code]);
        $c = $st->fetch();
        if (!$c || $c['used'] || $c['expires'] < time()) app_reply(404, ['error' => 'That code is wrong, already used or older than 48 hours. Ask the owner for a new one.']);
        $team = get_team($db, $c['team_id']);
        $lic = team_licence($team);
        $db->prepare('UPDATE codes SET used = 1 WHERE code = ?')->execute([$code]);
        $dev = new_device($db, $team['id'], 'staff', $c['company_id'], $c['name'], $c['prefix']);
        pf_log('Sync: staff laptop joined', ['team' => $team['id'], 'device' => $dev['id'], 'company' => $c['company_id']]);
        app_reply(200, [
            'token' => $dev['token'], 'deviceId' => $dev['id'], 'team' => $team['id'],
            'companyId' => $c['company_id'], 'name' => $c['name'], 'prefix' => $c['prefix'],
            'licence' => licence_info($lic, $team['id']),
        ]);
    }

    case 'devices': {
        $dev = device_from_token($db, (string)($in['token'] ?? ''));
        if ($dev['role'] !== 'owner') app_reply(403, ['error' => 'Only the owner laptop can see the laptops.']);
        $st = $db->prepare('SELECT id, role, company_id, name, prefix, created, last_seen FROM devices WHERE team_id = ? AND revoked = 0 ORDER BY created');
        $st->execute([$dev['team_id']]);
        app_reply(200, ['devices' => $st->fetchAll(), 'me' => $dev['id']]);
    }

    case 'revoke': {
        $dev = device_from_token($db, (string)($in['token'] ?? ''));
        if ($dev['role'] !== 'owner') app_reply(403, ['error' => 'Only the owner laptop can remove laptops.']);
        $id = $clean($in['deviceId'] ?? '', 40);
        if ($id === $dev['id']) app_reply(400, ['error' => 'You cannot remove the laptop you are using.']);
        $db->prepare('UPDATE devices SET revoked = 1 WHERE id = ? AND team_id = ?')->execute([$id, $dev['team_id']]);
        app_reply(200, ['ok' => true]);
    }

    case 'push': {
        $dev = device_from_token($db, (string)($in['token'] ?? ''));
        $team = get_team($db, $dev['team_id']);
        team_licence($team);
        $changes = is_array($in['changes'] ?? null) ? array_slice($in['changes'], 0, 1000) : [];
        $staff = $dev['role'] === 'staff';
        $db->beginTransaction();
        $seq = (int)$db->query('SELECT seq FROM teams WHERE id = ' . $db->quote($team['id']))->fetchColumn();
        $put = $db->prepare('INSERT INTO sync_rows (team_id, tbl, row_id, company_id, data, deleted, seq, device_id, updated)
            VALUES (?,?,?,?,?,?,?,?,?)
            ON CONFLICT(team_id, tbl, row_id) DO UPDATE SET company_id = excluded.company_id, data = excluded.data,
            deleted = excluded.deleted, seq = excluded.seq, device_id = excluded.device_id, updated = excluded.updated');
        $owner = $db->prepare('SELECT company_id FROM sync_rows WHERE team_id = ? AND tbl = ? AND row_id = ?');
        $accepted = 0;
        $rejected = 0;
        foreach ($changes as $ch) {
            $t = (string)($ch['t'] ?? '');
            $id = substr((string)($ch['id'] ?? ''), 0, 200);
            $c = substr((string)($ch['c'] ?? ''), 0, 64);
            $deleted = !isset($ch['d']) || $ch['d'] === null;
            $data = $deleted ? null : json_encode($ch['d']);
            $ok = $id !== '' && $c !== '' && in_array($t, OWNER_TABLES, true) && ($data === null || strlen($data) <= MAX_ROW_BYTES);
            if ($ok && !$deleted) {
                // The row must be what it says it is: its own id and business
                $d = $ch['d'];
                $rowId = $t === 'settings' ? ($d['company_id'] ?? '') . '|' . ($d['key'] ?? '') : (string)($d['id'] ?? '');
                $rowCo = $t === 'companies' ? (string)($d['id'] ?? '') : (string)($d['company_id'] ?? '');
                $ok = is_array($d) && $rowId === $id && $rowCo === $c;
            }
            if ($ok && $staff) {
                // Staff laptops only add or change quotes, invoices and customers of their own business
                $ok = !$deleted && in_array($t, STAFF_PUSH, true) && $c === $dev['company_id'];
                if ($ok) {
                    $owner->execute([$team['id'], $t, $id]);
                    $existing = $owner->fetchColumn();
                    $ok = $existing === false || $existing === $dev['company_id'];
                }
            }
            if (!$ok) { $rejected++; continue; }
            $put->execute([$team['id'], $t, $id, $c, $data, $deleted ? 1 : 0, ++$seq, $dev['id'], date('c')]);
            $accepted++;
        }
        $db->prepare('UPDATE teams SET seq = ? WHERE id = ?')->execute([$seq, $team['id']]);
        $db->commit();
        app_reply(200, ['accepted' => $accepted, 'rejected' => $rejected]);
    }

    case 'pull': {
        $dev = device_from_token($db, (string)($in['token'] ?? ''));
        $team = get_team($db, $dev['team_id']);
        $lic = team_licence($team);
        $since = max(0, (int)($in['since'] ?? 0));
        if ($dev['role'] === 'staff') {
            $tables = implode(',', array_map([$db, 'quote'], STAFF_PULL));
            $st = $db->prepare("SELECT tbl, row_id, company_id, data, deleted, seq, device_id FROM sync_rows
                WHERE team_id = ? AND seq > ? AND company_id = ? AND tbl IN ($tables) ORDER BY seq LIMIT " . PULL_LIMIT);
            $st->execute([$team['id'], $since, $dev['company_id']]);
        } else {
            $st = $db->prepare('SELECT tbl, row_id, company_id, data, deleted, seq, device_id FROM sync_rows
                WHERE team_id = ? AND seq > ? ORDER BY seq LIMIT ' . PULL_LIMIT);
            $st->execute([$team['id'], $since]);
        }
        $rows = $st->fetchAll();
        $cursor = $since;
        $out = [];
        foreach ($rows as $r) {
            $cursor = max($cursor, (int)$r['seq']);
            if ($r['device_id'] === $dev['id']) continue; // this laptop already has its own changes
            $out[] = ['t' => $r['tbl'], 'id' => $r['row_id'], 'c' => $r['company_id'], 'd' => $r['deleted'] ? null : json_decode($r['data'], true)];
        }
        app_reply(200, [
            'changes' => $out, 'cursor' => $cursor, 'more' => count($rows) === PULL_LIMIT,
            'role' => $dev['role'], 'companyId' => $dev['company_id'], 'prefix' => $dev['prefix'], 'name' => $dev['name'],
            'licence' => licence_info($lic, $team['id']),
        ]);
    }

    default:
        app_reply(400, ['error' => 'Unknown request.']);
}
