<h1>Bulk images</h1>
<div class="help">
  <strong>Add photos to many products at once:</strong>
  <ol>
    <li>Name each photo file with the product's <strong>SKU</strong>, e.g. <code>CMF3010.jpg</code>. Extra photos: <code>CMF3010-2.jpg</code>, <code>CMF3010-3.jpg</code>.</li>
    <li>Choose all the files below and click Upload. Matching products get the photos automatically.</li>
  </ol>
  Your server accepts up to <strong><?= e($max) ?></strong> files per upload (max <?= e($maxSize) ?> each, <?= e($postMax) ?> in total). Upload in batches if you have more.
</div>
<?php if ($report): ?>
  <div class="card">
    <h2>Result</h2>
    <p><strong><?= count($report['ok']) ?></strong> photo(s) attached.</p>
    <?php if ($report['unmatched']): ?><div class="alert alert-warn">No product with this SKU: <?= e(implode(', ', $report['unmatched'])) ?></div><?php endif; ?>
    <?php if ($report['bad']): ?><div class="alert alert-error">Not valid images: <?= e(implode(', ', $report['bad'])) ?></div><?php endif; ?>
    <?php if ($report['ok']): ?><details><summary>Show details</summary><ul><?php foreach ($report['ok'] as $l): ?><li><?= e($l) ?></li><?php endforeach; ?></ul></details><?php endif; ?>
  </div>
<?php endif; ?>
<form method="post" enctype="multipart/form-data" class="card form">
  <?= csrf_field() ?>
  <label>Photos<input type="file" name="images[]" accept="image/*" multiple required></label>
  <label class="check"><input type="checkbox" name="replace" value="1"> Replace the existing photos of these products</label>
  <button class="btn btn-primary btn-lg">Upload photos</button>
</form>
