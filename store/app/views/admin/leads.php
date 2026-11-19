<?php /** @var array $rows @var array $stats @var string $month @var array $months */ $src = lead_sources(); $sts = lead_statuses(); ?>
<div class="topline"><h1>Leads</h1>
  <form method="get" class="inline-form">
    <select name="month" onchange="this.form.submit()"><?php foreach ($months as $m): ?><option value="<?= $m ?>" <?= $m === $month ? 'selected' : '' ?>><?= date('F Y', strtotime($m . '-01')) ?></option><?php endforeach; ?></select>
    <select name="source" onchange="this.form.submit()"><option value="">All sources</option><?php foreach ($src as $k => $v): ?><option value="<?= $k ?>" <?= $source === $k ? 'selected' : '' ?>><?= e($v) ?></option><?php endforeach; ?></select>
    <select name="status" onchange="this.form.submit()"><option value="">All statuses</option><?php foreach ($sts as $k => $v): ?><option value="<?= $k ?>" <?= $status === $k ? 'selected' : '' ?>><?= e($v) ?></option><?php endforeach; ?></select>
  </form>
</div>
<div class="stats">
  <div class="stat"><strong><?= $stats['total'] ?></strong><span>Leads in <?= date('F', strtotime($month . '-01')) ?></span></div>
  <div class="stat <?= $stats['uncontacted'] ? 'warn' : '' ?>"><strong><?= $stats['uncontacted'] ?></strong><span>Not contacted yet</span></div>
  <div class="stat"><strong><?= $stats['median_response_min'] === null ? '—' : ($stats['median_response_min'] < 120 ? $stats['median_response_min'] . ' min' : round($stats['median_response_min'] / 60, 1) . ' h') ?></strong><span>Typical time to first reply</span></div>
  <div class="stat"><strong><?= $stats['won'] ?></strong><span>Won · <?= money($stats['won_value'], false) ?></span></div>
  <div class="stat"><strong><?= money($stats['quoted_value'], false) ?></strong><span>Value of quotes given</span></div>
  <div class="stat"><strong><?= $stats['paid_orders'] ?></strong><span>Paid online orders · <?= money($stats['paid_value'], false) ?></span></div>
  <div class="stat"><strong><?= $stats['wa_clicks'] ?></strong><span>WhatsApp button clicks</span></div>
  <div class="stat"><strong><?= $stats['chat_opens'] ?></strong><span>AI assistant chats opened</span></div>
</div>
<p class="muted">By source: <?php foreach ($stats['by_source'] as $k => $n): if (!$n) continue; ?><span class="badge info"><?= e($src[$k] ?? $k) ?>: <?= $n ?></span> <?php endforeach; ?><?= array_sum($stats['by_source']) ? '' : 'no leads yet this month.' ?></p>
<div class="table-wrap"><table class="t">
  <thead><tr><th>Ref</th><th>When</th><th>Source</th><th>Customer</th><th>Value</th><th>Status</th><th></th></tr></thead>
  <tbody>
  <?php foreach ($rows as $l): $age = (time() - strtotime($l['created_at'])) / 3600; ?>
    <tr<?= $l['status'] === 'new' && $age > 2 ? ' class="row-warn"' : '' ?>>
      <td><a href="<?= url('admin/leads/' . $l['id']) ?>"><strong><?= e($l['ref']) ?></strong></a><?= $l['needs_price'] ? '<br><span class="badge gold">needs price</span>' : '' ?></td>
      <td><?= e(date('j M H:i', strtotime($l['created_at']))) ?><br><small class="muted"><?= $age < 1 ? round($age * 60) . ' min ago' : ($age < 48 ? round($age) . ' h ago' : round($age / 24) . ' days ago') ?></small></td>
      <td><?= e($src[$l['source']] ?? $l['source']) ?></td>
      <td><?= e($l['name'] ?: '—') ?><br><small class="muted"><?= e($l['phone']) ?> <?= e($l['email']) ?></small></td>
      <td><?= $l['total'] ? money($l['total'], false) : '—' ?></td>
      <td><span class="badge <?= ['new' => 'bad', 'contacted' => 'gold', 'quoted' => 'info', 'won' => 'ok', 'lost' => ''][$l['status']] ?? '' ?>"><?= e($sts[$l['status']] ?? $l['status']) ?></span></td>
      <td><?php if ($l['phone']): ?><a class="btn btn-sm" href="<?= e(lead_wa_link($l)) ?>" target="_blank" rel="noopener">WhatsApp</a><?php endif; ?></td>
    </tr>
  <?php endforeach; ?>
  <?php if (!$rows): ?><tr><td colspan="7" class="muted">No leads for this selection.</td></tr><?php endif; ?>
  </tbody>
</table></div>
