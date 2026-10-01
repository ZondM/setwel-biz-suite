<div class="wrap">
  <div class="catalogue-head">
    <img src="<?= asset('assets/img/logo-256.jpg') ?>" alt="" width="64" height="64">
    <div>
      <h1><?= e(setting('business_name')) ?> specials — <?= e(date('F Y')) ?></h1>
      <p><?= e(setting('reseller_statement')) ?> · <?= e(setting('phone')) ?> · <?= e(setting('email')) ?></p>
    </div>
  </div>
  <p class="no-print">Prices valid while stocks last. <?= setting('vat_registered') === '1' ? 'Prices include VAT.' : 'Prices are final — we are not VAT registered.' ?> <button class="btn btn-ghost btn-sm" type="button" onclick="window.print()"><?= icon('download', 16) ?> Print / save as PDF catalogue</button></p>
  <?php if ($items): ?>
    <div class="grid" style="margin-bottom:40px"><?php foreach ($items as $p) { partial('card', ['p' => $p]); } ?></div>
  <?php else: ?>
    <div class="empty" style="margin-bottom:24px"><h2>New specials coming soon</h2><p class="muted">Join our newsletter (bottom of the page) to get them first. Meanwhile, here are our popular products.</p></div>
    <?php if ($featured): ?><div class="grid" style="margin-bottom:40px"><?php foreach ($featured as $p) { partial('card', ['p' => $p]); } ?></div><?php endif; ?>
  <?php endif; ?>
  <p class="hint" style="margin-bottom:40px">E&amp;OE. <?= e(setting('legal_name')) ?> · <?= e(abs_url('specials')) ?></p>
</div>
