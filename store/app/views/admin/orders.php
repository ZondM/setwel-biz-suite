<h1>Orders</h1>
<form class="filters" method="get">
  <input type="search" name="q" value="<?= e($q) ?>" placeholder="Order no, name, email">
  <select name="status"><option value="">All statuses</option><?php foreach (order_statuses() as $k => $l): ?><option value="<?= $k ?>" <?= $status === $k ? 'selected' : '' ?>><?= e($l) ?></option><?php endforeach; ?></select>
  <button class="btn">Filter</button>
</form>
<div class="table-wrap"><table class="t">
  <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Payment</th><th>Delivery</th><th>Status</th><th class="num">Total</th></tr></thead>
  <tbody>
  <?php foreach ($orders as $o): ?>
    <tr>
      <td><a href="<?= url('admin/orders/' . $o['id']) ?>"><strong><?= e($o['ref']) ?></strong></a></td>
      <td><?= e(date('j M Y H:i', strtotime($o['created_at']))) ?></td>
      <td><?= e($o['customer_name']) ?><br><small class="muted"><?= e($o['company'] ?: $o['email']) ?></small></td>
      <td><?= $o['payment_method'] === 'payfast' ? 'PayFast' : 'EFT' ?><?= $o['pop_path'] ? ' <span class="badge info">POP</span>' : '' ?></td>
      <td><?= $o['delivery_method'] === 'collect' ? 'Collect' : e($o['city']) ?></td>
      <td><?php partial('admin_status', ['o' => $o]); ?></td>
      <td class="num"><?= money($o['total']) ?></td>
    </tr>
  <?php endforeach; ?>
  <?php if (!$orders): ?><tr><td colspan="7" class="muted">No orders found.</td></tr><?php endif; ?>
  </tbody>
</table></div>
