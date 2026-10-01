<?php $id = $p['id'] ?? null; $v = fn($k) => e($p[$k] ?? ''); ?>
<div class="topline">
  <h1><?= e($title) ?></h1>
  <div class="actions">
    <?php if ($id): ?><a class="btn" href="<?= url('product/' . $p['slug']) ?>" target="_blank">View on website ↗</a><?php endif; ?>
    <a class="btn" href="<?= url('admin/products') ?>">← All products</a>
  </div>
</div>
<?php foreach ($errors as $er): ?><div class="alert alert-error"><?= e($er) ?></div><?php endforeach; ?>
<form method="post" enctype="multipart/form-data" class="split">
  <?= csrf_field() ?>
  <div>
    <div class="card form">
      <h2>Basics</h2>
      <label>Product name *<input type="text" name="name" value="<?= $v('name') ?>" required></label>
      <div class="grid-2">
        <label>SKU / supplier code *<input type="text" name="sku" value="<?= $v('sku') ?>" required><span class="hint">Must be unique. The importer uses it to match products.</span></label>
        <label>Manufacturer part number / model<input type="text" name="mpn" value="<?= $v('mpn') ?>"></label>
      </div>
      <div class="grid-2">
        <label>Brand<select name="brand_id"><option value="">— none —</option><?php foreach ($brands as $b): ?><option value="<?= (int)$b['id'] ?>" <?= (int)($p['brand_id'] ?? 0) === (int)$b['id'] ? 'selected' : '' ?>><?= e($b['name']) ?></option><?php endforeach; ?></select><input type="text" name="new_brand" placeholder="…or type a new brand"></label>
        <label>Category<select name="category_id"><option value="">— none —</option><?php foreach ($categories as $c): ?><option value="<?= (int)$c['id'] ?>" <?= (int)($p['category_id'] ?? 0) === (int)$c['id'] ? 'selected' : '' ?>><?= e($c['name']) ?></option><?php endforeach; ?></select><input type="text" name="new_category" placeholder="…or type a new category"></label>
      </div>
      <label>Short description (shown near the price)<input type="text" name="short_description" value="<?= $v('short_description') ?>"></label>
      <label>Full description<textarea name="description" rows="6"><?= $v('description') ?></textarea><span class="hint">Blank line = new paragraph. "- " at the start of a line = bullet.</span></label>
      <label>Specifications<textarea name="specs" rows="6" placeholder="Print speed: 18 ppm&#10;Connectivity: USB, Wi-Fi"><?= $v('specs') ?></textarea><span class="hint">One per line, as <strong>Name: value</strong>.</span></label>
      <label>Compatible printers (for ink &amp; toner)<textarea name="compatible" rows="4" placeholder="Canon i-SENSYS MF3010&#10;Canon i-SENSYS LBP6030"><?= $v('compatible') ?></textarea><span class="hint">One printer per line. These link to the printer pages and appear as "Ink &amp; toner for this printer".</span></label>
      <label>Warranty<input type="text" name="warranty" value="<?= $v('warranty') ?>" placeholder="e.g. 3-year Canon warranty (T&amp;Cs apply)"></label>
    </div>
    <div class="card" id="images">
      <h2>Photos</h2>
      <?php if ($images): ?>
        <div class="images">
          <?php foreach ($images as $i => $img): ?>
            <div class="im"><img src="<?= upload_url($img['thumb'] ?: $img['path']) ?>" alt="">
              <?php if ($i === 0): ?><span class="badge ok">Main</span><?php else: ?><button class="btn btn-sm" form="img-main-<?= (int)$img['id'] ?>">Make main</button><?php endif; ?>
              <button class="btn btn-sm btn-danger" form="img-del-<?= (int)$img['id'] ?>" data-confirm="Remove this photo?">Remove</button>
            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
      <label class="field" style="margin-top:12px">Add photos (JPG, PNG or WEBP — you can choose several)<input type="file" name="images[]" accept="image/*" multiple></label>
      <p class="hint">Photos are resized automatically. Square photos on a white background look best.</p>
    </div>
    <div class="card form">
      <h2>Google (SEO) — optional</h2>
      <label>SEO title<input type="text" name="meta_title" value="<?= $v('meta_title') ?>" maxlength="70"><span class="hint">Leave blank to use the product name.</span></label>
      <label>SEO description<textarea name="meta_description" rows="2" maxlength="300"><?= $v('meta_description') ?></textarea></label>
      <label>Barcode / EAN (GTIN)<input type="text" name="gtin" value="<?= $v('gtin') ?>"></label>
      <?php if ($id): ?><label class="check"><input type="checkbox" name="regen_slug" value="1"> Update the web address from the new name (only if you renamed the product)</label><?php endif; ?>
    </div>
  </div>
  <div>
    <div class="card form">
      <h2>Price</h2>
      <label>Supplier cost (excl. VAT)<input type="text" inputmode="decimal" name="cost_price" value="<?= $v('cost_price') ?>"><span class="hint">Private — never shown to customers.</span></label>
      <label>Selling price (R)<input type="text" inputmode="decimal" name="price" value="<?= $v('price') ?>"><span class="hint">Leave blank to calculate from cost (+<?= e(setting('markup_percent')) ?>%). No price = "Request a quote".</span></label>
      <button type="button" class="btn btn-sm" data-calc-price data-markup="<?= e(setting('markup_percent')) ?>" data-step="<?= e(setting('price_rounding')) ?>">Calculate from cost (+<?= e(setting('markup_percent')) ?>%)</button>
      <label>Sale price (optional)<input type="text" inputmode="decimal" name="sale_price" value="<?= $v('sale_price') ?>"></label>
      <label>Sale ends<input type="date" name="sale_ends" value="<?= $v('sale_ends') ?>"><span class="hint">After this date the normal price returns automatically.</span></label>
    </div>
    <div class="card form">
      <h2>Availability</h2>
      <label>Stock status<select name="stock_status"><?php foreach (stock_statuses() as $k => $l): ?><option value="<?= $k ?>" <?= ($p['stock_status'] ?? '') === $k ? 'selected' : '' ?>><?= e($l) ?></option><?php endforeach; ?></select><span class="hint">"Out of stock" products can only be quoted, not bought.</span></label>
      <label class="check"><input type="checkbox" name="visible" value="1" <?= !empty($p['visible']) ? 'checked' : '' ?>> Visible on website</label>
      <label class="check"><input type="checkbox" name="featured" value="1" <?= !empty($p['featured']) ? 'checked' : '' ?>> Popular (show on home page)</label>
      <button class="btn btn-primary btn-lg" type="submit">Save product</button>
      <button class="btn" type="submit" name="save_new" value="1">Save &amp; add another</button>
    </div>
    <?php if ($id): ?>
      <div class="card"><button class="btn btn-danger" form="del-form" data-confirm="Delete this product permanently? (Tip: you can hide it instead.)">Delete product</button></div>
    <?php endif; ?>
  </div>
</form>
<?php if ($id): ?>
  <form id="del-form" method="post" action="<?= url('admin/products/' . $id . '/delete') ?>"><?= csrf_field() ?></form>
  <?php foreach ($images as $img): ?>
    <form id="img-del-<?= (int)$img['id'] ?>" method="post" action="<?= url('admin/products/' . $id . '/images') ?>"><?= csrf_field() ?><input type="hidden" name="image_id" value="<?= (int)$img['id'] ?>"><input type="hidden" name="action" value="delete"></form>
    <form id="img-main-<?= (int)$img['id'] ?>" method="post" action="<?= url('admin/products/' . $id . '/images') ?>"><?= csrf_field() ?><input type="hidden" name="image_id" value="<?= (int)$img['id'] ?>"><input type="hidden" name="action" value="main"></form>
  <?php endforeach; ?>
<?php endif; ?>
