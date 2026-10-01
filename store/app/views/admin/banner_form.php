<div class="topline"><h1><?= e($title) ?></h1><a class="btn" href="<?= url('admin/banners') ?>">← All banners</a></div>
<form method="post" enctype="multipart/form-data" class="card form" style="max-width:820px">
  <?= csrf_field() ?>
  <label>Headline<input type="text" name="title" value="<?= e($b['title'] ?? '') ?>" required maxlength="120"></label>
  <label>Text under the headline<textarea name="subtitle" rows="2"><?= e($b['subtitle'] ?? '') ?></textarea></label>
  <div class="grid-2">
    <label>Button link<input type="text" name="link_url" value="<?= e($b['link_url'] ?? '') ?>" placeholder="/specials or /category/printers"></label>
    <label>Button text<input type="text" name="button_text" value="<?= e($b['button_text'] ?? '') ?>" placeholder="View specials"></label>
    <label>Where<select name="placement"><option value="hero" <?= ($b['placement'] ?? '') === 'hero' ? 'selected' : '' ?>>Home page slider</option><option value="strip" <?= ($b['placement'] ?? '') === 'strip' ? 'selected' : '' ?>>Thin strip under the menu (all pages)</option></select></label>
    <label>Order (1 = first)<input type="number" name="sort_order" value="<?= (int)($b['sort_order'] ?? 1) ?>"></label>
    <label>Show from (optional)<input type="date" name="starts_on" value="<?= e($b['starts_on'] ?? '') ?>"></label>
    <label>Show until (optional)<input type="date" name="ends_on" value="<?= e($b['ends_on'] ?? '') ?>"></label>
  </div>
  <label>Picture (optional, slider only — wide image, e.g. 1400 × 600)<input type="file" name="image" accept="image/*"></label>
  <?php if (!empty($b['image'])): ?><div><img src="<?= upload_url($b['image']) ?>" alt="" style="max-height:140px"><label class="check"><input type="checkbox" name="remove_image" value="1"> Remove picture</label></div><?php endif; ?>
  <p class="hint">Only use product or brand photos you have permission to use.</p>
  <label class="check"><input type="checkbox" name="active" value="1" <?= !empty($b['active']) ? 'checked' : '' ?>> Active</label>
  <button class="btn btn-primary btn-lg">Save banner</button>
</form>
