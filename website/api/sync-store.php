<?php
/**
 * The sync database (data/sync/sync.sqlite) and looking up a laptop by its token.
 * Used by sync.php, and by usage.php so a staff laptop can scan and email under the owner's plan.
 */

function sync_db(): PDO
{
    static $db = null;
    if ($db) return $db;
    if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        app_reply(503, ['error' => 'Online sync is not available on this server yet (SQLite is switched off).']);
    }
    $dir = pf_data_dir() . '/sync';
    if (!is_dir($dir)) mkdir($dir, 0750, true);
    $db = new PDO('sqlite:' . $dir . '/sync.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $db->exec('PRAGMA busy_timeout = 8000');
    $db->exec('PRAGMA journal_mode = WAL');
    $db->exec('CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, licence_key TEXT UNIQUE NOT NULL, created TEXT, seq INTEGER NOT NULL DEFAULT 0)');
    $db->exec('CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL, role TEXT NOT NULL,
        company_id TEXT NOT NULL DEFAULT \'\', name TEXT, prefix TEXT, created TEXT, last_seen TEXT, revoked INTEGER NOT NULL DEFAULT 0)');
    $db->exec('CREATE TABLE IF NOT EXISTS codes (code TEXT PRIMARY KEY, team_id TEXT NOT NULL, company_id TEXT NOT NULL, name TEXT, prefix TEXT,
        expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0)');
    $db->exec('CREATE TABLE IF NOT EXISTS sync_rows (team_id TEXT NOT NULL, tbl TEXT NOT NULL, row_id TEXT NOT NULL, company_id TEXT NOT NULL,
        data TEXT, deleted INTEGER NOT NULL DEFAULT 0, seq INTEGER NOT NULL, device_id TEXT, updated TEXT, PRIMARY KEY (team_id, tbl, row_id))');
    $db->exec('CREATE INDEX IF NOT EXISTS rows_seq ON sync_rows (team_id, seq)');
    return $db;
}

/** The team licence for a connected laptop's token, or null. Doesn't reply with errors. */
function sync_licence_for_token(string $token): ?array
{
    if (strlen($token) < 32 || !in_array('sqlite', PDO::getAvailableDrivers(), true)) return null;
    $db = sync_db();
    $st = $db->prepare('SELECT t.licence_key, d.id FROM devices d JOIN teams t ON t.id = d.team_id WHERE d.token_hash = ? AND d.revoked = 0');
    $st->execute([hash('sha256', $token)]);
    $row = $st->fetch();
    if (!$row) return null;
    $lic = lic_get($row['licence_key']);
    return $lic ? ['licence' => $lic, 'device' => $row['id']] : null;
}
