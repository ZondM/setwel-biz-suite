<?php
/** @var array $l @var array $items @var bool $expired */
$wa = 'https://wa.me/' . wa_number(setting('whatsapp')) . '?text=' . rawurlencode('Hi, about my quote ' . $l['ref'] . ': ' . quote_url($l));
$share = 'https://wa.me/?text=' . rawurlencode('Quote ' . $l['ref'] . ' from ' . setting('business_name') . ': ' . quote_url($l));
?>
<div class="wrap" style="max-width:860px;margin-bottom:48px">
  <div class="quote-head">
    <div>
      <span class="eyebrow-dark">Quotation</span>
      <h1 style="margin-bottom:4px">Quote <?= e($l['ref']) ?></h1>
      <p class="muted" style="margin:0">For <?= e($l['name']) ?><?= $l['company'] ? ' · ' . e($l['company']) : '' ?> · <?= e(date('j F Y', strtotime($l['created_at']))) ?>
        <?php if ($l['valid_until']): ?>· <strong><?= $expired ? 'Expired ' : 'Valid until ' ?><?= e(date('j F Y', strtotime($l['valid_until']))) ?></strong><?php endif; ?></p>
    </div>
    <div class="quote-total"><span>Total</span><strong><?= money($l['total'] ?? 0, false) ?></strong></div>
  </div>
  <?php if ($items): ?>
    <table class="qb-table">
      <thead><tr><th>Product</th><th class="num">Price</th><th class="num">Qty</th><th class="num">Total</th></tr></thead>
      <tbody>
        <?php foreach ($items as $it): ?>
          <tr><td><strong><?= e($it['name']) ?></strong><br><small class="muted"><?= e($it['sku']) ?></small></td><td class="num"><?= money($it['price'], false) ?></td><td class="num"><?= (int)$it['qty'] ?></td><td class="num"><?= money($it['line_total'], false) ?></td></tr>
        <?php endforeach; ?>
      </tbody>
      <tfoot>
        <tr><td colspan="3">Subtotal</td><td class="num"><?= money($l['subtotal'], false) ?></td></tr>
        <tr><td colspan="3">Courier delivery <small class="muted">(free collection in Cape Town possible)</small></td><td class="num"><?= (float)$l['total'] - (float)$l['subtotal'] > 0 ? money((float)$l['total'] - (float)$l['subtotal'], false) : 'Free' ?></td></tr>
        <tr class="qb-total"><td colspan="3">Total</td><td class="num"><?= money($l['total'], false) ?></td></tr>
      </tfoot>
    </table>
  <?php endif; ?>
  <?php if ($l['needs_price']): ?>
    <div class="alert alert-info">Some items need a price or stock check from our team: <span style="white-space:pre-line"><?= e(trim(substr((string)$l['message'], (int)strpos((string)$l['message'], 'Needs a price')))) ?></span><br>We have been alerted and will send you an updated quote shortly.</div>
  <?php endif; ?>
  <div class="quote-actions">
    <?php if ($items && !$expired): ?><a class="btn btn-gold btn-lg" href="<?= e(quote_url($l, '/accept')) ?>"><?= icon('cart', 18) ?> Accept &amp; pay now</a><?php endif; ?>
    <?php if ($items): ?><a class="btn btn-outline btn-lg" href="<?= e(quote_url($l, '/pdf')) ?>" target="_blank"><?= icon('download', 18) ?> Download PDF</a><?php endif; ?>
    <a class="btn btn-wa btn-lg" data-track="wa_click" data-label="quote <?= e($l['ref']) ?>" href="<?= e($wa) ?>" target="_blank" rel="noopener"><?= icon('whatsapp', 18) ?> Questions? WhatsApp us</a>
  </div>
  <p class="hint">Pay by card, Instant EFT (PayFast) or bank EFT. <?= setting('vat_registered') === '1' ? 'Prices include VAT.' : 'Prices are final — we are not VAT registered.' ?> Need approval first? <a href="<?= e($share) ?>" target="_blank" rel="noopener">Share this quote on WhatsApp</a> or forward the PDF.</p>
</div>
