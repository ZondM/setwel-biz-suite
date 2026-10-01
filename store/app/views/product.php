<?php
$price = effective_price($p);
$sale = sale_active($p);
$shareText = $p['name'] . ($price > 0 ? ' — ' . money($price, false) : '') . ' ' . abs_url('product/' . $p['slug']);
$wa = wa_number(setting('whatsapp'));
?>
<div class="wrap">
  <?php partial('crumbs', ['crumbs' => $crumbs]); ?>
  <div class="product">
    <div>
      <div class="gallery-main">
        <img id="main-image" src="<?= upload_url($images[0]['path'] ?? null) ?>" alt="<?= e($p['name']) ?>" width="600" height="600" fetchpriority="high">
      </div>
      <?php if (count($images) > 1): ?>
        <div class="thumbs">
          <?php foreach ($images as $i => $img): ?>
            <button type="button" class="<?= $i === 0 ? 'active' : '' ?>" data-thumb="<?= upload_url($img['path']) ?>" aria-label="Show image <?= $i + 1 ?>"><img src="<?= upload_url($img['thumb'] ?: $img['path']) ?>" alt="" loading="lazy"></button>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>

    <div>
      <?php if ($p['brand_name']): ?><a class="p-brand" href="<?= url('brand/' . $p['brand_slug']) ?>"><?= e($p['brand_name']) ?></a><?php endif; ?>
      <h1><?= e($p['name']) ?></h1>
      <div class="p-meta">
        <span>SKU: <strong><?= e($p['sku']) ?></strong></span>
        <?php if ($p['mpn'] && $p['mpn'] !== $p['sku']): ?><span>Model: <strong><?= e($p['mpn']) ?></strong></span><?php endif; ?>
        <span class="stock stock-<?= e($p['stock_status']) ?>"><?= e(stock_statuses()[$p['stock_status']] ?? '') ?></span>
      </div>
      <?php if ($p['short_description']): ?><p><?= e($p['short_description']) ?></p><?php endif; ?>

      <div class="p-box">
        <?php if ($price > 0): ?>
          <div>
            <span class="p-price"><?= money($price) ?></span>
            <?php if ($sale): ?><span class="price-old"><?= money($p['price']) ?></span> <span class="p-save">Save <?= money((float)$p['price'] - $price, false) ?></span><?php endif; ?>
            <div class="hint"><?= setting('vat_registered') === '1' ? 'Incl. VAT' : 'Final price — no VAT added' ?><?= $sale && $p['sale_ends'] ? ' · Special ends ' . e(date('j F Y', strtotime($p['sale_ends']))) : '' ?></div>
          </div>
        <?php else: ?>
          <div><span class="p-price" style="font-size:1.4rem">Price on request</span><div class="hint">Send a quick quote request and we will reply within one working day.</div></div>
        <?php endif; ?>

        <?php if (can_buy($p)): ?>
          <form action="<?= url('cart/add') ?>" method="post" class="qty-row">
            <?= csrf_field() ?>
            <input type="hidden" name="product_id" value="<?= (int)$p['id'] ?>">
            <div class="qty">
              <button type="button" data-step="-1" aria-label="Fewer">−</button>
              <label class="sr-only" for="qty">Quantity</label>
              <input id="qty" type="number" name="qty" value="1" min="1" max="999" inputmode="numeric">
              <button type="button" data-step="1" aria-label="More">+</button>
            </div>
            <button class="btn btn-primary btn-lg" type="submit" style="flex:1"><?= icon('cart') ?> Add to cart</button>
          </form>
        <?php endif; ?>
        <div class="p-actions">
          <a class="btn btn-outline" href="<?= url('quote', ['product' => $p['id']]) ?>"><?= icon('file', 18) ?> Request a quote</a>
          <a class="btn btn-wa" href="https://wa.me/<?= e($wa) ?>?text=<?= rawurlencode('Hi ' . setting('business_name') . ', I am interested in: ' . $p['name'] . ' (' . $p['sku'] . ') ' . abs_url('product/' . $p['slug'])) ?>" target="_blank" rel="noopener"><?= icon('whatsapp', 18) ?> Ask on WhatsApp</a>
        </div>
      </div>

      <ul class="p-points">
        <li><?= icon('check', 18) ?> Genuine product<?= $p['warranty'] ? ' · ' . e($p['warranty']) : ' with manufacturer warranty' ?></li>
        <li><?= icon('check', 18) ?> Nationwide delivery <?= money(setting('delivery_fee'), false) ?> · free over <?= money(setting('free_delivery_threshold'), false) ?></li>
        <?php if (setting('allow_collection') === '1'): ?><li><?= icon('check', 18) ?> Free collection in Cape Town</li><?php endif; ?>
        <li><?= icon('check', 18) ?> Pay securely with PayFast or EFT</li>
      </ul>
      <p style="margin-top:16px">
        <a class="btn btn-ghost btn-sm" href="https://wa.me/?text=<?= rawurlencode($shareText) ?>" target="_blank" rel="noopener"><?= icon('whatsapp', 16) ?> Share on WhatsApp</a>
        <button class="btn btn-ghost btn-sm" type="button" data-share><?= icon('share', 16) ?> Share</button>
      </p>
    </div>
  </div>

  <div class="tabs detail-grid">
    <div>
      <?php if ($p['description']): ?>
        <h2>Description</h2>
        <div class="prose"><?= format_text($p['description']) ?></div>
      <?php endif; ?>
      <?php if ($compatible): ?>
        <h2>Compatible printers</h2>
        <p class="muted">This product works with the following printers:</p>
        <ul class="compat-list">
          <?php foreach ($compatible as $c): ?><li><a href="<?= url('search', ['q' => $c]) ?>"><?= e($c) ?></a></li><?php endforeach; ?>
        </ul>
      <?php endif; ?>
    </div>
    <div>
      <?php if ($specs): ?>
        <h2>Specifications</h2>
        <table class="spec-table">
          <tbody>
            <?php if ($p['brand_name']): ?><tr><th scope="row">Brand</th><td><?= e($p['brand_name']) ?></td></tr><?php endif; ?>
            <?php foreach ($specs as [$k, $v]): ?><tr><th scope="row"><?= e($k ?: '—') ?></th><td><?= e($v) ?></td></tr><?php endforeach; ?>
            <?php if ($p['warranty']): ?><tr><th scope="row">Warranty</th><td><?= e($p['warranty']) ?></td></tr><?php endif; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
  </div>

  <?php if ($supplies): ?>
    <section class="section" aria-labelledby="sup-h">
      <div class="section-head"><h2 id="sup-h">Ink &amp; toner for this printer</h2></div>
      <div class="grid"><?php foreach ($supplies as $r) { partial('card', ['p' => $r]); } ?></div>
    </section>
  <?php endif; ?>
  <?php if ($related): ?>
    <section class="section" aria-labelledby="rel-h">
      <div class="section-head"><h2 id="rel-h">You may also like</h2></div>
      <div class="grid"><?php foreach ($related as $r) { partial('card', ['p' => $r]); } ?></div>
    </section>
  <?php endif; ?>
</div>
