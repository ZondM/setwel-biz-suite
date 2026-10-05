<div class="topline">
  <h1>Products (<?= $total ?>)</h1>
  <div class="actions">
    <a class="btn btn-primary" href="<?= url('admin/products/new') ?>">+ Add product</a>
    <a class="btn btn-gold" href="<?= url('admin/import') ?>">Import / update from Excel</a>
    <a class="btn" href="<?= url('admin/export.xlsx') ?>">⬇ Export Excel</a>
    <a class="btn" href="<?= url('admin/export.csv') ?>">⬇ Export CSV</a>
  </div>
</div>
<form class="filters" method="get">
  <input type="search" name="q" value="<?= e($f['q']) ?>" placeholder="Search name or SKU">
  <select name="brand"><option value="">All brands</option><?php foreach ($brands as $b): ?><option value="<?= (int)$b['id'] ?>" <?= $f['brand'] === (int)$b['id'] ? 'selected' : '' ?>><?= e($b['name']) ?></option><?php endforeach; ?></select>
  <select name="category"><option value="">All categories</option><?php foreach ($categories as $c): ?><option value="<?= (int)$c['id'] ?>" <?= $f['category'] === (int)$c['id'] ? 'selected' : '' ?>><?= e($c['name']) ?></option><?php endforeach; ?></select>
  <select name="show">
    <?php foreach (['' => 'All', 'visible' => 'Visible', 'hidden' => 'Hidden', 'sale' => 'On sale', 'new' => 'New in Market', 'special' => 'Specials', 'noprice' => 'No price', 'noimage' => 'No photo', 'out' => 'Out of stock'] as $k => $l): ?><option value="<?= $k ?>" <?= $f['show'] === $k ? 'selected' : '' ?>><?= $l ?></option><?php endforeach; ?>
  </select>
  <button class="btn">Filter</button>
</form>
<form method="post" action="<?= url('admin/products/bulk') ?>">
  <?= csrf_field() ?>
  <div class="bulkbar">
    <strong>With ticked products:</strong>
    <select name="action" required>
      <option value="">Choose…</option>
      <option value="show">Show on website</option>
      <option value="hide">Hide from website</option>
      <option value="feature">Mark as popular (home page)</option>
      <option value="unfeature">Remove from popular</option>
      <option value="new">Mark as New in Market</option>
      <option value="not_new">Remove from New in Market</option>
      <option value="special">Mark as Special</option>
      <option value="not_special">Remove from Specials</option>
      <option value="end_sale">End sale price</option>
      <option value="reprice">Recalculate selling price from cost (pricing rules)</option>
      <option value="stock">Set stock status →</option>
      <option value="delete">Delete permanently</option>
    </select>
    <select name="stock_status"><?php foreach (stock_statuses() as $k => $l): ?><option value="<?= $k ?>"><?= e($l) ?></option><?php endforeach; ?></select>
    <button class="btn btn-primary" data-confirm="Apply this action to the ticked products?">Apply</button>
  </div>
  <div class="table-wrap"><table class="t">
    <thead><tr><th><input type="checkbox" data-check-all aria-label="Tick all"></th><th></th><th>Product</th><th>SKU</th><th class="num">Cost</th><th class="num">Price</th><th>Stock</th><th>Status</th></tr></thead>
    <tbody>
    <?php foreach ($rows as $p): ?>
      <tr>
        <td><input type="checkbox" name="ids[]" value="<?= (int)$p['id'] ?>" aria-label="Tick <?= e($p['name']) ?>"></td>
        <td><img class="thumb" src="<?= upload_url($p['thumb'] ?: $p['image']) ?>" alt="" loading="lazy"></td>
        <td><a href="<?= url('admin/products/' . $p['id']) ?>"><strong><?= e($p['name']) ?></strong></a><br><small class="muted"><?= e($p['brand_name'] ?? '—') ?> · <?= e($p['category_name'] ?? 'No category') ?></small></td>
        <td><?= e($p['sku']) ?></td>
        <td class="num muted"><?= $p['cost_price'] ? money($p['cost_price']) : '—' ?></td>
        <td class="num"><?= $p['price'] ? money($p['price']) : '<span class="badge warn">Quote</span>' ?><?php if (sale_active($p)): ?><br><span class="badge bad">Sale <?= money($p['sale_price']) ?></span><?php endif; ?></td>
        <td><?= e(stock_statuses()[$p['stock_status']] ?? '') ?></td>
        <td><?= $p['visible'] ? '<span class="badge ok">Visible</span>' : '<span class="badge">Hidden</span>' ?><?= $p['featured'] ? ' <span class="badge gold">Popular</span>' : '' ?><?= !empty($p['is_new']) ? ' <span class="badge info">New</span>' : '' ?><?= !empty($p['is_special']) ? ' <span class="badge bad">Special</span>' : '' ?><br><a href="<?= product_url($p) ?>" target="_blank" class="hint">view ↗</a></td>
      </tr>
    <?php endforeach; ?>
    <?php if (!$rows): ?><tr><td colspan="8" class="muted">No products match.</td></tr><?php endif; ?>
    </tbody>
  </table></div>
</form>
<?php if ($pages > 1): ?><div class="pagination"><?php for ($i = 1; $i <= $pages; $i++): ?><?php if ($i === $page): ?><span class="current"><?= $i ?></span><?php else: ?><a href="<?= url('admin/products', array_merge($f, ['page' => $i])) ?>"><?= $i ?></a><?php endif; ?><?php endfor; ?></div><?php endif; ?>
