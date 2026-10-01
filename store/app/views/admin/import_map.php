<?php $fields = import_fields(); $o = $st['opts']; ?>
<h1>2. Match your columns</h1>
<p class="muted">File: <strong><?= e($st['data']['name']) ?></strong> · <?= count($st['data']['rows']) ?> rows · headings found on row <?= (int)$st['data']['header_row'] ?>. We guessed the matches — check them and fix any that are wrong. Choose “— ignore —” for columns you don't need.</p>
<form method="post" class="form">
  <?= csrf_field() ?><input type="hidden" name="action" value="map">
  <div class="table-wrap"><table class="t">
    <thead><tr><th>Column in your file</th><th>Example values</th><th>Store field</th></tr></thead>
    <tbody>
    <?php foreach ($st['data']['headers'] as $i => $h): ?>
      <tr>
        <td><strong><?= e($h) ?></strong></td>
        <td class="muted" style="max-width:340px"><?= e(implode(' · ', array_filter(array_map(fn($r) => mb_strimwidth((string)($r[$i] ?? ''), 0, 40, '…'), $sample), fn($x) => $x !== ''))) ?></td>
        <td><select name="map[<?= $i ?>]"><option value="">— ignore —</option><?php foreach ($fields as $k => $l): ?><option value="<?= $k ?>" <?= ($st['map'][$i] ?? '') === $k ? 'selected' : '' ?>><?= e($l) ?></option><?php endforeach; ?></select></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
  <div class="card">
    <h2>Options</h2>
    <div class="grid-2">
      <div>
        <label class="radio"><input type="radio" name="mode" value="full" <?= $o['mode'] !== 'prices' ? 'checked' : '' ?>> <span><strong>Add new &amp; update existing products</strong> (all mapped columns)</span></label>
        <label class="radio"><input type="radio" name="mode" value="prices" <?= $o['mode'] === 'prices' ? 'checked' : '' ?>> <span><strong>Only update prices &amp; stock</strong> of products already in the store (safe monthly update)</span></label>
      </div>
      <label class="field">Selling price
        <select name="price_calc">
          <option value="blank" <?= $o['price_calc'] === 'blank' ? 'selected' : '' ?>>Calculate from cost when the selling-price cell is empty (recommended)</option>
          <option value="always" <?= $o['price_calc'] === 'always' ? 'selected' : '' ?>>Always calculate from cost (ignore selling-price column)</option>
          <option value="never" <?= $o['price_calc'] === 'never' ? 'selected' : '' ?>>Never calculate — use the selling-price column only</option>
        </select>
        <span class="hint">Markup now: <?= e(setting('markup_percent')) ?>% (change in Settings).</span>
      </label>
      <label class="field">Brand for NEW products when the file has no brand<input list="brand-list" type="text" name="default_brand" value="<?= e($o['default_brand']) ?>" placeholder="e.g. Canon"></label>
      <label class="field">Category for NEW products when the file has none<input list="cat-list" type="text" name="default_category" value="<?= e($o['default_category']) ?>" placeholder="e.g. Printers"></label>
      <label class="check"><input type="checkbox" name="keep_names" value="1" <?= !isset($o['keep_names']) || $o['keep_names'] ? 'checked' : '' ?>> Keep the product names already in my store (don't overwrite them with the file's names)</label>
      <label class="check"><input type="checkbox" name="hide_new" value="1" <?= !empty($o['hide_new']) ? 'checked' : '' ?>> Add NEW products as hidden (so I can add photos first)</label>
      <label class="field">Save this matching for next time as (optional)<input type="text" name="preset_name" placeholder="e.g. Supplier price sheet"></label>
    </div>
    <datalist id="brand-list"><?php foreach ($brands as $b): ?><option value="<?= e($b['name']) ?>"><?php endforeach; ?></datalist>
    <datalist id="cat-list"><?php foreach ($categories as $c): ?><option value="<?= e($c['name']) ?>"><?php endforeach; ?></datalist>
  </div>
  <div class="actions"><button class="btn btn-primary btn-lg">Preview changes →</button></div>
</form>
<form method="post" style="margin-top:10px"><?= csrf_field() ?><input type="hidden" name="action" value="cancel"><button class="btn">Cancel import</button></form>
