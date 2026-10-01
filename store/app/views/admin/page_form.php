<div class="topline"><h1>Edit: <?= e($pg['title']) ?></h1><div class="actions"><a class="btn" href="<?= url('page/' . $pg['slug']) ?>" target="_blank">View page ↗</a><a class="btn" href="<?= url('admin/pages') ?>">← All pages</a></div></div>
<div class="split">
  <form method="post" class="card form"><?= csrf_field() ?>
    <label>Title<input type="text" name="title" value="<?= e($pg['title']) ?>" required></label>
    <label>Text<textarea name="content" rows="26" style="font-family:ui-monospace,Consolas,monospace;font-size:.9rem"><?= e($pg['content']) ?></textarea></label>
    <label>Google description (1–2 sentences)<textarea name="meta_description" rows="2"><?= e($pg['meta_description']) ?></textarea></label>
    <button class="btn btn-primary btn-lg">Save page</button>
  </form>
  <div class="card">
    <h2>How to format</h2>
    <ul class="hint" style="padding-left:18px">
      <li><code>## Heading</code> — a heading</li>
      <li><code>### Small heading</code></li>
      <li><code>- item</code> — a bullet point</li>
      <li><code>**bold words**</code></li>
      <li><code>[link text](/page/terms)</code> — a link</li>
      <li>Empty line — new paragraph</li>
    </ul>
    <h2>Automatic values</h2>
    <p class="hint">{business_name} {legal_name} {registration_number} {email} {phone} {whatsapp} {address} {collection_address} {hours} {information_officer} {delivery_fee} {free_delivery_threshold} {site_url}</p>
  </div>
</div>
