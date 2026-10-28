<?php
/**
 * Owner's licence desk: setwelbusiness.co.za/api/admin.php
 *
 * For customers who pay by EFT, partner deals, or fixing a problem by hand:
 * create a key, add months, or switch a key off. Protected by ADMIN_PASSWORD
 * in config.php. If that is empty, this page is disabled.
 */

require __DIR__ . '/config.php';
require __DIR__ . '/payfast.php';
require __DIR__ . '/licences.php';

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

$pw = (string)($_POST['pw'] ?? '');
$authed = defined('ADMIN_PASSWORD') && ADMIN_PASSWORD !== '' && hash_equals(ADMIN_PASSWORD, $pw);
$message = '';

function e($v): string
{
    return htmlspecialchars((string)$v, ENT_QUOTES);
}

if ($authed && ($_POST['do'] ?? '') === 'create') {
    $email = trim($_POST['email'] ?? '');
    $months = max(1, (int)($_POST['months'] ?? 1));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $message = 'Enter a valid email.';
    } else {
        $lic = lic_create([
            'plan' => $_POST['plan'] ?? 'grinder',
            'billing' => 'manual',
            'name' => trim($_POST['name'] ?? ''),
            'email' => $email,
            'phone' => trim($_POST['phone'] ?? ''),
            'period' => "+{$months} months",
        ]);
        if (!empty($_POST['send'])) lic_email_new($lic);
        pf_log('Admin created licence ' . $lic['key'], ['email' => $email, 'months' => $months]);
        $message = "Created {$lic['key']} (referral code {$lic['ref_code']}), paid to " . date('j M Y', strtotime($lic['paid_until'])) . (!empty($_POST['send']) ? '. Emailed to the customer.' : '.');
    }
}

if ($authed && in_array($_POST['do'] ?? '', ['extend', 'revoke', 'restore'], true)) {
    $lic = lic_get((string)($_POST['key'] ?? ''));
    if (!$lic) {
        $message = 'Key not found.';
    } elseif ($_POST['do'] === 'extend') {
        $months = max(1, (int)($_POST['months'] ?? 1));
        $lic = lic_extend($lic, "+{$months} months");
        $lic['status'] = 'active';
        lic_save($lic);
        $message = "{$lic['key']} now paid to " . date('j M Y', strtotime($lic['paid_until'])) . '.';
    } else {
        $lic['status'] = $_POST['do'] === 'revoke' ? 'revoked' : 'active';
        lic_save($lic);
        $message = "{$lic['key']} is now {$lic['status']}.";
    }
    pf_log('Admin ' . $_POST['do'] . ' ' . ($lic['key'] ?? ''), []);
}

$recent = [];
if ($authed) {
    foreach (glob(lic_dir() . '/*.json') as $f) {
        $l = json_decode(file_get_contents($f), true);
        if (is_array($l)) $recent[] = $l;
    }
    usort($recent, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));
    $recent = array_slice($recent, 0, 100);
}
?>
<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Licence desk</title>
<link rel="stylesheet" href="/assets/site.css">
<style>
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { border-bottom: 1px solid var(--line); padding: 8px 6px; text-align: left; vertical-align: top; }
  .scroll { overflow-x: auto; }
  form.inline { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); align-items: end; }
  .msg { background: #effaf4; border: 1px solid #bfe5cf; padding: 12px; border-radius: 6px; margin: 12px 0; }
</style>
</head>
<body>
<section><div class="wrap">
<h2>Licence desk</h2>
<?php if (!defined('ADMIN_PASSWORD') || ADMIN_PASSWORD === ''): ?>
  <p>Disabled. Set ADMIN_PASSWORD in api/config.php to use this page.</p>
<?php elseif (!$authed): ?>
  <form method="post" class="box">
    <label for="pw">Password</label>
    <input id="pw" name="pw" type="password" autofocus>
    <p><button class="btn btn-green">Open</button></p>
    <?php if ($pw !== ''): ?><p style="color:#b42318">Wrong password.</p><?php endif; ?>
  </form>
<?php else: ?>
  <?php if ($message): ?><div class="msg"><?= e($message) ?></div><?php endif; ?>

  <h3>New licence (EFT payment, partner, or a favour)</h3>
  <form method="post" class="inline">
    <input type="hidden" name="pw" value="<?= e($pw) ?>">
    <input type="hidden" name="do" value="create">
    <div><label>Name</label><input name="name"></div>
    <div><label>Email</label><input name="email" type="email" required></div>
    <div><label>Phone</label><input name="phone"></div>
    <div><label>Plan</label>
      <select name="plan">
        <option value="hustler">Hustler</option><option value="grinder" selected>Grinder</option>
        <option value="builder">Builder</option><option value="enterprise">Enterprise</option>
        <option value="accountant_partner">Accountant Partner</option>
      </select></div>
    <div><label>Months</label><input name="months" type="number" min="1" value="1"></div>
    <div><label><input type="checkbox" name="send" value="1" checked style="width:auto"> Email key to customer</label></div>
    <div><button class="btn btn-green">Create key</button></div>
  </form>

  <h3 style="margin-top:28px">Change a key</h3>
  <form method="post" class="inline">
    <input type="hidden" name="pw" value="<?= e($pw) ?>">
    <div><label>Key</label><input name="key" placeholder="SETW-XXXX-XXXX-XXXX" required></div>
    <div><label>Months to add</label><input name="months" type="number" min="1" value="1"></div>
    <div><button class="btn btn-green" name="do" value="extend">Add months</button></div>
    <div><button class="btn btn-plain" name="do" value="revoke">Switch off</button></div>
    <div><button class="btn btn-plain" name="do" value="restore">Switch on</button></div>
  </form>

  <h3 style="margin-top:28px">Latest licences</h3>
  <div class="scroll"><table>
    <tr><th>Key</th><th>Customer</th><th>Plan</th><th>Paid to</th><th>Status</th><th>Referral code</th><th>Referrals</th></tr>
    <?php foreach ($recent as $l): ?>
    <tr>
      <td><?= e($l['key']) ?></td>
      <td><?= e($l['name']) ?><br><?= e($l['email']) ?><br><?= e($l['phone']) ?></td>
      <td><?= e(lic_plan_name($l['plan'])) ?> (<?= e($l['billing']) ?>)</td>
      <td><?= e(date('j M Y', strtotime($l['paid_until']))) ?></td>
      <td><?= e($l['status']) ?></td>
      <td><?= e($l['ref_code']) ?></td>
      <td><?= e($l['referral_credits'] ?? 0) ?></td>
    </tr>
    <?php endforeach; ?>
  </table></div>
<?php endif; ?>
</div></section>
</body>
</html>
