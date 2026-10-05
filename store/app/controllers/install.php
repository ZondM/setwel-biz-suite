<?php
/**
 * One-time setup wizard. Shown automatically until app/config.php exists.
 * It creates the database tables, your admin login and (optionally) the sample products.
 */
function install_controller(): void
{
    session_start();
    $errors = [];
    $checks = [
        'PHP 8.1 or newer' => PHP_VERSION_ID >= 80100,
        'PDO database support' => extension_loaded('pdo'),
        'SQLite or MySQL driver' => extension_loaded('pdo_sqlite') || extension_loaded('pdo_mysql'),
        'ZIP support (Excel import)' => class_exists('ZipArchive'),
        'XML support (Excel import)' => function_exists('simplexml_load_string'),
        'GD images (photo resizing)' => function_exists('imagecreatefromstring'),
        'cURL (PayFast checks)' => function_exists('curl_init'),
        'app/ folder writable' => is_writable(APP_DIR),
        'storage/ folder writable' => is_writable(STORAGE_DIR),
        'uploads/ folder writable' => is_writable(UPLOAD_DIR),
    ];
    $v = [
        'db_driver' => $_POST['db_driver'] ?? (extension_loaded('pdo_mysql') ? 'mysql' : 'sqlite'),
        'db_host' => $_POST['db_host'] ?? 'localhost',
        'db_name' => $_POST['db_name'] ?? '',
        'db_user' => $_POST['db_user'] ?? '',
        'site_url' => $_POST['site_url'] ?? ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'localhost') . base_path()),
        'admin_name' => $_POST['admin_name'] ?? '',
        'admin_email' => $_POST['admin_email'] ?? '',
        'sample' => isset($_POST['db_driver']) ? !empty($_POST['sample']) : true,
        'catalogue' => isset($_POST['db_driver']) ? !empty($_POST['catalogue']) : true,
    ];

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
        if (!hash_equals($_SESSION['install_token'] ?? '', $_POST['_token'] ?? '')) {
            $errors[] = 'Form expired — please try again.';
        }
        if (!valid_email($v['admin_email'])) {
            $errors[] = 'Enter a valid admin email address.';
        }
        if ($p = password_problem($_POST['admin_password'] ?? '')) {
            $errors[] = $p;
        }
        if (($_POST['admin_password'] ?? '') !== ($_POST['admin_password2'] ?? '')) {
            $errors[] = 'The two passwords do not match.';
        }
        if (trim($v['admin_name']) === '') {
            $errors[] = 'Enter your name.';
        }
        $config = [
            'db_driver' => $v['db_driver'] === 'mysql' ? 'mysql' : 'sqlite',
            'db_host' => $v['db_host'],
            'db_port' => 3306,
            'db_name' => $v['db_name'],
            'db_user' => $v['db_user'],
            'db_pass' => $_POST['db_pass'] ?? '',
            'db_file' => 'store-' . bin2hex(random_bytes(6)) . '.sqlite',
            'debug' => false,
        ];
        if (!$errors) {
            $GLOBALS['config'] = $config;
            try {
                db();
                install_schema();
            } catch (Throwable $e) {
                $errors[] = 'Could not connect to the database: ' . $e->getMessage();
                $GLOBALS['config'] = null;
            }
        }
        if (!$errors) {
            require_once APP_DIR . '/seed.php';
            setting_save('site_url', rtrim($v['site_url'], '/'));
            if (!q_val('SELECT COUNT(*) FROM admins')) {
                admin_create(trim($v['admin_name']), $v['admin_email'], $_POST['admin_password']);
            }
            if (!q_val('SELECT COUNT(*) FROM categories')) {
                seed_basics();
            }
            if ($v['sample']) {
                seed_products();
            }
            if ($v['catalogue']) {
                @set_time_limit(300);
                seed_catalogue();
            }
            setting_save('schema_version', SCHEMA_VERSION);
            $php = "<?php\n// Created by the setup wizard on " . date('Y-m-d H:i') . ". Keep this file private.\nreturn " . var_export($config, true) . ";\n";
            if (file_put_contents(APP_DIR . '/config.php', $php) === false) {
                $errors[] = 'Could not write app/config.php — check folder permissions (755) in cPanel File Manager.';
            } else {
                @chmod(APP_DIR . '/config.php', 0640);
                header('Location: ' . url('admin/login') . '?installed=1');
                exit;
            }
        }
    }
    $_SESSION['install_token'] = $_SESSION['install_token'] ?? bin2hex(random_bytes(16));
    require APP_DIR . '/views/install.php';
}
