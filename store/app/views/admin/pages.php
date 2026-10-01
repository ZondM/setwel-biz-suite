<h1>Pages</h1>
<div class="help">These are your information pages. Words in {curly brackets} — like {phone} or {free_delivery_threshold} — are filled in automatically from Settings, so they stay correct when you change a setting. <strong>Have the Privacy, Terms and Returns pages checked by a lawyer before launch.</strong></div>
<div class="table-wrap"><table class="t"><thead><tr><th>Page</th><th>Address</th><th>Last updated</th></tr></thead><tbody>
<?php foreach ($pages as $pg): ?><tr><td><a href="<?= url('admin/pages/' . $pg['id']) ?>"><strong><?= e($pg['title']) ?></strong></a></td><td><a href="<?= url('page/' . $pg['slug']) ?>" target="_blank">/page/<?= e($pg['slug']) ?> ↗</a></td><td><?= e($pg['updated_at']) ?></td></tr><?php endforeach; ?>
</tbody></table></div>
