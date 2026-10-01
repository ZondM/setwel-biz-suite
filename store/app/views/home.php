<?php
$link = fn($u) => $u && str_starts_with($u, '/') ? url($u) : $u;
$catIcons = ['printer' => 'printer', 'drop' => 'drop', 'scan' => 'scan', 'bag' => 'bag', 'usb' => 'usb', 'ssd' => 'ssd', 'paper' => 'paper', 'plug' => 'plug'];
?>
<section class="hero" aria-label="Highlights">
  <div class="hero-slides">
    <?php if (!$banners) { $banners = [['title' => 'Genuine printers, ink & toner — delivered nationwide', 'subtitle' => setting('home_description'), 'link_url' => '/shop', 'button_text' => 'Shop now', 'image' => null]]; } ?>
    <?php foreach ($banners as $i => $b): ?>
      <div class="hero-slide<?= $i === 0 ? ' active' : '' ?>">
        <div class="wrap hero-inner">
          <div>
            <span class="eyebrow"><?= e(setting('reseller_statement')) ?></span>
            <?= $i === 0 ? '<h1>' : '<h2>' ?><?= e($b['title']) ?><?= $i === 0 ? '</h1>' : '</h2>' ?>
            <?php if ($b['subtitle']): ?><p><?= e($b['subtitle']) ?></p><?php endif; ?>
            <div class="hero-actions">
              <?php if ($b['link_url']): ?><a class="btn btn-gold btn-lg" href="<?= e($link($b['link_url'])) ?>"><?= e($b['button_text'] ?: 'Shop now') ?></a><?php endif; ?>
              <a class="btn btn-outline btn-lg" href="<?= url('quote') ?>">Request a business quote</a>
            </div>
          </div>
          <div class="hero-media">
            <?php if (!empty($b['image'])): ?>
              <img src="<?= upload_url($b['image']) ?>" alt="" <?= $i === 0 ? 'fetchpriority="high"' : 'loading="lazy"' ?>>
            <?php else: ?>
              <div class="hero-card">
                <ul>
                  <li><?= icon('shield', 22) ?><span><strong>Genuine products</strong><br>New stock with full manufacturer warranty</span></li>
                  <li><?= icon('truck', 22) ?><span><strong>Nationwide delivery</strong><br>Free on orders over <?= money(setting('free_delivery_threshold'), false) ?></span></li>
                  <li><?= icon('file', 22) ?><span><strong>Quotes &amp; invoices</strong><br>For businesses, schools and government</span></li>
                  <li><?= icon('lock', 22) ?><span><strong>Secure payment</strong><br>PayFast card, Instant EFT or bank EFT</span></li>
                </ul>
              </div>
            <?php endif; ?>
          </div>
        </div>
      </div>
    <?php endforeach; ?>
  </div>
  <div class="hero-dots"></div>
</section>

<section class="section" aria-labelledby="cat-h">
  <div class="wrap">
    <div class="section-head"><div><h2 id="cat-h">Shop by category</h2><p>Everything your office, school or home office needs.</p></div><a class="more" href="<?= url('shop') ?>">All products →</a></div>
    <div class="cat-grid">
      <?php foreach ($categories as $c): ?>
        <a class="cat-tile" href="<?= url('category/' . $c['slug']) ?>">
          <span class="ico"><?= icon($catIcons[$c['icon']] ?? 'grid', 26) ?></span>
          <span><strong><?= e($c['name']) ?></strong><small><?= (int)$c['product_count'] ?> product<?= (int)$c['product_count'] === 1 ? '' : 's' ?></small></span>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<?php if ($deals): ?>
<section class="section section-soft" aria-labelledby="deals-h">
  <div class="wrap">
    <div class="section-head"><div><h2 id="deals-h">This month’s specials</h2><p>Limited-time prices while stocks last.</p></div><a class="more" href="<?= url('specials') ?>">All specials →</a></div>
    <div class="grid"><?php foreach ($deals as $p) { partial('card', ['p' => $p]); } ?></div>
  </div>
</section>
<?php endif; ?>

<?php if ($featured): ?>
<section class="section" aria-labelledby="feat-h">
  <div class="wrap">
    <div class="section-head"><div><h2 id="feat-h">Popular products</h2><p>Hand-picked printers and accessories our customers love.</p></div><a class="more" href="<?= url('shop') ?>">Shop all →</a></div>
    <div class="grid"><?php foreach ($featured as $p) { partial('card', ['p' => $p]); } ?></div>
  </div>
</section>
<?php endif; ?>

<section class="section section-soft" aria-labelledby="brand-h">
  <div class="wrap">
    <div class="section-head"><div><h2 id="brand-h">Brands we supply</h2><p><?= e(setting('reseller_statement')) ?></p></div><a class="more" href="<?= url('credentials') ?>">Our credentials →</a></div>
    <div class="brand-grid">
      <?php foreach ($brands as $b): ?>
        <a class="brand-tile" href="<?= url('brand/' . $b['slug']) ?>">
          <?php if ($b['logo'] && setting('show_brand_logos') === '1'): ?><img src="<?= upload_url($b['logo']) ?>" alt="<?= e($b['name']) ?>" loading="lazy"><?php else: ?><?= e($b['name']) ?><?php endif; ?>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="trust-h">
  <div class="wrap">
    <h2 id="trust-h" class="sr-only">Why buy from us</h2>
    <div class="trust">
      <div class="trust-item"><?= icon('award', 24) ?><div><strong>Authorised reseller</strong><span>Genuine stock from official channels, with manufacturer warranty.</span></div></div>
      <div class="trust-item"><?= icon('truck', 24) ?><div><strong>Delivered nationwide</strong><span>Courier to your door. Free over <?= money(setting('free_delivery_threshold'), false) ?>. Or collect in Cape Town.</span></div></div>
      <div class="trust-item"><?= icon('file', 24) ?><div><strong>Business &amp; school quotes</strong><span>Formal quotes and invoices for procurement and bulk orders.</span></div></div>
      <div class="trust-item"><?= icon('store', 24) ?><div><strong><?= e(setting('bbbee_statement') ?: 'Local South African business') ?></strong><span>Real people, local support: <?= e(setting('phone')) ?>.</span></div></div>
    </div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="wrap">
    <div class="cta">
      <div>
        <h2>Buying for a business, school or department?</h2>
        <p>Send us your list — we’ll reply with a formal quote within one working day. Bulk pricing available.</p>
      </div>
      <div class="btns">
        <a class="btn btn-gold btn-lg" href="<?= url('quote') ?>">Request a quote</a>
        <a class="btn btn-wa btn-lg" href="https://wa.me/<?= e(wa_number(setting('whatsapp'))) ?>" target="_blank" rel="noopener"><?= icon('whatsapp', 20) ?> WhatsApp us</a>
      </div>
    </div>
  </div>
</section>
