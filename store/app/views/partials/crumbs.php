<?php if (!empty($crumbs)): ?>
<nav class="crumbs" aria-label="Breadcrumb"><ol>
  <li><a href="<?= url('/') ?>">Home</a></li>
  <?php foreach ($crumbs as [$name, $link]): ?>
    <li><?php if ($link): ?><a href="<?= e($link) ?>"><?= e($name) ?></a><?php else: ?><span aria-current="page"><?= e($name) ?></span><?php endif; ?></li>
  <?php endforeach; ?>
</ol></nav>
<?php endif; ?>
