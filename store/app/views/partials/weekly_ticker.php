<?php /** Moving strip of this week's specials. @var array $items */ if (!$items) return; ?>
<a class="ticker" href="<?= url('weekly-specials') ?>" aria-label="Weekly specials — view all">
  <span class="ticker-label"><?= icon('tag', 16) ?> Weekly specials</span>
  <span class="ticker-viewport" aria-hidden="true">
    <span class="ticker-track">
      <?php for ($copy = 0; $copy < 2; $copy++): foreach ($items as $p): $sale = sale_active($p); ?>
        <span class="ticker-item"><?php if ($p['brand_name'] && stripos($p['name'], $p['brand_name']) !== 0): ?><strong><?= e($p['brand_name']) ?></strong> <?php endif; ?><?= e($p['name']) ?> <b><?= money(effective_price($p), false) ?></b><?php if ($sale): ?> <s><?= money($p['price'], false) ?></s><?php endif; ?></span>
      <?php endforeach; endfor; ?>
    </span>
  </span>
</a>
