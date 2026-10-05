<h1>Pricing rules</h1>
<div class="help">
  <strong>How selling prices are worked out</strong> (when a product has a supplier cost and no fixed selling price):
  <ol>
    <li>Selling price = supplier cost (excl. VAT) × (1 + markup), rounded <strong>up</strong> to the next rand.</li>
    <li>The <strong>most specific</strong> rule wins: brand + category → category only → brand only → the default markup.</li>
  </ol>
  Example: HP + Ink &amp; Toner = 0% → an HP toner costing R1 557.38 sells for R1 558. A Kyocera toner has no rule of its own, so it gets the default (<?= e(setting('markup_percent')) ?>%).
</div>
<form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="save">
  <h2>Your rules</h2>
  <div class="table-wrap"><table class="t">
    <thead><tr><th>Brand</th><th>Category</th><th>Markup %</th><th>Note</th><th></th></tr></thead>
    <tbody>
      <?php foreach ($rules as $r): ?>
        <tr>
          <td><?= e($r['brand_name'] ?? 'Any brand') ?></td>
          <td><?= e($r['category_name'] ?? 'Any category') ?></td>
          <td style="width:120px"><input type="text" inputmode="decimal" name="markup[<?= (int)$r['id'] ?>]" value="<?= e(rtrim(rtrim((string)$r['markup'], '0'), '.')) ?>"></td>
          <td class="muted"><?= e($r['note']) ?></td>
          <td class="num"><button class="btn btn-sm btn-danger" form="del-<?= (int)$r['id'] ?>" data-confirm="Delete this rule?">Delete</button></td>
        </tr>
      <?php endforeach; ?>
      <tr style="background:#fafbfc"><td><strong>Everything else</strong></td><td><strong>(default)</strong></td><td><input type="text" inputmode="decimal" name="default_markup" value="<?= e(setting('markup_percent')) ?>"></td><td class="muted">Used when no rule above matches</td><td></td></tr>
    </tbody>
  </table></div>
  <p class="actions" style="margin-top:12px"><button class="btn btn-primary">Save markups</button></p>
</form>
<?php foreach ($rules as $r): ?><form id="del-<?= (int)$r['id'] ?>" method="post"><?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>"></form><?php endforeach; ?>

<form method="post" class="card form" style="max-width:820px"><?= csrf_field() ?><input type="hidden" name="action" value="add">
  <h2>Add a rule</h2>
  <div class="grid-3">
    <label>Brand<select name="brand_id"><option value="">Any brand</option><?php foreach ($brands as $b): ?><option value="<?= (int)$b['id'] ?>"><?= e($b['name']) ?></option><?php endforeach; ?></select></label>
    <label>Category<select name="category_id"><option value="">Any category</option><?php foreach ($categories as $c): ?><option value="<?= (int)$c['id'] ?>"><?= e($c['name']) ?></option><?php endforeach; ?></select></label>
    <label>Markup %<input type="text" inputmode="decimal" name="markup" required placeholder="e.g. 45"></label>
  </div>
  <label>Note (optional)<input type="text" name="note" placeholder="e.g. Supplier gives us discounted prices"></label>
  <button class="btn">Add rule</button>
</form>

<form method="post" class="card"><?= csrf_field() ?><input type="hidden" name="action" value="recalc">
  <h2>Apply the rules to existing products</h2>
  <p>Recalculates the selling price of every product that has a supplier cost. Sale prices are not changed.<?php if ($no_cost): ?> <br><span class="muted"><?= (int)$no_cost ?> product(s) have a selling price but no supplier cost — they keep their current price until you import the supplier price list.</span><?php endif; ?></p>
  <button class="btn btn-gold" data-confirm="Recalculate all selling prices from supplier cost using these rules?">Recalculate all prices</button>
</form>
