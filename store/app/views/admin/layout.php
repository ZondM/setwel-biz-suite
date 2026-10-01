<?php
$cur = '/' . trim(substr(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), strlen(base_path())), '/');
$is = fn($p) => $cur === $p || ($p !== '/admin' && str_starts_with($cur, $p . '/')) ? 'active' : '';
$newOrders = (int)q_val("SELECT COUNT(*) FROM orders WHERE status IN ('pending_payment','payment_review','processing')");
$newQuotes = (int)q_val("SELECT COUNT(*) FROM quotes WHERE status = 'new'");
$newMsgs = (int)q_val('SELECT COUNT(*) FROM messages WHERE handled = 0');
$pill = fn($n) => $n ? '<span class="pill">' . $n . '</span>' : '';
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= e($title ?? 'Admin') ?> — Setwel Africa admin</title>
<link rel="icon" type="image/png" href="<?= asset('assets/img/favicon.png') ?>">
<link rel="stylesheet" href="<?= asset('assets/css/admin.css') ?>">
</head>
<body>
<div class="mobile-bar"><strong>Setwel admin</strong><button type="button" onclick="document.querySelector('.side').classList.toggle('open')" aria-label="Menu">☰</button></div>
<div class="admin">
  <aside class="side">
    <a class="logo" href="<?= url('admin') ?>"><img src="<?= asset('assets/img/logo-256.jpg') ?>" alt="">SETWEL ADMIN</a>
    <nav>
      <a class="<?= $is('/admin') ?>" href="<?= url('admin') ?>">Dashboard</a>
      <div class="group">Products</div>
      <a class="<?= $is('/admin/products') ?>" href="<?= url('admin/products') ?>">All products</a>
      <a class="<?= $is('/admin/import') ?>" href="<?= url('admin/import') ?>">Import / update prices</a>
      <a class="<?= $is('/admin/images') ?>" href="<?= url('admin/images') ?>">Bulk images</a>
      <a class="<?= $is('/admin/catalog') ?>" href="<?= url('admin/catalog') ?>">Categories &amp; brands</a>
      <div class="group">Sales</div>
      <a class="<?= $is('/admin/orders') ?>" href="<?= url('admin/orders') ?>">Orders <?= $pill($newOrders) ?></a>
      <a class="<?= $is('/admin/quotes') ?>" href="<?= url('admin/quotes') ?>">Quote requests <?= $pill($newQuotes) ?></a>
      <a class="<?= $is('/admin/messages') ?>" href="<?= url('admin/messages') ?>">Messages <?= $pill($newMsgs) ?></a>
      <a class="<?= $is('/admin/subscribers') ?>" href="<?= url('admin/subscribers') ?>">Newsletter</a>
      <div class="group">Website</div>
      <a class="<?= $is('/admin/banners') ?>" href="<?= url('admin/banners') ?>">Banners &amp; specials</a>
      <a class="<?= $is('/admin/pages') ?>" href="<?= url('admin/pages') ?>">Pages</a>
      <a class="<?= $is('/admin/documents') ?>" href="<?= url('admin/documents') ?>">Certificates &amp; letters</a>
      <a class="<?= $is('/admin/settings') ?>" href="<?= url('admin/settings') ?>">Settings</a>
      <a class="<?= $is('/admin/account') ?>" href="<?= url('admin/account') ?>">My account</a>
      <a href="<?= url('/') ?>" target="_blank">View website ↗</a>
      <form method="post" action="<?= url('admin/logout') ?>" style="padding:10px 18px"><?= csrf_field() ?><button class="btn btn-sm" type="submit">Log out</button></form>
    </nav>
  </aside>
  <main class="main">
    <?php foreach (($flashes ?? []) as $f): ?><div class="alert alert-<?= e($f['type']) ?>"><?= e($f['message']) ?></div><?php endforeach; ?>
    <?= $content ?>
  </main>
</div>
<script>
document.querySelectorAll('[data-confirm]').forEach(function (el) {
  el.addEventListener('click', function (e) { if (!confirm(el.getAttribute('data-confirm'))) e.preventDefault(); });
});
var all = document.querySelector('[data-check-all]');
if (all) all.addEventListener('change', function () { document.querySelectorAll('input[name="ids[]"]').forEach(function (c) { c.checked = all.checked; }); });
var calc = document.querySelector('[data-calc-price]');
if (calc) calc.addEventListener('click', function () {
  var cost = parseFloat(document.querySelector('[name=cost_price]').value || '0');
  var m = parseFloat(calc.getAttribute('data-markup')), step = parseFloat(calc.getAttribute('data-step'));
  if (!cost) { alert('Type the supplier cost first.'); return; }
  var p = cost * (1 + m / 100); if (step > 0) p = Math.ceil(Math.round(p / step * 1e6) / 1e6) * step;
  document.querySelector('[name=price]').value = p.toFixed(2);
});
</script>
</body>
</html>
