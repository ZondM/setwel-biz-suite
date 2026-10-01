<h1>Quote requests</h1>
<div class="table-wrap"><table class="t">
  <thead><tr><th>Ref</th><th>Date</th><th>From</th><th>Type</th><th>Asked for</th><th>Status</th></tr></thead>
  <tbody>
  <?php foreach ($quotes as $qt): ?>
    <tr><td><a href="<?= url('admin/quotes/' . $qt['id']) ?>"><strong><?= e($qt['ref']) ?></strong></a></td><td><?= e(date('j M Y', strtotime($qt['created_at']))) ?></td><td><?= e($qt['name']) ?><br><small class="muted"><?= e($qt['company']) ?></small></td><td><?= e($qt['customer_type']) ?></td><td class="muted"><?= e(mb_strimwidth((string)$qt['items'], 0, 80, '…')) ?></td><td><span class="badge <?= ['new' => 'gold', 'sent' => 'info', 'won' => 'ok', 'lost' => 'bad'][$qt['status']] ?? '' ?>"><?= e($qt['status']) ?></span></td></tr>
  <?php endforeach; ?>
  <?php if (!$quotes): ?><tr><td colspan="6" class="muted">No quote requests yet.</td></tr><?php endif; ?>
  </tbody>
</table></div>
