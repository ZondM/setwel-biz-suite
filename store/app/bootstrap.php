<?php
/**
 * Loads configuration, the database and all helper libraries.
 * Every request goes through index.php, which includes this file.
 */
declare(strict_types=1);

define('APP_DIR', __DIR__);
define('ROOT_DIR', dirname(__DIR__));
define('STORAGE_DIR', ROOT_DIR . '/storage');
define('UPLOAD_DIR', ROOT_DIR . '/uploads');

if (PHP_VERSION_ID < 80100) {
    http_response_code(500);
    exit('This store needs PHP 8.1 or newer. In cPanel open "Select PHP Version" and choose 8.1, 8.2 or 8.3.');
}

$configFile = APP_DIR . '/config.php';
$GLOBALS['config'] = is_file($configFile) ? require $configFile : null;

$debug = (bool)($GLOBALS['config']['debug'] ?? false);
error_reporting(E_ALL);
ini_set('display_errors', $debug ? '1' : '0');
ini_set('log_errors', '1');
ini_set('error_log', STORAGE_DIR . '/logs/php-errors.log');
date_default_timezone_set('Africa/Johannesburg');
mb_internal_encoding('UTF-8');

foreach (['helpers', 'db', 'settings', 'auth', 'catalog', 'cart', 'mailer', 'pdf', 'spreadsheet', 'importer', 'payfast', 'images', 'text', 'orders', 'icons'] as $lib) {
    require APP_DIR . '/lib/' . $lib . '.php';
}

if ($GLOBALS['config']) {
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('setwel_sess');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    if (PHP_SAPI !== 'cli') {
        session_start();
    }
}
