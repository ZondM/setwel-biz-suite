<?php
/**
 * Setwel partner accountants (for the "Find an accountant" page and the app).
 * GET  -> public list: firm, contact name, city, province, phone, email, website, services.
 * POST -> a business asking for setup / training; emailed to Setwel and to the partner if one was chosen.
 * Partners are added and removed by the owner in the licence desk (api/admin.php).
 */

require __DIR__ . '/config.php';
require __DIR__ . '/payfast.php';
require __DIR__ . '/usage.php';

function partners_file(): string
{
    return pf_data_dir() . '/partners.json';
}

function partners_all(): array
{
    $f = partners_file();
    $all = file_exists($f) ? json_decode(file_get_contents($f), true) : [];
    return is_array($all) ? $all : [];
}

$public = function (array $p): array {
    return [
        'id' => $p['id'],
        'firm' => $p['firm'] ?? '',
        'name' => $p['name'] ?? '',
        'city' => $p['city'] ?? '',
        'province' => $p['province'] ?? '',
        'phone' => $p['phone'] ?? '',
        'email' => $p['email'] ?? '',
        'website' => $p['website'] ?? '',
        'services' => $p['services'] ?? [],
        'languages' => $p['languages'] ?? '',
    ];
};

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=300');
    $list = array_values(array_filter(partners_all(), fn($p) => !empty($p['listed'])));
    usort($list, fn($a, $b) => strcasecmp(($a['province'] ?? '') . ($a['firm'] ?? ''), ($b['province'] ?? '') . ($b['firm'] ?? '')));
    echo json_encode(array_map($public, $list));
    exit;
}

// ---- Request for setup / training ----
$in = app_input(20000);
$clean = fn($v, $max) => substr(trim(str_replace(["\r", "\0"], ' ', strip_tags((string)$v))), 0, $max);
$req = [
    'business' => $clean($in['business'] ?? '', 120),
    'name' => $clean($in['name'] ?? '', 80),
    'phone' => $clean($in['phone'] ?? '', 30),
    'email' => $clean($in['email'] ?? '', 120),
    'province' => $clean($in['province'] ?? '', 40),
    'need' => $clean($in['need'] ?? '', 60),
    'message' => $clean($in['message'] ?? '', 1500),
    'partner' => $clean($in['partner'] ?? '', 40),
];
if ($req['name'] === '' || ($req['phone'] === '' && !filter_var($req['email'], FILTER_VALIDATE_EMAIL))) {
    app_reply(400, ['error' => 'Please give your name and a phone number or email address.']);
}
if (usage_take('partner-requests-' . date('Y-m-d'), client_ip(), 5) === null) {
    app_reply(429, ['error' => 'Too many requests today. Please WhatsApp us on 082 082 9050.']);
}

$partner = null;
foreach (partners_all() as $p) {
    if (($p['id'] ?? '') === $req['partner'] && !empty($p['listed'])) $partner = $p;
}

$body = "A business has asked for help with Setwel.\n\n"
    . "Business: {$req['business']}\nContact: {$req['name']}\nPhone: {$req['phone']}\nEmail: {$req['email']}\n"
    . "Province: {$req['province']}\nNeeds: {$req['need']}\n\n{$req['message']}\n";
$subject = 'Setwel setup / training request: ' . ($req['business'] ?: $req['name']);
$headers = "From: Setwel <no-reply@setwelbusiness.co.za>\r\nContent-Type: text/plain; charset=UTF-8";
if (filter_var($req['email'], FILTER_VALIDATE_EMAIL)) $headers .= "\r\nReply-To: {$req['email']}";

if (defined('NOTIFY_EMAIL') && NOTIFY_EMAIL !== '') {
    @mail(NOTIFY_EMAIL, $subject, $body . ($partner ? "\nSent to partner: {$partner['firm']} <{$partner['email']}>\n" : "\nNo partner chosen: please assign one.\n"), $headers);
}
if ($partner && filter_var($partner['email'] ?? '', FILTER_VALIDATE_EMAIL)) {
    @mail($partner['email'], $subject, "Hi {$partner['name']},\n\nA business found you on setwelbusiness.co.za and would like your help.\n\n" . $body . "\nPlease contact them within one business day.\n\nThe Setwel team", $headers);
}
pf_log('Partner request', ['business' => $req['business'], 'partner' => $partner['id'] ?? '']);
app_reply(200, ['ok' => true, 'partner' => $partner ? $partner['firm'] : null]);
