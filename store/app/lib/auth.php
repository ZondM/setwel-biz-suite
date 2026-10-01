<?php
/** Admin login. Passwords are stored hashed (never in plain text). */

function admin_user(): ?array
{
    static $user = false;
    if ($user === false) {
        $user = null;
        if (!empty($_SESSION['admin_id'])) {
            $user = q_one('SELECT id, name, email FROM admins WHERE id = ?', [$_SESSION['admin_id']]);
            // Log out after 8 hours without activity.
            if ($user && (time() - ($_SESSION['admin_seen'] ?? 0)) > 8 * 3600) {
                $user = null;
                unset($_SESSION['admin_id']);
            }
            if ($user) {
                $_SESSION['admin_seen'] = time();
            }
        }
    }
    return $user;
}

function require_admin(): array
{
    $u = admin_user();
    if (!$u) {
        $_SESSION['after_login'] = $_SERVER['REQUEST_URI'] ?? url('/admin');
        redirect('/admin/login');
    }
    header('X-Robots-Tag: noindex, nofollow');
    header('Cache-Control: no-store');
    return $u;
}

function admin_login(string $email, string $password): bool|string
{
    $ip = client_ip();
    $since = date('Y-m-d H:i:s', time() - 15 * 60);
    $fails = (int)q_val('SELECT COUNT(*) FROM login_attempts WHERE (ip = ? OR email = ?) AND attempted_at > ?', [$ip, $email, $since]);
    if ($fails >= 5) {
        return 'Too many failed attempts. Please wait 15 minutes and try again.';
    }
    $u = q_one('SELECT * FROM admins WHERE email = ?', [strtolower($email)]);
    if (!$u || !password_verify($password, $u['password_hash'])) {
        db_insert('login_attempts', ['ip' => $ip, 'email' => $email, 'attempted_at' => now()]);
        return 'Wrong email or password.';
    }
    session_regenerate_id(true);
    $_SESSION['admin_id'] = (int)$u['id'];
    $_SESSION['admin_seen'] = time();
    q('UPDATE admins SET last_login = ? WHERE id = ?', [now(), $u['id']]);
    q('DELETE FROM login_attempts WHERE email = ?', [$email]);
    return true;
}

function admin_create(string $name, string $email, string $password): int
{
    return db_insert('admins', [
        'name' => $name,
        'email' => strtolower($email),
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'created_at' => now(),
    ]);
}

function password_problem(string $pw): ?string
{
    if (strlen($pw) < 10) {
        return 'Password must be at least 10 characters.';
    }
    if (!preg_match('/[A-Za-z]/', $pw) || !preg_match('/\d/', $pw)) {
        return 'Password must contain letters and numbers.';
    }
    return null;
}
