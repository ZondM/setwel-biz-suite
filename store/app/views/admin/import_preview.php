<?php
$labels = import_fields();
$show = fn($v) => $v === null || $v === '' ? '∅' : (is_numeric($v) ? (string)(float)$v : mb_strimwidth((string)$v, 0, 60, '…'));
?>
<h1>3. Preview — nothing saved yet</h1>
<div class="stats">
  <div class="stat"><strong style="color:var(--ok)"><?= $summary['create'] ?></strong><span>new products to add</span></div>
  <div class="stat"><strong style="color:#1849a9"><?= $summary['update'] ?></strong><span>products to update</span></div>
  <div class="stat"><strong><?= $summary['nochange'] + $summary['skip'] ?></strong><span>unchanged / skipped</span></div>
  <div class="stat <?= $summary['error'] ? 'warn' : '' ?>"><strong style="color:var(--danger)"><?= $summary['error'] ?></strong><span>rows with errors (will be skipped)</span></div>
</div>
<?php if ($summary['error']): ?><div class="alert alert-error">Rows with errors are listed first. Fix them in your file and upload again, or import now and they will simply be skipped.</div><?php endif; ?>
<div class="actions" style="margin-bottom:14px">
  <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="apply"><button class="btn btn-primary btn-lg" <?= ($summary['create'] + $summary['update']) ? '' : 'disabled' ?> data-confirm="Import <?= $summary['create'] ?> new and update <?= $summary['update'] ?> products?">✔ Import <?= $summary['create'] + $summary['update'] ?> product(s)</button></form>
  <a class="btn" href="<?= url('admin/import', ['step' => 'map']) ?>">← Change column matching</a>
  <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="cancel"><button class="btn">Cancel</button></form>
</div>
<?php
usort($lines, fn($a, $b) => ['error' => 0, 'create' => 1, 'update' => 2, 'skip' => 3, 'nochange' => 4][$a['action']] <=> ['error' => 0, 'create' => 1, 'update' => 2, 'skip' => 3, 'nochange' => 4][$b['action']]);
$shown = array_slice($lines, 0, 1000);
?>
<div class="table-wrap"><table class="t">
  <thead><tr><th>Row</th><th>Action</th><th>SKU</th><th>Product</th><th>Details</th></tr></thead>
  <tbody>
  <?php foreach ($shown as $l): ?>
    <tr class="row-<?= e($l['action']) ?>">
      <td><?= (int)$l['row'] + (int)$st['data']['header_row'] + 1 ?></td>
      <td><?= ['error' => '<span class="badge bad">Error</span>', 'create' => '<span class="badge ok">New</span>', 'update' => '<span class="badge info">Update</span>', 'skip' => '<span class="badge">Skip</span>', 'nochange' => '<span class="badge">No change</span>'][$l['action']] ?></td>
      <td><?= e($l['sku'] ?? '') ?></td>
      <td><?= e(mb_strimwidth((string)($l['name'] ?? ''), 0, 70, '…')) ?></td>
      <td class="changes">
        <?php foreach ($l['errors'] as $er): ?><div style="color:var(--danger)">✘ <?= e($er) ?></div><?php endforeach; ?>
        <?php if ($l['action'] === 'update'): foreach ($l['changes'] as $fld => [$old, $new]): ?><div><?= e($labels[$fld] ?? $fld) ?>: <del><?= e($show($old)) ?></del> → <ins><?= e($show($new)) ?></ins></div><?php endforeach; endif; ?>
        <?php if ($l['action'] === 'create'): ?><div class="muted"><?= e(implode(' · ', array_map(fn($k, $v) => ($labels[$k] ?? $k) . ': ' . $show($v), array_keys(array_diff_key($l['data'], ['name' => 1, 'description' => 1, 'specs' => 1])), array_diff_key($l['data'], ['name' => 1, 'description' => 1, 'specs' => 1])))) ?></div><?php endif; ?>
        <?php foreach ($l['warnings'] as $wn): ?><div class="muted">ℹ <?= e($wn) ?></div><?php endforeach; ?>
      </td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table></div>
<?php if (count($lines) > 1000): ?><p class="hint">Showing the first 1 000 of <?= count($lines) ?> rows. All rows will be imported.</p><?php endif; ?>
