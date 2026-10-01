<?php $icons = ['printer' => 'Printer', 'drop' => 'Ink drop', 'scan' => 'Scanner', 'bag' => 'Bag', 'usb' => 'USB', 'ssd' => 'SSD', 'paper' => 'Paper', 'plug' => 'Plug / accessory', 'grid' => 'Other']; ?>
<h1>Categories &amp; brands</h1>
<div class="help">Change names, the order they appear in (lower number = first), or hide them. A category or brand can only be deleted when no products use it.</div>
<?php foreach (['categories' => $categories, 'brands' => $brands] as $type => $rows): ?>
<div class="card">
  <h2><?= $type === 'categories' ? 'Categories' : 'Brands' ?></h2>
  <form method="post"><?= csrf_field() ?><input type="hidden" name="type" value="<?= $type ?>"><input type="hidden" name="action" value="save">
    <div class="table-wrap"><table class="t"><thead><tr><th>Name</th><th>Description</th><?php if ($type === 'categories'): ?><th>Icon</th><?php endif; ?><th>Order</th><th>Visible</th><th>Products</th></tr></thead><tbody>
    <?php foreach ($rows as $r): ?>
      <tr>
        <td><input type="text" name="rows[<?= (int)$r['id'] ?>][name]" value="<?= e($r['name']) ?>"></td>
        <td><input type="text" name="rows[<?= (int)$r['id'] ?>][description]" value="<?= e($r['description']) ?>"></td>
        <?php if ($type === 'categories'): ?><td><select name="rows[<?= (int)$r['id'] ?>][icon]"><?php foreach ($icons as $k => $l): ?><option value="<?= $k ?>" <?= $r['icon'] === $k ? 'selected' : '' ?>><?= $l ?></option><?php endforeach; ?></select></td><?php endif; ?>
        <td style="width:80px"><input type="number" name="rows[<?= (int)$r['id'] ?>][sort_order]" value="<?= (int)$r['sort_order'] ?>"></td>
        <td><input type="checkbox" name="rows[<?= (int)$r['id'] ?>][visible]" value="1" <?= $r['visible'] ? 'checked' : '' ?>></td>
        <td><?= (int)$r['n'] ?></td>
      </tr>
    <?php endforeach; ?>
    </tbody></table></div>
    <p><button class="btn btn-primary">Save <?= $type ?></button></p>
  </form>
  <div class="actions">
    <form method="post" class="actions"><?= csrf_field() ?><input type="hidden" name="type" value="<?= $type ?>"><input type="hidden" name="action" value="add"><input type="text" name="name" placeholder="New <?= $type === 'categories' ? 'category' : 'brand' ?> name" required style="width:220px"><button class="btn">Add</button></form>
    <form method="post" class="actions"><?= csrf_field() ?><input type="hidden" name="type" value="<?= $type ?>"><input type="hidden" name="action" value="delete"><select name="id"><?php foreach ($rows as $r): ?><option value="<?= (int)$r['id'] ?>"><?= e($r['name']) ?> (<?= (int)$r['n'] ?>)</option><?php endforeach; ?></select><button class="btn btn-danger" data-confirm="Delete this?">Delete</button></form>
    <?php if ($type === 'brands'): ?>
      <form method="post" enctype="multipart/form-data" class="actions"><?= csrf_field() ?><input type="hidden" name="type" value="brands"><input type="hidden" name="action" value="logo"><select name="id"><?php foreach ($rows as $r): ?><option value="<?= (int)$r['id'] ?>"><?= e($r['name']) ?><?= $r['logo'] ? ' ✔ logo' : '' ?></option><?php endforeach; ?></select><input type="file" name="logo" accept="image/*" required><button class="btn">Upload logo</button></form>
    <?php endif; ?>
  </div>
</div>
<?php endforeach; ?>
