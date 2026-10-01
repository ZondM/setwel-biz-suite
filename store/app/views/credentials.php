<div class="wrap">
  <?php partial('crumbs', ['crumbs' => [['Credentials', null]]]); ?>
  <section class="section" style="padding-top:20px">
    <h1>Authorised reseller credentials</h1>
    <p class="prose"><?= e(setting('reseller_details')) ?></p>
    <?php if ($docs): ?>
      <div class="docs-grid">
        <?php foreach ($docs as $d): ?>
          <div class="doc-card">
            <strong style="color:var(--navy)"><?= icon('award', 18) ?> <?= e($d['title']) ?></strong>
            <?php if ($d['description']): ?><span class="muted"><?= e($d['description']) ?></span><?php endif; ?>
            <a class="btn btn-outline btn-sm" href="<?= url('credentials/' . $d['id']) ?>" target="_blank" rel="noopener">View document</a>
          </div>
        <?php endforeach; ?>
      </div>
    <?php else: ?>
      <p class="muted">Copies of our authorisation letters and certificates are available on request — email <a href="mailto:<?= e(setting('email')) ?>"><?= e(setting('email')) ?></a>.</p>
    <?php endif; ?>
  </section>
</div>
