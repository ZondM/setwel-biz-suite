<?php
/** Image and file uploads. Images are resized so pages stay fast on mobile data. */

const IMAGE_TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];

/**
 * Resize an image file and save a large version + a thumbnail into uploads/$folder.
 * Returns ['path' => ..., 'thumb' => ...] relative to the site root, or null if not a valid image.
 */
function store_image(string $tmpFile, string $folder, string $baseName, int $max = 1200, int $thumb = 480): ?array
{
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($tmpFile);
    if (!isset(IMAGE_TYPES[$mime])) {
        return null;
    }
    $dir = UPLOAD_DIR . '/' . $folder;
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $name = slugify($baseName) . '-' . bin2hex(random_bytes(3));

    if (!function_exists('imagecreatefromstring')) {
        // No GD on this server: keep the original file.
        $ext = IMAGE_TYPES[$mime];
        copy($tmpFile, "$dir/$name.$ext");
        return ['path' => "uploads/$folder/$name.$ext", 'thumb' => "uploads/$folder/$name.$ext"];
    }
    $src = @imagecreatefromstring(file_get_contents($tmpFile));
    if (!$src) {
        return null;
    }
    $out = [];
    foreach (['path' => $max, 'thumb' => $thumb] as $key => $size) {
        $w = imagesx($src);
        $h = imagesy($src);
        $scale = min(1, $size / max($w, $h));
        $nw = max(1, (int)round($w * $scale));
        $nh = max(1, (int)round($h * $scale));
        $dst = imagecreatetruecolor($nw, $nh);
        // White background (product photos with transparent backgrounds look clean on white).
        imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
        $file = $name . ($key === 'thumb' ? '-thumb' : '');
        if (function_exists('imagewebp')) {
            imagewebp($dst, "$dir/$file.webp", 82);
            $out[$key] = "uploads/$folder/$file.webp";
        } else {
            imagejpeg($dst, "$dir/$file.jpg", 85);
            $out[$key] = "uploads/$folder/$file.jpg";
        }
        imagedestroy($dst);
    }
    imagedestroy($src);
    return $out;
}

/** Normalise $_FILES['x'] (single or multiple) into a list. */
function uploaded_files(string $field): array
{
    $f = $_FILES[$field] ?? null;
    if (!$f) {
        return [];
    }
    if (!is_array($f['name'])) {
        return $f['error'] === UPLOAD_ERR_OK ? [$f] : [];
    }
    $list = [];
    foreach ($f['name'] as $i => $n) {
        if ($f['error'][$i] === UPLOAD_ERR_OK) {
            $list[] = ['name' => $n, 'tmp_name' => $f['tmp_name'][$i], 'size' => $f['size'][$i], 'error' => 0];
        }
    }
    return $list;
}

function add_product_image(int $productId, string $tmpFile, string $label, string $alt = ''): bool
{
    $res = store_image($tmpFile, 'products', $label);
    if (!$res) {
        return false;
    }
    $sort = (int)q_val('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM product_images WHERE product_id = ?', [$productId]);
    db_insert('product_images', ['product_id' => $productId, 'path' => $res['path'], 'thumb' => $res['thumb'], 'alt' => $alt, 'sort_order' => $sort]);
    return true;
}

function image_from_url(string $url, int $productId): bool
{
    $ctx = stream_context_create(['http' => ['timeout' => 15, 'follow_location' => 1, 'max_redirects' => 3, 'user_agent' => 'SetwelStore/1.0']]);
    $data = @file_get_contents($url, false, $ctx, 0, 10 * 1024 * 1024);
    if (!$data) {
        return false;
    }
    $tmp = tempnam(sys_get_temp_dir(), 'img');
    file_put_contents($tmp, $data);
    $p = q_one('SELECT name FROM products WHERE id = ?', [$productId]);
    $ok = add_product_image($productId, $tmp, $p['name'] ?? 'product', 'src:' . substr($url, 0, 240));
    @unlink($tmp);
    return $ok;
}

function delete_product_image(array $img): void
{
    foreach (['path', 'thumb'] as $k) {
        if (!empty($img[$k]) && str_starts_with($img[$k], 'uploads/')) {
            @unlink(ROOT_DIR . '/' . $img[$k]);
        }
    }
    q('DELETE FROM product_images WHERE id = ?', [$img['id']]);
}

/**
 * Save a document (PDF or image) into a PRIVATE storage folder. Returns the stored file name or an error string.
 * Used for proof-of-payment uploads and certificates/letters.
 */
function store_private_file(array $file, string $folder, int $maxMb = 8): array
{
    if ($file['size'] > $maxMb * 1024 * 1024) {
        return ['error' => "File is too large (maximum {$maxMb} MB)."];
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    $allowed = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if (!isset($allowed[$mime])) {
        return ['error' => 'Only PDF, JPG, PNG or WEBP files are allowed.'];
    }
    $dir = STORAGE_DIR . '/' . $folder;
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $name = date('Ymd-His') . '-' . bin2hex(random_bytes(6)) . '.' . $allowed[$mime];
    if (!move_uploaded_file($file['tmp_name'], "$dir/$name") && !copy($file['tmp_name'], "$dir/$name")) {
        return ['error' => 'Could not save the file. Please try again.'];
    }
    return ['name' => $name, 'mime' => $mime];
}

function send_private_file(string $folder, string $name, string $downloadName = ''): never
{
    $path = STORAGE_DIR . '/' . $folder . '/' . basename($name);
    if (!is_file($path)) {
        abort(404);
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($path);
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($path));
    header('Content-Disposition: inline; filename="' . ($downloadName ?: basename($path)) . '"');
    header('X-Content-Type-Options: nosniff');
    readfile($path);
    exit;
}
