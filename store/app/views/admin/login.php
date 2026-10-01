<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Admin login — Setwel Africa</title><link rel="stylesheet" href="<?= asset('assets/css/admin.css') ?>"></head>
<body class="auth-page">
<main class="auth-card">
  <img src="<?= asset('assets/img/logo-256.jpg') ?>" alt="" width="56" height="56" class="auth-logo">
  <h1>Admin login</h1>
  <?php if (!empty($_GET['installed'])): ?><div class="alert alert-success">Your store is installed. Log in with the email and password you just chose.</div><?php endif; ?>
  <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>
  <form method="post" class="form">
    <?= csrf_field() ?>
    <label>Email<input type="email" name="email" required autocomplete="username" autofocus value="<?= e($_POST['email'] ?? '') ?>"></label>
    <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
    <button class="btn btn-primary btn-lg" type="submit">Log in</button>
  </form>
  <p class="hint" style="margin-top:14px"><a href="<?= url('/') ?>">← Back to the website</a></p>
</main>
</body></html>
