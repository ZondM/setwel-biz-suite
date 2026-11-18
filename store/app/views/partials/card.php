<?php /** @var array $p  @var bool $buy  show a "Buy now" button that goes straight to checkout */ $buy = !empty($buy); $price = effective_price($p); $sale = sale_active($p); ?>
<article class="card">
  <?php if ($sale): ?><span class="tag">SAVE <?= money((float)$p['price'] - (float)$p['sale_price'], false) ?></span><?php elseif (!empty($p['is_special'])): ?><span class="tag">SPECIAL</span><?php elseif (!empty($p['is_new'])): ?><span class="tag tag-navy">NEW</span><?php elseif ($p['featured']): ?><span class="tag tag-gold">POPULAR</span><?php endif; ?>
  <a class="card-img" href="<?= product_url($p) ?>" tabindex="-1" aria-hidden="true">
    <?php if ($buy && !$p['thumb'] && !$p['image']): partial('visual', ['p' => $p]); else: ?><img src="<?= upload_url($p['thumb'] ?: $p['image']) ?>" alt="" loading="lazy" width="300" height="300"><?php endif; ?>
  </a>
  <div class="card-body">
    <?php if ($p['brand_name']): ?><span class="card-brand"><?= e($p['brand_name']) ?></span><?php endif; ?>
    <h3 class="card-title"><a href="<?= product_url($p) ?>"><?= e($p['name']) ?></a></h3>
    <div class="card-foot">
      <div>
        <?php if ($price > 0): ?>
          <span class="price"><?= money($price, false) ?></span><?php if ($sale): ?><span class="price-old"><?= money($p['price'], false) ?></span><?php endif; ?>
        <?php else: ?>
          <span class="price-quote">Price on request</span>
        <?php endif; ?>
        <div><span class="stock stock-<?= e($p['stock_status']) ?>"><?= e(stock_label($p)) ?></span></div>
      </div>
      <?php if (can_buy($p)): ?>
        <form action="<?= url('cart/add') ?>" method="post">
          <?= csrf_field() ?><input type="hidden" name="product_id" value="<?= (int)$p['id'] ?>"><input type="hidden" name="qty" value="1">
          <?php if ($buy): ?>
            <div class="card-buy"><button class="btn btn-gold btn-sm" type="submit" name="buy_now" value="1">Buy now</button><button class="btn btn-primary btn-sm" type="submit" aria-label="Add to cart"><?= icon('cart', 16) ?></button></div>
          <?php else: ?>
            <button class="btn btn-primary btn-sm btn-block" type="submit"><?= icon('cart', 16) ?> Add to cart</button>
          <?php endif; ?>
        </form>
      <?php else: ?>
        <div class="card-actions"><a class="btn btn-outline btn-sm btn-block" href="<?= url('quote', ['product' => $p['id']]) ?>">Request a quote</a></div>
      <?php endif; ?>
    </div>
  </div>
</article>
