<?php
$query = array_filter(['q' => $f['q'], 'brand' => !isset($currentBrand) ? $f['brand'] : [], 'min' => $f['min'], 'max' => $f['max'], 'stock' => $f['stock'], 'sale' => $f['sale'], 'sort' => $f['sort'], 'category' => (!isset($currentCategory) ? ($f['category'] ?? '') : '')]);
$pageUrl = fn($n) => url($base, array_merge($query, ['page' => $n > 1 ? $n : null]));
?>
<div class="wrap">
  <?php partial('crumbs', ['crumbs' => $crumbs ?? [['Shop', null]]]); ?>
  <div class="listing">
    <aside>
      <button class="btn btn-ghost btn-block filters-toggle" type="button" data-filters-toggle aria-expanded="false" aria-controls="filters"><?= icon('filter', 18) ?> Filter &amp; sort</button>
      <form id="filters" class="filters" method="get" action="<?= url($base) ?>">
        <?php if ($f['q'] !== ''): ?><input type="hidden" name="q" value="<?= e($f['q']) ?>"><?php endif; ?>
        <?php if (!isset($currentCategory)): ?>
          <h3>Category</h3>
          <div class="filter-cats">
            <a href="<?= url($base, array_merge($query, ['category' => null, 'page' => null])) ?>" class="<?= empty($f['category']) ? 'active' : '' ?>">All categories</a>
            <?php foreach ($categories as $c): if (!$c['product_count']) continue; ?>
              <a href="<?= url($base, array_merge($query, ['category' => $c['slug'], 'page' => null])) ?>" class="<?= ($f['category'] ?? '') === $c['slug'] ? 'active' : '' ?>"><span><?= e($c['name']) ?></span><span class="count"><?= (int)$c['product_count'] ?></span></a>
            <?php endforeach; ?>
          </div>
          <?php if (!empty($f['category'])): ?><input type="hidden" name="category" value="<?= e($f['category']) ?>"><?php endif; ?>
        <?php endif; ?>
        <?php if (!isset($currentBrand)): ?>
          <h3>Brand</h3>
          <?php foreach ($brands as $b): if (!$b['product_count']) continue; ?>
            <label><input type="checkbox" name="brand[]" value="<?= e($b['slug']) ?>" <?= in_array($b['slug'], $f['brand'], true) ? 'checked' : '' ?> data-autosubmit> <?= e($b['name']) ?><span class="count"><?= (int)$b['product_count'] ?></span></label>
          <?php endforeach; ?>
        <?php endif; ?>
        <h3>Price (R)</h3>
        <div class="price-row">
          <label class="sr-only" for="min">Minimum price</label><input id="min" type="number" name="min" min="0" step="1" placeholder="Min" value="<?= e($f['min']) ?>">
          <label class="sr-only" for="max">Maximum price</label><input id="max" type="number" name="max" min="0" step="1" placeholder="Max" value="<?= e($f['max']) ?>">
        </div>
        <h3>Show</h3>
        <label><input type="checkbox" name="stock" value="1" <?= $f['stock'] ? 'checked' : '' ?> data-autosubmit> In stock only</label>
        <label><input type="checkbox" name="sale" value="1" <?= $f['sale'] ? 'checked' : '' ?> data-autosubmit> Specials only</label>
        <input type="hidden" name="sort" value="<?= e($f['sort']) ?>">
        <button class="btn btn-primary btn-block" type="submit" style="margin-top:14px">Apply filters</button>
        <?php if ($query): ?><a class="btn btn-ghost btn-block btn-sm" style="margin-top:8px" href="<?= url($base, $f['q'] !== '' ? ['q' => $f['q']] : []) ?>">Clear filters</a><?php endif; ?>
      </form>
    </aside>
    <section>
      <div class="listing-top">
        <div>
          <h1><?= e($title) ?></h1>
          <p class="muted" style="margin:4px 0 0"><?= (int)$res['total'] ?> product<?= $res['total'] === 1 ? '' : 's' ?><?= $intro ? ' · ' . e($intro) : '' ?></p>
        </div>
        <form class="sort" method="get" action="<?= url($base) ?>">
          <?php foreach ($query as $k => $v): if ($k === 'sort') continue; foreach ((array)$v as $vv): ?><input type="hidden" name="<?= e($k) ?><?= is_array($v) ? '[]' : '' ?>" value="<?= e($vv) ?>"><?php endforeach; endforeach; ?>
          <label for="sort" class="sr-only">Sort by</label>
          <select id="sort" name="sort" data-autosubmit>
            <option value="">Sort: Recommended</option>
            <option value="price_asc" <?= $f['sort'] === 'price_asc' ? 'selected' : '' ?>>Price: low to high</option>
            <option value="price_desc" <?= $f['sort'] === 'price_desc' ? 'selected' : '' ?>>Price: high to low</option>
            <option value="newest" <?= $f['sort'] === 'newest' ? 'selected' : '' ?>>Newest</option>
            <option value="name" <?= $f['sort'] === 'name' ? 'selected' : '' ?>>Name A–Z</option>
          </select>
          <noscript><button class="btn btn-sm btn-ghost">Sort</button></noscript>
        </form>
      </div>
      <?php if ($res['items']): ?>
        <div class="grid grid-3"><?php foreach ($res['items'] as $p) { partial('card', ['p' => $p]); } ?></div>
        <?php if ($res['pages'] > 1): ?>
          <nav class="pagination" aria-label="Pages">
            <?php if ($res['page'] > 1): ?><a href="<?= e($pageUrl($res['page'] - 1)) ?>" rel="prev">‹ Prev</a><?php endif; ?>
            <?php for ($i = max(1, $res['page'] - 2); $i <= min($res['pages'], $res['page'] + 2); $i++): ?>
              <?php if ($i === $res['page']): ?><span class="current" aria-current="page"><?= $i ?></span><?php else: ?><a href="<?= e($pageUrl($i)) ?>"><?= $i ?></a><?php endif; ?>
            <?php endfor; ?>
            <?php if ($res['page'] < $res['pages']): ?><a href="<?= e($pageUrl($res['page'] + 1)) ?>" rel="next">Next ›</a><?php endif; ?>
          </nav>
        <?php endif; ?>
      <?php else: ?>
        <div class="empty">
          <h2>No products found</h2>
          <p class="muted">We stock far more than we list online. Tell us what you need and we will quote you.</p>
          <p><a class="btn btn-primary" href="<?= url('quote', ['item' => $f['q']]) ?>">Request a quote</a> <a class="btn btn-wa" href="https://wa.me/<?= e(wa_number(setting('whatsapp'))) ?>?text=<?= rawurlencode('Hi, do you have: ' . $f['q']) ?>" target="_blank" rel="noopener"><?= icon('whatsapp', 18) ?> Ask on WhatsApp</a></p>
        </div>
      <?php endif; ?>
    </section>
  </div>
</div>
