<?php
/** Database connection (MySQL or SQLite) and small query helpers. */

function db(): PDO
{
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }
    $c = $GLOBALS['config'];
    if (($c['db_driver'] ?? 'sqlite') === 'mysql') {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['db_host'] ?? 'localhost', (int)($c['db_port'] ?? 3306), $c['db_name']);
        $pdo = new PDO($dsn, $c['db_user'], $c['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $pdo->exec("SET time_zone = '+02:00'");
    } else {
        $file = STORAGE_DIR . '/db/' . ($c['db_file'] ?? 'store.sqlite');
        $pdo = new PDO('sqlite:' . $file, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('PRAGMA busy_timeout = 5000');
    }
    return $pdo;
}

function db_driver(): string
{
    return $GLOBALS['config']['db_driver'] ?? 'sqlite';
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function q_all(string $sql, array $params = []): array
{
    return q($sql, $params)->fetchAll();
}

function q_one(string $sql, array $params = []): ?array
{
    $r = q($sql, $params)->fetch();
    return $r ?: null;
}

function q_val(string $sql, array $params = [])
{
    $v = q($sql, $params)->fetchColumn();
    return $v === false ? null : $v;
}

/** Insert a row and return its new id. */
function db_insert(string $table, array $data): int
{
    $cols = array_keys($data);
    $sql = 'INSERT INTO ' . $table . ' (' . implode(',', $cols) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')';
    q($sql, array_values($data));
    return (int)db()->lastInsertId();
}

function db_update(string $table, array $data, string $where, array $params = []): int
{
    $set = implode(',', array_map(fn($c) => "$c = ?", array_keys($data)));
    return q("UPDATE $table SET $set WHERE $where", array_merge(array_values($data), $params))->rowCount();
}

/**
 * Database tables. Written once in a neutral form and adapted for MySQL or SQLite.
 * "ID" = auto-increment primary key.
 */
function schema_sql(): array
{
    $tables = [
        'settings' => "skey VARCHAR(80) PRIMARY KEY, svalue TEXT",
        'admins' => "id ID, name VARCHAR(120) NOT NULL, email VARCHAR(190) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, created_at DATETIME, last_login DATETIME",
        'login_attempts' => "id ID, ip VARCHAR(64), email VARCHAR(190), attempted_at DATETIME",
        'categories' => "id ID, name VARCHAR(150) NOT NULL, slug VARCHAR(160) NOT NULL UNIQUE, parent_id INT NULL, description TEXT, icon VARCHAR(40), sort_order INT DEFAULT 0, visible INT DEFAULT 1",
        'brands' => "id ID, name VARCHAR(120) NOT NULL, slug VARCHAR(130) NOT NULL UNIQUE, description TEXT, logo VARCHAR(255), sort_order INT DEFAULT 0, visible INT DEFAULT 1",
        'products' => "id ID, sku VARCHAR(80) NOT NULL UNIQUE, name VARCHAR(255) NOT NULL, slug VARCHAR(255) NOT NULL UNIQUE, brand_id INT NULL, category_id INT NULL,
            short_description TEXT, description TEXT, specs TEXT, compatible TEXT, cost_price DECIMAL(12,2) NULL, price DECIMAL(12,2) NULL,
            sale_price DECIMAL(12,2) NULL, sale_ends DATE NULL, stock_status VARCHAR(20) DEFAULT 'in_stock', visible INT DEFAULT 1, featured INT DEFAULT 0, is_new INT DEFAULT 0, is_special INT DEFAULT 0,
            mpn VARCHAR(80), gtin VARCHAR(40), warranty VARCHAR(120), meta_title VARCHAR(255), meta_description TEXT, created_at DATETIME, updated_at DATETIME",
        'product_images' => "id ID, product_id INT NOT NULL, path VARCHAR(255) NOT NULL, thumb VARCHAR(255), alt VARCHAR(255), sort_order INT DEFAULT 0",
        'orders' => "id ID, ref VARCHAR(20) NOT NULL UNIQUE, token VARCHAR(64) NOT NULL, status VARCHAR(30) NOT NULL, payment_method VARCHAR(20) NOT NULL, payment_status VARCHAR(20) DEFAULT 'unpaid',
            customer_name VARCHAR(150), email VARCHAR(190), phone VARCHAR(40), company VARCHAR(150), customer_vat VARCHAR(40), delivery_method VARCHAR(20),
            address1 VARCHAR(255), address2 VARCHAR(255), city VARCHAR(120), province VARCHAR(60), postal_code VARCHAR(12), notes TEXT,
            subtotal DECIMAL(12,2), delivery_fee DECIMAL(12,2), total DECIMAL(12,2), pop_path VARCHAR(255), pop_uploaded_at DATETIME, pf_payment_id VARCHAR(60),
            courier VARCHAR(80), tracking_number VARCHAR(80), created_at DATETIME, updated_at DATETIME, paid_at DATETIME",
        'order_items' => "id ID, order_id INT NOT NULL, product_id INT NULL, sku VARCHAR(80), name VARCHAR(255), price DECIMAL(12,2), qty INT, line_total DECIMAL(12,2)",
        'order_history' => "id ID, order_id INT NOT NULL, status VARCHAR(30), note TEXT, notified INT DEFAULT 0, created_at DATETIME",
        'quotes' => "id ID, ref VARCHAR(20) NOT NULL, name VARCHAR(150), company VARCHAR(150), customer_type VARCHAR(40), email VARCHAR(190), phone VARCHAR(40),
            items TEXT, message TEXT, status VARCHAR(20) DEFAULT 'new', admin_notes TEXT, created_at DATETIME",
        'messages' => "id ID, name VARCHAR(150), email VARCHAR(190), phone VARCHAR(40), subject VARCHAR(190), message TEXT, handled INT DEFAULT 0, created_at DATETIME",
        'subscribers' => "id ID, email VARCHAR(190) NOT NULL UNIQUE, name VARCHAR(150), created_at DATETIME, ip VARCHAR(64)",
        'banners' => "id ID, title VARCHAR(190), subtitle TEXT, image VARCHAR(255), link_url VARCHAR(255), button_text VARCHAR(60), placement VARCHAR(20) DEFAULT 'hero',
            starts_on DATE NULL, ends_on DATE NULL, active INT DEFAULT 1, sort_order INT DEFAULT 0, created_at DATETIME",
        'documents' => "id ID, title VARCHAR(190) NOT NULL, description TEXT, file_path VARCHAR(255) NOT NULL, original_name VARCHAR(255), is_public INT DEFAULT 0, created_at DATETIME",
        'pages' => "id ID, slug VARCHAR(80) NOT NULL UNIQUE, title VARCHAR(190) NOT NULL, content TEXT, meta_description TEXT, updated_at DATETIME",
        'price_rules' => "id ID, brand_id INT NULL, category_id INT NULL, markup DECIMAL(6,2) NOT NULL, note VARCHAR(190), created_at DATETIME",
        'import_presets' => "id ID, name VARCHAR(120) NOT NULL UNIQUE, mapping TEXT, created_at DATETIME",
    ];
    $mysql = db_driver() === 'mysql';
    $out = [];
    foreach ($tables as $name => $cols) {
        $cols = str_replace('id ID', $mysql ? 'id INT AUTO_INCREMENT PRIMARY KEY' : 'id INTEGER PRIMARY KEY AUTOINCREMENT', $cols);
        $out[] = "CREATE TABLE IF NOT EXISTS $name ($cols)" . ($mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '');
    }
    $idx = [
        ['products', 'idx_products_cat', 'category_id'],
        ['products', 'idx_products_brand', 'brand_id'],
        ['products', 'idx_products_visible', 'visible'],
        ['product_images', 'idx_images_product', 'product_id'],
        ['order_items', 'idx_items_order', 'order_id'],
        ['order_history', 'idx_hist_order', 'order_id'],
    ];
    foreach ($idx as [$t, $n, $c]) {
        $out[] = $mysql ? "CREATE INDEX $n ON $t ($c)" : "CREATE INDEX IF NOT EXISTS $n ON $t ($c)";
    }
    return $out;
}

const SCHEMA_VERSION = '2';

/** Columns added after the first release: added to older databases automatically. */
function schema_upgrades(): array
{
    return [
        ['products', 'is_new', 'INT DEFAULT 0'],
        ['products', 'is_special', 'INT DEFAULT 0'],
    ];
}

function table_columns(string $table): array
{
    if (db_driver() === 'mysql') {
        return array_column(q_all("SHOW COLUMNS FROM $table"), 'Field');
    }
    return array_column(q_all("PRAGMA table_info($table)"), 'name');
}

/** Bring an existing database up to date (safe to run any number of times). */
function upgrade_schema(): void
{
    install_schema();
    foreach (schema_upgrades() as [$table, $col, $def]) {
        if (!in_array($col, table_columns($table), true)) {
            db()->exec("ALTER TABLE $table ADD COLUMN $col $def");
        }
    }
}

function install_schema(): void
{
    foreach (schema_sql() as $sql) {
        try {
            db()->exec($sql);
        } catch (PDOException $e) {
            // MySQL has no "IF NOT EXISTS" for indexes: ignore "duplicate index" errors on re-run.
            if (!str_contains($e->getMessage(), 'Duplicate key name')) {
                throw $e;
            }
        }
    }
}
