<div class="wrap">
  <?php partial('crumbs', ['crumbs' => [['New in Market', null]]]); ?>
  <section class="section" style="padding-top:20px">
    <div class="listing-top"><div><h1>New in Market</h1><p class="muted" style="margin:4px 0 0"><?= count($items) ?> new product<?= count($items) === 1 ? '' : 's' ?> — the latest models from our brands.</p></div></div>
    <?php if ($items): ?>
      <div class="grid"><?php foreach ($items as $p) { partial('card', ['p' => $p]); } ?></div>
    <?php else: ?>
      <div class="empty"><h2>New products coming soon</h2><p class="muted">Join our newsletter at the bottom of the page to hear first.</p></div>
    <?php endif; ?>
  </section>
</div>
