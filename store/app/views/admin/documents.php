<h1>Certificates &amp; letters</h1>
<div class="help">Upload your authorised-reseller letters, partner certificates and B-BBEE affidavit. Tick <strong>Show on website</strong> to let customers view a document on your <a href="<?= url('credentials') ?>" target="_blank">Credentials page</a>. Unticked documents stay private (only admins can open them). Files are stored in a protected folder.</div>
<form method="post" enctype="multipart/form-data" class="card form" style="max-width:720px">
  <?= csrf_field() ?><input type="hidden" name="action" value="upload">
  <div class="grid-2">
    <label>Title<input type="text" name="title" required placeholder="e.g. Canon authorised reseller letter 2026"></label>
    <label>Short description (optional)<input type="text" name="description"></label>
  </div>
  <label>File (PDF, JPG or PNG, max 10 MB)<input type="file" name="file" accept=".pdf,image/*" required></label>
  <label class="check"><input type="checkbox" name="is_public" value="1"> Show on website</label>
  <button class="btn btn-primary">Upload</button>
</form>
<div class="table-wrap"><table class="t"><thead><tr><th>Document</th><th>Uploaded</th><th>On website</th><th></th></tr></thead><tbody>
<?php foreach ($docs as $d): ?>
  <tr>
    <td><a href="<?= url('admin/documents/' . $d['id']) ?>" target="_blank"><strong><?= e($d['title']) ?></strong></a><br><small class="muted"><?= e($d['description']) ?></small></td>
    <td><?= e($d['created_at']) ?></td>
    <td><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="toggle"><input type="hidden" name="id" value="<?= (int)$d['id'] ?>"><button class="btn btn-sm"><?= $d['is_public'] ? '✔ Shown — hide' : 'Hidden — show' ?></button></form></td>
    <td><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= (int)$d['id'] ?>"><button class="btn btn-sm btn-danger" data-confirm="Delete this document?">Delete</button></form></td>
  </tr>
<?php endforeach; ?>
<?php if (!$docs): ?><tr><td colspan="4" class="muted">No documents yet.</td></tr><?php endif; ?>
</tbody></table></div>
