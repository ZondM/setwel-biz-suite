<?php
/**
 * Builds dist/setwel-store-upload.zip — the file you upload to cPanel.
 * Run:  php build-store-zip.php
 * Private/runtime files (config, database, uploads, logs) are never included.
 */
$src = __DIR__ . '/store';
$out = __DIR__ . '/dist/setwel-store-upload.zip';
@mkdir(dirname($out), 0755, true);
@unlink($out);
$skip = '#^(app/config\.php|storage/(db|pop|docs|tmp|logs)/(?!\.gitkeep$).+|uploads/(products|banners|brands)/(?!\.gitkeep$).+)$#';
$zip = new ZipArchive();
$zip->open($out, ZipArchive::CREATE);
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($src, FilesystemIterator::SKIP_DOTS));
$n = 0;
foreach ($it as $file) {
    $rel = str_replace('\\', '/', substr($file->getPathname(), strlen($src) + 1));
    if (preg_match($skip, $rel)) {
        continue;
    }
    $zip->addFile($file->getPathname(), $rel);
    $n++;
}
$zip->close();
echo "Built $out ($n files, " . round(filesize($out) / 1024) . " KB)\n";
