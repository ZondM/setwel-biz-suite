<div class="wrap">
  <?php partial('crumbs', ['crumbs' => [[$page['title'], null]]]); ?>
  <article class="section prose" style="padding-top:20px">
    <h1><?= e($page['title']) ?></h1>
    <?= format_text(fill_placeholders((string)$page['content'])) ?>
    <p class="hint">Last updated <?= e(date('j F Y', strtotime($page['updated_at'] ?: 'now'))) ?></p>
  </article>
</div>
