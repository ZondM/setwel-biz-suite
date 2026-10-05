<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Set up your store — Setwel Africa</title>
<link rel="stylesheet" href="<?= asset('assets/css/admin.css') ?>">
</head>
<body class="auth-page">
<main class="auth-card wide">
  <img src="<?= asset('assets/img/logo-256.jpg') ?>" alt="" width="64" height="64" class="auth-logo">
  <h1>Set up your store</h1>
  <p class="muted">This page appears only once. Fill it in, click <strong>Install</strong>, and you are done.</p>

  <h2>1. Server check</h2>
  <ul class="checks">
    <?php foreach ($checks as $label => $ok): ?>
      <li class="<?= $ok ? 'ok' : 'bad' ?>"><?= $ok ? '✔' : '✘' ?> <?= e($label) ?></li>
    <?php endforeach; ?>
  </ul>

  <?php foreach ($errors as $err): ?><div class="alert alert-error"><?= e($err) ?></div><?php endforeach; ?>

  <form method="post" class="form">
    <input type="hidden" name="_token" value="<?= e($_SESSION['install_token']) ?>">
    <h2>2. Database</h2>
    <label class="radio"><input type="radio" name="db_driver" value="mysql" <?= $v['db_driver'] === 'mysql' ? 'checked' : '' ?>> MySQL (recommended on cPanel — create it first with “MySQL Database Wizard”)</label>
    <label class="radio"><input type="radio" name="db_driver" value="sqlite" <?= $v['db_driver'] === 'sqlite' ? 'checked' : '' ?>> SQLite (no setup needed — a single file in the private storage folder)</label>
    <div class="grid-2" id="mysql-fields">
      <label>Database host<input name="db_host" value="<?= e($v['db_host']) ?>"></label>
      <label>Database name<input name="db_name" value="<?= e($v['db_name']) ?>" placeholder="e.g. cpuser_setwel"></label>
      <label>Database user<input name="db_user" value="<?= e($v['db_user']) ?>" placeholder="e.g. cpuser_setwel"></label>
      <label>Database password<input name="db_pass" type="password" autocomplete="new-password"></label>
    </div>

    <h2>3. Website address</h2>
    <label>Site URL<input name="site_url" value="<?= e($v['site_url']) ?>" required></label>
    <p class="hint">Example: https://setwelafrica.com (no slash at the end).</p>

    <h2>4. Your admin login</h2>
    <div class="grid-2">
      <label>Your name<input name="admin_name" value="<?= e($v['admin_name']) ?>" required></label>
      <label>Email<input name="admin_email" type="email" value="<?= e($v['admin_email']) ?>" required></label>
      <label>Password (10+ characters, letters and numbers)<input name="admin_password" type="password" required autocomplete="new-password"></label>
      <label>Password again<input name="admin_password2" type="password" required autocomplete="new-password"></label>
    </div>

    <label class="check"><input type="checkbox" name="catalogue" value="1" <?= $v['catalogue'] ? 'checked' : '' ?>> Load the Setwel Africa product catalogue (642 products: ink &amp; toner, printers, storage, accessories, cleaning and more)</label>
    <label class="check"><input type="checkbox" name="sample" value="1" <?= $v['sample'] ? 'checked' : '' ?>> Add the 10 flyer products (Canon printers, toner, Kenton bags) as specials</label>
    <button class="btn btn-primary btn-lg" type="submit">Install</button>
  </form>
</main>
</body>
</html>
