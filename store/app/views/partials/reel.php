<?php /** Moving "video-style" reel of weekly specials for the home page hero. @var array $items */ $n = count($items); ?>
<div class="reel" data-reel aria-roledescription="carousel" aria-label="Weekly specials">
  <div class="reel-bars" aria-hidden="true"><?php for ($i = 0; $i < $n; $i++): ?><span><i></i></span><?php endfor; ?></div>
  <div class="reel-top"><span class="reel-live"><i></i> Weekly specials</span><a href="<?= url('weekly-specials') ?>">See all <?= $n ?> →</a></div>
  <div class="reel-frames">
    <?php foreach ($items as $i => $p): $sale = sale_active($p); $price = effective_price($p); ?>
      <div class="reel-frame<?= $i === 0 ? ' active' : '' ?>" aria-roledescription="slide" aria-label="<?= $i + 1 ?> of <?= $n ?>">
        <a class="reel-visual" href="<?= product_url($p) ?>" tabindex="-1"><?php partial('visual', ['p' => $p]); ?></a>
        <div class="reel-info">
          <span class="reel-brand"><?= e($p['brand_name']) ?></span>
          <a class="reel-name" href="<?= product_url($p) ?>"><?= e($p['name']) ?></a>
          <div class="reel-price">
            <?php if ($price > 0): ?><strong><?= money($price, false) ?></strong><?php if ($sale): ?><s><?= money($p['price'], false) ?></s><?php endif; ?><?php else: ?><strong>Ask for price</strong><?php endif; ?>
          </div>
          <?php if ($sale): ?><span class="reel-save">Save <?= (int)round(100 * (1 - (float)$p['sale_price'] / (float)$p['price'])) ?>%</span><?php endif; ?>
          <?php if (can_buy($p)): ?>
            <form action="<?= url('cart/add') ?>" method="post" class="reel-buy"><?= csrf_field() ?><input type="hidden" name="product_id" value="<?= (int)$p['id'] ?>"><input type="hidden" name="qty" value="1"><button class="btn btn-gold" type="submit" name="buy_now" value="1">Buy now</button><button class="btn btn-ghost-light" type="submit" aria-label="Add <?= e($p['name']) ?> to cart"><?= icon('cart', 18) ?></button></form>
          <?php else: ?>
            <a class="btn btn-gold" href="<?= url('quote', ['product' => $p['id']]) ?>">Get a quote</a>
          <?php endif; ?>
        </div>
      </div>
    <?php endforeach; ?>
  </div>
</div>
