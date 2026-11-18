<?php
/**
 * Product picture. Uses the uploaded photo; until there is one, draws a clean graphic:
 * an ink drop in the cartridge colour (cyan, magenta, …) or a brand tile.
 * @var array $p @var string $class
 */
$src = ($p['image'] ?? null) ?: ($p['thumb'] ?? null);
if ($src):
?><img class="<?= e($class ?? '') ?>" src="<?= upload_url($src) ?>" alt="<?= e($p['name']) ?>" loading="lazy" width="400" height="400"><?php
else:
    $n = strtolower($p['name']);
    $colours = ['photo black' => '#1b1b1f', 'matte black' => '#3b3b3f', 'cyan' => '#00a3e0', 'magenta' => '#d6006e', 'yellow' => '#f5c400', 'gray' => '#8b9099', 'grey' => '#8b9099', 'black' => '#1b1b1f'];
    $fill = null;
    foreach ($colours as $k => $c) {
        if (str_contains($n, $k)) { $fill = $c; $label = ucwords($k); break; }
    }
    $model = preg_match('/\b(\d{2,4}[A-Z]?)\b/i', $p['name'], $m) ? strtoupper($m[1]) : $p['sku'];
    $brand = $p['brand_name'] ?? '';
?><svg class="visual <?= e($class ?? '') ?>" viewBox="0 0 200 200" role="img" aria-label="<?= e($p['name']) ?>">
  <rect width="200" height="200" fill="#f7f5f0"/>
  <circle cx="100" cy="100" r="78" fill="#fff"/>
  <?php if ($fill): ?>
    <path d="M100 38c-20 30-40 52-40 76a40 40 0 0 0 80 0c0-24-20-46-40-76z" fill="<?= $fill ?>"/>
    <path d="M82 112a18 18 0 0 0 14 22" stroke="rgba(255,255,255,.55)" stroke-width="6" fill="none" stroke-linecap="round"/>
    <text x="100" y="176" text-anchor="middle" font-family="system-ui,Segoe UI,Arial" font-size="14" font-weight="700" fill="#1a2f45"><?= e(trim($brand . ' ' . $model . ' · ' . $label)) ?></text>
  <?php else: ?>
    <rect x="52" y="58" width="96" height="84" rx="10" fill="#1a2f45"/>
    <text x="100" y="96" text-anchor="middle" font-family="system-ui,Segoe UI,Arial" font-size="22" font-weight="800" fill="#e2c070"><?= e(strtoupper($brand ?: 'Setwel')) ?></text>
    <text x="100" y="124" text-anchor="middle" font-family="system-ui,Segoe UI,Arial" font-size="15" font-weight="700" fill="#fff"><?= e($p['sku']) ?></text>
  <?php endif; ?>
</svg><?php endif;
