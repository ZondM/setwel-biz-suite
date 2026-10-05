<?php
$meta = $meta ?? [];
$biz = setting('business_name');
$pageTitle = isset($meta['title']) ? $meta['title'] . ' | ' . $biz : setting('home_title');
$desc = $meta['description'] ?? setting('home_description');
$canonical = $meta['canonical'] ?? abs_url(substr((string)parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), strlen(base_path())) ?: '/');
$ogImage = $meta['image'] ?? abs_url('assets/img/logo-512.jpg');
$cats = categories_visible();
$wa = wa_number(setting('whatsapp'));
$current = '/' . trim(substr(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), strlen(base_path())), '/');
$strip = q_one("SELECT * FROM banners WHERE active = 1 AND placement = 'strip' AND (starts_on IS NULL OR starts_on <= ?) AND (ends_on IS NULL OR ends_on >= ?) ORDER BY sort_order LIMIT 1", [date('Y-m-d'), date('Y-m-d')]);
$orgSchema = [
    '@context' => 'https://schema.org', '@type' => 'Store', 'name' => setting('legal_name') ?: $biz, 'url' => abs_url('/'),
    'logo' => abs_url('assets/img/logo-512.jpg'), 'image' => abs_url('assets/img/logo-512.jpg'), 'telephone' => setting('phone'), 'email' => setting('email'),
    'priceRange' => 'R', 'currenciesAccepted' => 'ZAR',
    'address' => ['@type' => 'PostalAddress', 'streetAddress' => explode("\n", setting('address'))[0] ?? '', 'addressLocality' => 'Cape Town', 'addressRegion' => 'Western Cape', 'addressCountry' => 'ZA'],
];
?><!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($pageTitle) ?></title>
<meta name="description" content="<?= e(excerpt($desc, 160)) ?>">
<link rel="canonical" href="<?= e($canonical) ?>">
<?php if (!empty($meta['robots'])): ?><meta name="robots" content="<?= e($meta['robots']) ?>"><?php endif; ?>
<meta property="og:site_name" content="<?= e($biz) ?>">
<meta property="og:title" content="<?= e($meta['title'] ?? $pageTitle) ?>">
<meta property="og:description" content="<?= e(excerpt($desc, 200)) ?>">
<meta property="og:type" content="<?= e($meta['type'] ?? 'website') ?>">
<meta property="og:url" content="<?= e($canonical) ?>">
<meta property="og:image" content="<?= e($ogImage) ?>">
<meta property="og:locale" content="en_ZA">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1a2f45">
<link rel="icon" type="image/png" href="<?= asset('assets/img/favicon.png') ?>">
<link rel="apple-touch-icon" href="<?= asset('assets/img/apple-touch-icon.png') ?>">
<link rel="stylesheet" href="<?= asset('assets/css/site.css') ?>">
<script type="application/ld+json"><?= json_encode($orgSchema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?></script>
<?php foreach (($meta['schema'] ?? []) as $schema): ?>
<script type="application/ld+json"><?= json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?></script>
<?php endforeach; ?>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<?php if (setting('announcement')): ?><div class="announce"><?= e(setting('announcement')) ?></div><?php endif; ?>
<div class="topbar">
  <div class="wrap">
    <span class="reseller-pill"><?= icon('award', 16) ?> <?= e(setting('reseller_statement')) ?></span>
    <span class="links">
      <a href="tel:<?= e(preg_replace('/\s+/', '', setting('phone'))) ?>" class="hide-sm"><?= e(setting('phone')) ?></a>
      <a href="https://wa.me/<?= e($wa) ?>" rel="noopener" target="_blank">WhatsApp <?= e(setting('whatsapp')) ?></a>
      <a href="mailto:<?= e(setting('email')) ?>" class="hide-sm"><?= e(setting('email')) ?></a>
    </span>
  </div>
</div>
<header class="header">
  <div class="wrap">
    <a class="brand" href="<?= url('/') ?>" aria-label="<?= e($biz) ?> home">
      <img src="<?= asset('assets/img/logo-256.jpg') ?>" alt="" width="46" height="46">
      <span class="brand-name">SETWEL AFRICA<small><?= e(setting('bbbee_statement') ?: 'South Africa') ?></small></span>
    </a>
    <div class="search" data-suggest>
      <form action="<?= url('search') ?>" method="get" role="search">
        <label for="q" class="sr-only">Search products</label>
        <input id="q" type="search" name="q" value="<?= e($_GET['q'] ?? '') ?>" placeholder="Search printers, toner, model numbers…" autocomplete="off" aria-autocomplete="list" aria-controls="suggest-box">
        <button type="submit" aria-label="Search"><?= icon('search') ?></button>
      </form>
      <div class="suggest" id="suggest-box" role="listbox" hidden></div>
    </div>
    <div class="header-actions">
      <a class="icon-btn hide-sm" href="<?= url('contact') ?>"><?= icon('phone') ?> Contact</a>
      <a class="icon-btn hide-sm" href="<?= url('quote') ?>"><?= icon('file') ?> Quote</a>
      <a class="icon-btn" href="<?= url('cart') ?>" aria-label="Cart, <?= cart_count() ?> items"><?= icon('cart', 22) ?><span class="hide-sm">Cart</span><?php if (cart_count()): ?><span class="badge-count"><?= cart_count() ?></span><?php endif; ?></a>
      <button class="icon-btn menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" data-menu><?= icon('menu', 22) ?><span class="sr-only">Menu</span></button>
    </div>
  </div>
</header>
<nav class="nav" id="main-nav" aria-label="Main">
  <div class="wrap">
    <ul>
      <li><a href="<?= url('shop') ?>" class="<?= $current === '/shop' ? 'active' : '' ?>">All products</a></li>
      <?php foreach ($cats as $c): if (!$c['product_count']) continue; ?>
        <li><a href="<?= url('category/' . $c['slug']) ?>" class="<?= $current === '/category/' . $c['slug'] ? 'active' : '' ?>"><?= e($c['name']) ?></a></li>
      <?php endforeach; ?>
      <li class="nav-new"><a href="<?= url('new') ?>">New in Market</a></li>
      <li class="nav-special"><a href="<?= url('specials') ?>">Specials</a></li>
    </ul>
  </div>
</nav>
<?php if ($strip): ?>
<div class="strip-banner"><div class="wrap"><strong><?= e($strip['title']) ?></strong> <?= e($strip['subtitle']) ?> <?php if ($strip['link_url']): ?><a class="btn btn-sm btn-primary" href="<?= e(str_starts_with($strip['link_url'], '/') ? url($strip['link_url']) : $strip['link_url']) ?>"><?= e($strip['button_text'] ?: 'View') ?></a><?php endif; ?></div></div>
<?php endif; ?>

<main id="main">
  <?php if (!empty($flashes)): ?><div class="wrap flashes"><?php foreach ($flashes as $f): ?><div class="alert alert-<?= e($f['type']) ?>" role="status"><?= e($f['message']) ?></div><?php endforeach; ?></div><?php endif; ?>
  <?= $content ?>
</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <a class="brand" href="<?= url('/') ?>" style="color:#fff"><img src="<?= asset('assets/img/logo-256.jpg') ?>" alt="" width="46" height="46" loading="lazy"><span class="brand-name" style="color:#fff">SETWEL AFRICA</span></a>
        <p style="margin-top:12px"><?= e(setting('tagline')) ?></p>
        <div class="reseller"><?= e(setting('reseller_statement')) ?> · <a href="<?= url('credentials') ?>">View credentials</a></div>
      </div>
      <div>
        <h3>Shop</h3>
        <ul>
          <?php foreach ($cats as $c): if (!$c['product_count']) continue; ?><li><a href="<?= url('category/' . $c['slug']) ?>"><?= e($c['name']) ?></a></li><?php endforeach; ?>
          <li><a href="<?= url('new') ?>">New in Market</a></li>
          <li><a href="<?= url('specials') ?>">Specials</a></li>
        </ul>
      </div>
      <div>
        <h3>Help</h3>
        <ul>
          <li><a href="<?= url('quote') ?>">Request a quote</a></li>
          <li><a href="<?= url('contact') ?>">Contact us</a></li>
          <li><a href="<?= url('page/delivery-returns') ?>">Delivery &amp; returns</a></li>
          <li><a href="<?= url('page/warranty') ?>">Warranty</a></li>
          <li><a href="<?= url('page/about') ?>">About us</a></li>
          <li><a href="<?= url('page/privacy') ?>">Privacy (POPIA)</a></li>
          <li><a href="<?= url('page/terms') ?>">Terms &amp; conditions</a></li>
          <li><a href="#" data-cookie-open>Cookie settings</a></li>
        </ul>
      </div>
      <div>
        <h3>Contact</h3>
        <ul>
          <li><a href="tel:<?= e(preg_replace('/\s+/', '', setting('phone'))) ?>"><?= e(setting('phone')) ?></a></li>
          <li><a href="https://wa.me/<?= e($wa) ?>" target="_blank" rel="noopener">WhatsApp <?= e(setting('whatsapp')) ?></a></li>
          <li><a href="mailto:<?= e(setting('email')) ?>"><?= e(setting('email')) ?></a></li>
          <li><?= nl2br(e(setting('address'))) ?></li>
          <li><?= e(setting('hours')) ?></li>
        </ul>
        <form class="newsletter" action="<?= url('newsletter') ?>" method="post" style="margin-top:16px">
          <?= csrf_field() ?><?= honeypot() ?>
          <label for="nl-email" class="sr-only">Email for specials newsletter</label>
          <input id="nl-email" type="email" name="email" placeholder="Email me the monthly specials" required>
          <button class="btn btn-gold" type="submit">Join</button>
        </form>
        <p class="hint" style="color:#9fb0c2;margin-top:6px">Unsubscribe any time. See our <a href="<?= url('page/privacy') ?>">privacy policy</a>.</p>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© <?= date('Y') ?> <?= e(setting('legal_name')) ?><?= setting('registration_number') ? ' · Reg. ' . e(setting('registration_number')) : '' ?><?= setting('vat_registered') !== '1' ? ' · Not VAT registered — prices are final' : '' ?></span>
      <span class="pay-icons"><span>PayFast</span><span>Visa</span><span>Mastercard</span><span>Instant EFT</span><span>EFT</span></span>
    </div>
  </div>
</footer>

<a class="wa-float" href="https://wa.me/<?= e($wa) ?>?text=<?= rawurlencode('Hi ' . $biz . ', I have a question about ') ?>" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"><?= icon('whatsapp', 30) ?></a>

<div class="cookie" id="cookie" role="dialog" aria-labelledby="cookie-title" aria-live="polite">
  <p id="cookie-title"><strong>Cookies &amp; your privacy (POPIA)</strong><br>We use essential cookies to run your cart and checkout. With your permission we also use analytics and advertising cookies to improve the shop. See our <a href="<?= url('page/privacy') ?>">privacy policy</a>.</p>
  <div class="btns">
    <button class="btn btn-primary btn-sm" type="button" data-consent="all">Accept all</button>
    <button class="btn btn-ghost btn-sm" type="button" data-consent="essential">Essential only</button>
  </div>
</div>
<script>
window.STORE = {
  base: <?= json_encode(base_path()) ?>,
  ga: <?= json_encode(setting('ga4_id')) ?>,
  pixel: <?= json_encode(setting('meta_pixel_id')) ?>,
  events: <?= json_encode($meta['events'] ?? []) ?>
};
</script>
<script src="<?= asset('assets/js/site.js') ?>" defer></script>
</body>
</html>
