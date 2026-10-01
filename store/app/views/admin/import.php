<h1>Import or update products from Excel</h1>
<?php if ($pending): ?><div class="alert alert-info">You have an unfinished import (<?= e($pending['data']['name']) ?>). <a href="<?= url('admin/import', ['step' => 'preview']) ?>">Continue it</a> or upload a new file below.</div><?php endif; ?>
<div class="help">
  <strong>How it works (nothing is saved until you click “Import” on the preview):</strong>
  <ol>
    <li>Upload your <strong>.xlsx</strong> or <strong>.csv</strong> file — e.g. your filled-in supplier price sheet, or the export from this store.</li>
    <li>Tell us which column is which (SKU, name, cost…). Save it as e.g. “Supplier price sheet” so next month is one click.</li>
    <li>Check the preview: <span class="badge ok">new</span> products are added, <span class="badge info">update</span> products whose SKU already exists are changed, <span class="badge bad">errors</span> are skipped.</li>
  </ol>
  Empty cells never erase existing information. Supplier cost is turned into your selling price automatically: cost × (1 + <?= e(setting('markup_percent')) ?>%), rounded up.
</div>
<div class="grid-2">
  <form method="post" enctype="multipart/form-data" class="card form">
    <?= csrf_field() ?><input type="hidden" name="action" value="upload">
    <h2>1. Upload file</h2>
    <label>Excel or CSV file<input type="file" name="file" accept=".xlsx,.csv,.xlsm" required></label>
    <label>Use saved column matching<select name="preset"><option value="">— detect automatically —</option><?php foreach ($presets as $pr): ?><option value="<?= (int)$pr['id'] ?>"><?= e($pr['name']) ?></option><?php endforeach; ?></select></label>
    <button class="btn btn-primary btn-lg">Upload &amp; continue →</button>
    <p class="hint">Old .xls files: open in Excel → File → Save As → “Excel Workbook (.xlsx)”.</p>
  </form>
  <div class="card">
    <h2>Templates &amp; exports</h2>
    <p>Start from the template, or export your products, change them in Excel and upload the file again.</p>
    <p class="actions"><a class="btn" href="<?= url('admin/import/template.xlsx') ?>">⬇ Template (Excel)</a><a class="btn" href="<?= url('admin/import/template.csv') ?>">⬇ Template (CSV)</a></p>
    <p class="actions"><a class="btn" href="<?= url('admin/export.xlsx') ?>">⬇ Export all products (Excel)</a></p>
    <h2>Column tips</h2>
    <ul class="hint" style="padding-left:18px">
      <li><strong>Stock status</strong>: in stock, low stock, on order, out of stock — or a quantity (0 = out of stock).</li>
      <li><strong>Visible / Featured</strong>: yes or no.</li>
      <li><strong>Sale price</strong>: type <code>CLEAR</code> to end a sale.</li>
      <li><strong>Specifications</strong>: “Name: value | Name: value”.</li>
      <li><strong>Compatible printers</strong>: separated by commas.</li>
      <li><strong>Image URLs</strong>: web links to photos, comma separated (or use <a href="<?= url('admin/images') ?>">Bulk images</a>).</li>
    </ul>
    <?php if ($presets): ?>
      <h2>Saved column matchings</h2>
      <?php foreach ($presets as $pr): ?><form method="post" class="actions" style="margin-bottom:6px"><?= csrf_field() ?><input type="hidden" name="action" value="delete_preset"><input type="hidden" name="id" value="<?= (int)$pr['id'] ?>"><span><?= e($pr['name']) ?></span><button class="btn btn-sm btn-danger" data-confirm="Delete this saved matching?">Delete</button></form><?php endforeach; ?>
    <?php endif; ?>
  </div>
</div>
