<div class="topline"><h1>Banners &amp; monthly specials</h1><a class="btn btn-primary" href="<?= url('admin/banners/new') ?>">+ New banner</a></div>
<div class="help">
  <strong>Monthly specials in 3 steps:</strong>
  <ol>
    <li>Give products a <strong>sale price</strong> and <strong>sale end date</strong> (edit a product, or use the “Sale price” and “Sale ends” columns in your import file). Right now <strong><?= $onSale ?></strong> product(s) are on special.</li>
    <li>Create or edit a <strong>banner</strong> below (e.g. “October specials”) with link <code>/specials</code> and an end date.</li>
    <li>Your <a href="<?= url('specials') ?>" target="_blank">Specials page</a> fills itself — customers can also print it or save it as a PDF catalogue.</li>
  </ol>
  Banners switch on and off by themselves using the start and end dates.
</div>
<div class="table-wrap"><table class="t">
  <thead><tr><th></th><th>Title</th><th>Where</th><th>Dates</th><th>Status</th><th></th></tr></thead>
  <tbody>
  <?php foreach ($banners as $b): $live = $b['active'] && (!$b['starts_on'] || $b['starts_on'] <= date('Y-m-d')) && (!$b['ends_on'] || $b['ends_on'] >= date('Y-m-d')); ?>
    <tr>
      <td><?php if ($b['image']): ?><img class="thumb" src="<?= upload_url($b['image']) ?>" alt=""><?php endif; ?></td>
      <td><a href="<?= url('admin/banners/' . $b['id']) ?>"><strong><?= e($b['title']) ?></strong></a><br><small class="muted"><?= e(mb_strimwidth((string)$b['subtitle'], 0, 80, '…')) ?></small></td>
      <td><?= $b['placement'] === 'strip' ? 'Thin strip under menu' : 'Home page slider' ?></td>
      <td><?= e($b['starts_on'] ?: 'now') ?> → <?= e($b['ends_on'] ?: 'no end') ?></td>
      <td><?= $live ? '<span class="badge ok">Showing</span>' : '<span class="badge">Not showing</span>' ?></td>
      <td><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= (int)$b['id'] ?>"><button class="btn btn-sm btn-danger" data-confirm="Delete this banner?">Delete</button></form></td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table></div>
