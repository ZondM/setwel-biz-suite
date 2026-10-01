<?php
/** Small general-purpose helpers used everywhere. */

function config(string $key, $default = null)
{
    return $GLOBALS['config'][$key] ?? $default;
}

/** Escape text for safe output in HTML. */
function e($value): string
{
    return htmlspecialchars((string)($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Folder the store lives in ('' when installed at the domain root). */
function base_path(): string
{
    static $base = null;
    if ($base === null) {
        $docRoot = realpath($_SERVER['DOCUMENT_ROOT'] ?? '') ?: '';
        $root = realpath(ROOT_DIR) ?: ROOT_DIR;
        if ($docRoot !== '' && str_starts_with($root, $docRoot)) {
            $base = str_replace('\\', '/', substr($root, strlen($docRoot)));
        } else {
            $base = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/'));
        }
        $base = rtrim($base, '/');
        if ($base === '.') {
            $base = '';
        }
    }
    return $base;
}

function url(string $path = '/', array $query = []): string
{
    $u = base_path() . '/' . ltrim($path, '/');
    if ($query) {
        $query = array_filter($query, fn($v) => $v !== null && $v !== '' && $v !== []);
        if ($query) {
            $u .= '?' . http_build_query($query);
        }
    }
    return $u;
}

/** Full URL including https://domain — needed for emails, PayFast, sitemap, feeds. */
function abs_url(string $path = '/', array $query = []): string
{
    $site = rtrim((string)setting('site_url', ''), '/');
    if ($site === '') {
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        $site = ($https ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'localhost') . base_path();
    }
    $u = $site . '/' . ltrim($path, '/');
    if ($query) {
        $u .= '?' . http_build_query($query);
    }
    return $u;
}

function asset(string $path): string
{
    $file = ROOT_DIR . '/' . ltrim($path, '/');
    $v = is_file($file) ? substr((string)filemtime($file), -6) : '1';
    return url($path) . '?v=' . $v;
}

/** URL for an uploaded file path stored in the database (e.g. "uploads/products/x.jpg"). */
function upload_url(?string $path): string
{
    if (!$path) {
        return asset('assets/img/placeholder.svg');
    }
    if (preg_match('#^https?://#', $path)) {
        return $path;
    }
    return url($path);
}

function redirect(string $to, int $code = 302): never
{
    if (!preg_match('#^https?://#', $to) && !str_starts_with($to, base_path() . '/')) {
        $to = url($to);
    }
    header('Location: ' . $to, true, $code);
    exit;
}

function back(string $fallback = '/'): never
{
    $ref = $_SERVER['HTTP_REFERER'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($ref && parse_url($ref, PHP_URL_HOST) === $host) {
        header('Location: ' . $ref);
        exit;
    }
    redirect($fallback);
}

/** Format a rand amount: R1 234.50 → "R1 234.50" (South African style, space as thousands separator). */
function money($amount, bool $cents = true): string
{
    $amount = (float)$amount;
    return 'R' . number_format($amount, $cents ? 2 : 0, '.', ' ');
}

function is_post(): bool
{
    return ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
}

function input(string $key, $default = '')
{
    $v = $_POST[$key] ?? $_GET[$key] ?? $default;
    return is_string($v) ? trim($v) : $v;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="_token" value="' . e(csrf_token()) . '">';
}

function csrf_check(): void
{
    $t = $_POST['_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!is_string($t) || !hash_equals(csrf_token(), $t)) {
        http_response_code(403);
        render('error', ['title' => 'Page expired', 'message' => 'Your session expired or the form was open too long. Please go back, refresh the page and try again.'], 'layout');
        exit;
    }
}

function flash(string $type, string $message): void
{
    $_SESSION['flash'][] = ['type' => $type, 'message' => $message];
}

function take_flashes(): array
{
    $f = $_SESSION['flash'] ?? [];
    unset($_SESSION['flash']);
    return $f;
}

/** Remember form input so it can be re-shown after a validation error. */
function keep_old(array $data): void
{
    $_SESSION['old'] = $data;
}

function old(string $key, $default = '')
{
    return $_SESSION['old_now'][$key] ?? $default;
}

function slugify(string $text): string
{
    $text = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text) ?: $text;
    $text = strtolower(preg_replace('/[^A-Za-z0-9]+/', '-', $text));
    return trim($text, '-') ?: 'item';
}

function random_ref(string $prefix, int $len = 6): string
{
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $s = '';
    for ($i = 0; $i < $len; $i++) {
        $s .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $prefix . '-' . $s;
}

function now(): string
{
    return date('Y-m-d H:i:s');
}

function client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

/**
 * Render a view file. $layout = 'layout' (shop), 'admin/layout' or null (no layout).
 */
function render(string $view, array $data = [], ?string $layout = 'layout'): void
{
    $data['flashes'] = $data['flashes'] ?? take_flashes();
    $_SESSION['old_now'] = $_SESSION['old'] ?? [];
    unset($_SESSION['old']);
    extract($data, EXTR_SKIP);
    ob_start();
    require APP_DIR . '/views/' . $view . '.php';
    $content = ob_get_clean();
    if ($layout) {
        require APP_DIR . '/views/' . $layout . '.php';
    } else {
        echo $content;
    }
}

/** Include a partial view. */
function partial(string $name, array $data = []): void
{
    extract($data, EXTR_SKIP);
    require APP_DIR . '/views/partials/' . $name . '.php';
}

function abort(int $code = 404, string $message = ''): never
{
    http_response_code($code);
    $title = $code === 404 ? 'Page not found' : 'Something went wrong';
    $message = $message ?: ($code === 404 ? 'Sorry, we could not find that page. Try the search box or browse our categories.' : 'Please try again in a moment.');
    render('error', ['title' => $title, 'message' => $message, 'meta' => ['robots' => 'noindex']]);
    exit;
}

function json_out($data, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function valid_email(string $email): bool
{
    return (bool)filter_var($email, FILTER_VALIDATE_EMAIL);
}

/** Normalise a South African phone number for WhatsApp links: 073 019 7093 → 27730197093 */
function wa_number(string $phone): string
{
    $d = preg_replace('/\D+/', '', $phone);
    if (str_starts_with($d, '0')) {
        $d = '27' . substr($d, 1);
    }
    return $d;
}

function log_message(string $file, string $message): void
{
    @file_put_contents(STORAGE_DIR . '/logs/' . $file . '.log', '[' . now() . '] ' . $message . "\n", FILE_APPEND);
}

function provinces(): array
{
    return ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'];
}

/** Simple honeypot spam check for public forms. */
function is_spam(): bool
{
    return !empty($_POST['website_url']);
}

function honeypot(): string
{
    return '<div class="hp" aria-hidden="true"><label>Leave empty<input type="text" name="website_url" tabindex="-1" autocomplete="off"></label></div>';
}

/** Basic rate limit stored in the session: max $max actions per $seconds. */
function rate_limited(string $key, int $max, int $seconds): bool
{
    $now = time();
    $hits = array_filter($_SESSION['rl'][$key] ?? [], fn($t) => $t > $now - $seconds);
    if (count($hits) >= $max) {
        return true;
    }
    $hits[] = $now;
    $_SESSION['rl'][$key] = array_values($hits);
    return false;
}
