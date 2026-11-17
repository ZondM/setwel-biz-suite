<?php
/** @var array $items @var string $ends */
$brands = [];
foreach ($items as $p) {
    $b = $p['brand_name'] ?: 'Other';
    $brands[$b] = ($brands[$b] ?? 0) + 1;
}
$endsTs = $ends ? strtotime($ends . ' 23:59:59') : 0;
?>
<section class="weekly-hero">
  <div class="wrap weekly-hero-inner">
    <div>
      <span class="eyebrow">This week only</span>
      <h1>Weekly Specials</h1>
      <p>Deals on genuine HP, Riso and Brother cartridges. New specials every week, while stocks last.</p>
    </div>
    <?php if ($items && !$endsTs): ?>
      <div class="countdown"><span class="countdown-label">Limited stock</span><span class="countdown-stock">While stocks last</span></div>
    <?php elseif ($items): ?>
      <div class="countdown" data-countdown="<?= $endsTs * 1000 ?>">
        <span class="countdown-label">Specials end <?= e(date('l j F', $endsTs)) ?></span>
        <span class="countdown-clock" aria-hidden="true"><span><b data-d>0</b>days</span><span><b data-h>0</b>hrs</span><span><b data-m>0</b>min</span><span><b data-s>0</b>sec</span></span>
      </div>
    <?php endif; ?>
  </div>
</section>

<?php partial('weekly_ticker', ['items' => $items]); ?>

<div class="wrap">
  <?php if (!$items): ?>
    <div class="empty" style="margin:32px 0"><h2>This week’s specials are loading soon</h2><p class="muted">Check back shortly, or see our <a href="<?= url('specials') ?>">other specials</a>. WhatsApp <?= e(setting('whatsapp')) ?> for a price on any cartridge.</p></div>
  <?php else: ?>
    <div class="showcase" data-showcase aria-roledescription="carousel" aria-label="Weekly specials showcase">
      <div class="showcase-track">
        <?php foreach ($items as $i => $p): $sale = sale_active($p); $price = effective_price($p); ?>
          <div class="showcase-slide<?= $i === 0 ? ' active' : '' ?>" aria-roledescription="slide" aria-label="<?= $i + 1 ?> of <?= count($items) ?>">
            <a class="showcase-img" href="<?= product_url($p) ?>" tabindex="-1"><img src="<?= upload_url($p['image'] ?: $p['thumb']) ?>" alt="<?= e($p['name']) ?>" <?= $i ? 'loading="lazy"' : '' ?> width="420" height="420"></a>
            <div class="showcase-info">
              <span class="showcase-brand"><?= e($p['brand_name']) ?></span>
              <h2><a href="<?= product_url($p) ?>"><?= e($p['name']) ?></a></h2>
              <?php if ($p['short_description']): ?><p class="muted"><?= e($p['short_description']) ?></p><?php endif; ?>
              <div class="showcase-price">
                <?php if ($price > 0): ?>
                  <span class="price"><?= money($price, false) ?></span>
                  <?php if ($sale): ?><span class="price-old"><?= money($p['price'], false) ?></span><span class="save">Save <?= money((float)$p['price'] - (float)$p['sale_price'], false) ?> (<?= (int)round(100 * (1 - (float)$p['sale_price'] / (float)$p['price'])) ?>%)</span><?php endif; ?>
                <?php else: ?><span class="price-quote">Price on request</span><?php endif; ?>
              </div>
              <div class="showcase-actions">
                <?php if (can_buy($p)): ?>
                  <form action="<?= url('cart/add') ?>" method="post"><?= csrf_field() ?><input type="hidden" name="product_id" value="<?= (int)$p['id'] ?>"><input type="hidden" name="qty" value="1"><button class="btn btn-gold btn-lg" type="submit"><?= icon('cart', 18) ?> Add to cart</button></form>
                <?php else: ?>
                  <a class="btn btn-gold btn-lg" href="<?= url('quote', ['product' => $p['id']]) ?>">Request a quote</a>
                <?php endif; ?>
                <a class="btn btn-outline btn-lg" href="<?= product_url($p) ?>">Details</a>
              </div>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
      <?php if (count($items) > 1): ?>
        <button class="showcase-nav prev" type="button" data-prev aria-label="Previous special">‹</button>
        <button class="showcase-nav next" type="button" data-next aria-label="Next special">›</button>
        <div class="showcase-dots"><?php foreach ($items as $i => $p): ?><button type="button" class="<?= $i === 0 ? 'active' : '' ?>" aria-label="Show special <?= $i + 1 ?>"></button><?php endforeach; ?></div>
      <?php endif; ?>
    </div>

    <div class="brand-tabs" role="tablist" aria-label="Filter by brand">
      <button type="button" class="active" data-brand-tab="">All (<?= count($items) ?>)</button>
      <?php foreach ($brands as $b => $n): ?><button type="button" data-brand-tab="<?= e($b) ?>"><?= e($b) ?> (<?= $n ?>)</button><?php endforeach; ?>
    </div>
    <div class="grid" style="margin-bottom:24px">
      <?php foreach ($items as $p): ?><div class="grid-item" data-brand="<?= e($p['brand_name'] ?: 'Other') ?>"><?php partial('card', ['p' => $p]); ?></div><?php endforeach; ?>
    </div>
    <p class="hint" style="margin-bottom:40px"><?= $endsTs ? 'Valid until ' . e(date('j F Y', $endsTs)) . ' or while stocks last.' : 'While stocks last.' ?> <?= setting('vat_registered') === '1' ? 'Prices include VAT.' : 'Prices are final — we are not VAT registered.' ?> E&amp;OE.</p>
  <?php endif; ?>
</div>
