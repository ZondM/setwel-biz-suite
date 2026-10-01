<div class="topline"><h1>Welcome back</h1><div class="actions"><a class="btn btn-primary" href="<?= url('admin/products/new') ?>">+ Add product</a><a class="btn btn-gold" href="<?= url('admin/import') ?>">Import / update prices</a></div></div>
<?php if ($warnings): ?>
  <div class="help"><strong>Before you launch:</strong><ul><?php foreach ($warnings as $w): ?><li><?= e($w) ?></li><?php endforeach; ?></ul></div>
<?php endif; ?>
<div class="stats">
  <a class="stat" href="<?= url('admin/orders') ?>"><strong><?= $stats['orders_open'] ?></strong><span>Open orders</span></a>
  <a class="stat" href="<?= url('admin/orders') ?>"><strong><?= money($stats['sales_month'], false) ?></strong><span>Paid sales this month</span></a>
  <a class="stat" href="<?= url('admin/quotes') ?>"><strong><?= $stats['quotes_new'] ?></strong><span>New quote requests</span></a>
  <a class="stat" href="<?= url('admin/subscribers') ?>"><strong><?= $stats['subscribers'] ?></strong><span>Newsletter subscribers</span></a>
  <a class="stat" href="<?= url('admin/products') ?>"><strong><?= $stats['products'] ?></strong><span>Products (<?= $stats['visible'] ?> visible)</span></a>
  <a class="stat <?= $stats['no_image'] ? 'warn' : '' ?>" href="<?= url('admin/products', ['show' => 'noimage']) ?>"><strong><?= $stats['no_image'] ?></strong><span>Products without a photo</span></a>
  <a class="stat <?= $stats['no_price'] ? 'warn' : '' ?>" href="<?= url('admin/products', ['show' => 'noprice']) ?>"><strong><?= $stats['no_price'] ?></strong><span>Products without a price (quote only)</span></a>
  <a class="stat" href="<?= url('admin/export.xlsx') ?>"><strong>⬇</strong><span>Download all products (Excel)</span></a>
</div>
<div class="split">
  <div class="card">
    <h2>Latest orders</h2>
    <?php if ($orders): ?>
    <div class="table-wrap"><table class="t"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th class="num">Total</th></tr></thead><tbody>
      <?php foreach ($orders as $o): ?><tr><td><a href="<?= url('admin/orders/' . $o['id']) ?>"><?= e($o['ref']) ?></a><br><small class="muted"><?= e(date('j M H:i', strtotime($o['created_at']))) ?></small></td><td><?= e($o['customer_name']) ?></td><td><?php partial('admin_status', ['o' => $o]); ?></td><td class="num"><?= money($o['total']) ?></td></tr><?php endforeach; ?>
    </tbody></table></div>
    <?php else: ?><p class="muted">No orders yet.</p><?php endif; ?>
  </div>
  <div class="card">
    <h2>Latest quote requests</h2>
    <?php foreach ($quotes as $qt): ?><p><a href="<?= url('admin/quotes/' . $qt['id']) ?>"><?= e($qt['ref']) ?></a> · <?= e($qt['name']) ?><?= $qt['company'] ? ' (' . e($qt['company']) . ')' : '' ?> <span class="badge <?= $qt['status'] === 'new' ? 'gold' : '' ?>"><?= e($qt['status']) ?></span></p><?php endforeach; ?>
    <?php if (!$quotes): ?><p class="muted">No quote requests yet.</p><?php endif; ?>
    <h2>Monthly routine</h2>
    <ol class="muted" style="padding-left:18px"><li>Fill in the supplier price sheet.</li><li><a href="<?= url('admin/import') ?>">Import it</a> — check the preview.</li><li>Set specials (sale prices) &amp; update the <a href="<?= url('admin/banners') ?>">banner</a>.</li><li>Check the <a href="<?= url('specials') ?>" target="_blank">Specials page</a>.</li></ol>
  </div>
</div>
