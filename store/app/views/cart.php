<?php $threshold = (float)setting('free_delivery_threshold'); ?>
<div class="wrap">
  <?php partial('crumbs', ['crumbs' => [['Cart', null]]]); ?>
  <?php if (!$lines): ?>
    <div class="section center"><h1>Your cart is empty</h1><p class="muted">Find genuine printers, ink and toner in our shop.</p><a class="btn btn-primary" href="<?= url('shop') ?>">Start shopping</a></div>
  <?php else: ?>
  <div class="cart-layout">
    <div>
      <h1>Your cart</h1>
      <form method="post" action="<?= url('cart/update') ?>">
        <?= csrf_field() ?>
        <table class="cart-table">
          <thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Total</th><th><span class="sr-only">Remove</span></th></tr></thead>
          <tbody>
          <?php foreach ($lines as $l): $p = $l['product']; ?>
            <tr>
              <td><div class="cart-item"><img src="<?= upload_url($p['thumb'] ?: $p['image']) ?>" alt="" loading="lazy"><div><a href="<?= product_url($p) ?>"><?= e($p['name']) ?></a><br><small class="muted">SKU <?= e($p['sku']) ?></small></div></div></td>
              <td><?= money($l['price']) ?></td>
              <td><label class="sr-only" for="q<?= (int)$p['id'] ?>">Quantity</label><input id="q<?= (int)$p['id'] ?>" type="number" name="qty[<?= (int)$p['id'] ?>]" value="<?= (int)$l['qty'] ?>" min="0" max="999" style="width:80px"></td>
              <td><strong><?= money($l['total']) ?></strong></td>
              <td><button class="btn btn-ghost btn-sm" name="remove" value="<?= (int)$p['id'] ?>" aria-label="Remove <?= e($p['name']) ?>"><?= icon('x', 16) ?></button></td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
        <p style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost" type="submit">Update cart</button> <a class="btn btn-ghost" href="<?= url('shop') ?>">Continue shopping</a> <a class="btn btn-ghost" href="<?= url('quote', ['cart' => 1]) ?>">Get a formal quote for this cart</a></p>
      </form>
    </div>
    <aside class="summary">
      <h2 style="font-size:1.2rem">Order summary</h2>
      <div class="summary-row"><span>Subtotal</span><strong><?= money($totals['subtotal']) ?></strong></div>
      <div class="summary-row"><span>Courier delivery</span><span><?= $totals['delivery'] > 0 ? money($totals['delivery']) : 'Free' ?></span></div>
      <?php if ($threshold > 0 && $totals['subtotal'] < $threshold): ?>
        <div class="free-note">Add <strong><?= money($threshold - $totals['subtotal']) ?></strong> more for <strong>free delivery</strong>.<div class="progress"><span style="width:<?= min(100, round($totals['subtotal'] / $threshold * 100)) ?>%"></span></div></div>
      <?php elseif ($threshold > 0): ?>
        <div class="free-note">🎉 Your order qualifies for <strong>free delivery</strong>.</div>
      <?php endif; ?>
      <div class="summary-row summary-total"><span>Total</span><span><?= money($totals['total']) ?></span></div>
      <p class="hint"><?= setting('allow_collection') === '1' ? 'Free collection in Cape Town available at checkout. ' : '' ?><?= setting('vat_registered') === '1' ? 'Prices include VAT.' : 'No VAT is added (not VAT registered).' ?></p>
      <a class="btn btn-gold btn-lg btn-block" href="<?= url('checkout') ?>">Checkout securely</a>
    </aside>
  </div>
  <?php endif; ?>
</div>
