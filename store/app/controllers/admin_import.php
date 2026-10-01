<?php
/** Admin: Excel/CSV import wizard — 1. upload, 2. match columns, 3. preview & errors, 4. import. */

function import_state(): ?array
{
    $s = $_SESSION['import'] ?? null;
    if (!$s || !is_file($s['file'])) {
        return null;
    }
    $s['data'] = json_decode(file_get_contents($s['file']), true);
    return $s;
}

function import_clear(): void
{
    if (!empty($_SESSION['import']['file'])) {
        @unlink($_SESSION['import']['file']);
    }
    unset($_SESSION['import']);
}

function admin_import(): void
{
    require_admin();
    // Remove abandoned upload files older than a day.
    foreach (glob(STORAGE_DIR . '/tmp/import-*.json') ?: [] as $old) {
        if (filemtime($old) < time() - 86400) {
            @unlink($old);
        }
    }
    $presets = q_all('SELECT * FROM import_presets ORDER BY name');

    if (is_post()) {
        $action = $_POST['action'] ?? '';
        if ($action === 'cancel') {
            import_clear();
            redirect('/admin/import');
        }
        if ($action === 'upload') {
            $f = uploaded_files('file')[0] ?? null;
            if (!$f) {
                flash('error', 'Please choose a .xlsx or .csv file.');
                redirect('/admin/import');
            }
            try {
                $rows = sheet_read($f['tmp_name'], $f['name']);
            } catch (Throwable $e) {
                flash('error', $e->getMessage());
                redirect('/admin/import');
            }
            if (count($rows) < 2) {
                flash('error', 'The file looks empty (it needs a heading row and at least one product row).');
                redirect('/admin/import');
            }
            $h = import_find_header($rows);
            $headers = array_map(fn($v) => trim((string)$v), $rows[$h]);
            $body = array_slice($rows, $h + 1);
            $width = max(array_map('count', array_merge([$headers], $body)));
            $headers = array_pad($headers, $width, '');
            foreach ($headers as $i => $hd) {
                if ($hd === '') {
                    $headers[$i] = 'Column ' . col_letter($i);
                }
            }
            import_clear();
            $file = STORAGE_DIR . '/tmp/import-' . bin2hex(random_bytes(8)) . '.json';
            file_put_contents($file, json_encode(['name' => $f['name'], 'headers' => $headers, 'rows' => $body, 'header_row' => $h + 1]));
            // Starting mapping: our own export headings → preset → automatic guess.
            $own = export_header_map();
            $map = import_guess_mapping($headers);
            $preset = null;
            if (!empty($_POST['preset'])) {
                $preset = q_one('SELECT * FROM import_presets WHERE id = ?', [(int)$_POST['preset']]);
            }
            $pm = $preset ? json_decode($preset['mapping'], true) : [];
            // A file exported from this store (or made from the template) has several of our own headings.
            $isOwn = count(array_filter($headers, fn($hd) => isset($own[norm_header($hd)]))) >= 4;
            foreach ($headers as $i => $hd) {
                $n = norm_header($hd);
                if (isset($pm['map'][$n])) {
                    $map[$i] = $pm['map'][$n];
                } elseif ($isOwn && isset($own[$n])) {
                    $map[$i] = $own[$n];
                }
            }
            $_SESSION['import'] = ['file' => $file, 'map' => $map, 'opts' => $pm['opts'] ?? ['mode' => 'full', 'price_calc' => 'blank', 'default_brand' => '', 'default_category' => '', 'hide_new' => 0, 'keep_names' => 1]];
            redirect('/admin/import?step=map');
        }
        $st = import_state();
        if (!$st) {
            flash('error', 'Please upload the file again.');
            redirect('/admin/import');
        }
        if ($action === 'map') {
            $map = [];
            foreach ($st['data']['headers'] as $i => $hd) {
                $v = $_POST['map'][$i] ?? '';
                $map[$i] = isset(import_fields()[$v]) ? $v : '';
            }
            $opts = [
                'mode' => ($_POST['mode'] ?? '') === 'prices' ? 'prices' : 'full',
                'price_calc' => in_array($_POST['price_calc'] ?? '', ['blank', 'always', 'never'], true) ? $_POST['price_calc'] : 'blank',
                'default_brand' => trim($_POST['default_brand'] ?? ''),
                'default_category' => trim($_POST['default_category'] ?? ''),
                'hide_new' => !empty($_POST['hide_new']) ? 1 : 0,
                'keep_names' => !empty($_POST['keep_names']) ? 1 : 0,
            ];
            $_SESSION['import']['map'] = $map;
            $_SESSION['import']['opts'] = $opts;
            if (!in_array('sku', $map, true)) {
                flash('error', 'Please tell us which column holds the SKU / product code.');
                redirect('/admin/import?step=map');
            }
            if (($name = trim($_POST['preset_name'] ?? '')) !== '') {
                $byName = [];
                foreach ($st['data']['headers'] as $i => $hd) {
                    if ($map[$i] !== '') {
                        $byName[norm_header($hd)] = $map[$i];
                    }
                }
                $json = json_encode(['map' => $byName, 'opts' => $opts]);
                if ($ex = q_val('SELECT id FROM import_presets WHERE name = ?', [$name])) {
                    q('UPDATE import_presets SET mapping = ? WHERE id = ?', [$json, $ex]);
                } else {
                    db_insert('import_presets', ['name' => $name, 'mapping' => $json, 'created_at' => now()]);
                }
                flash('success', 'Column matching saved as "' . $name . '" — choose it next time you upload.');
            }
            redirect('/admin/import?step=preview');
        }
        if ($action === 'apply') {
            $analysed = import_analyse($st['data']['rows'], $st['map'], $st['opts']);
            try {
                $counts = import_apply($analysed);
            } catch (Throwable $e) {
                error_log($e);
                flash('error', 'Import stopped and nothing was saved: ' . $e->getMessage());
                redirect('/admin/import?step=preview');
            }
            $errors = count(array_filter($analysed, fn($l) => $l['action'] === 'error'));
            import_clear();
            flash('success', "Import finished: {$counts['created']} added, {$counts['updated']} updated" . ($errors ? ", $errors row(s) with errors skipped" : '') . ($counts['images'] ? ", {$counts['images']} image(s) downloaded" : '') . ($counts['image_errors'] ? ", {$counts['image_errors']} image(s) could not be downloaded" : '') . '.');
            redirect('/admin/products');
        }
        if ($action === 'delete_preset') {
            q('DELETE FROM import_presets WHERE id = ?', [(int)$_POST['id']]);
            redirect('/admin/import');
        }
    }

    $step = $_GET['step'] ?? '';
    $st = import_state();
    if ($step === 'map' && $st) {
        admin_view('import_map', ['title' => 'Import — match columns', 'st' => $st, 'sample' => array_slice($st['data']['rows'], 0, 3), 'brands' => q_all('SELECT name FROM brands ORDER BY name'), 'categories' => q_all('SELECT name FROM categories ORDER BY name')]);
        return;
    }
    if ($step === 'preview' && $st) {
        $analysed = import_analyse($st['data']['rows'], $st['map'], $st['opts']);
        $count = fn($a) => count(array_filter($analysed, fn($l) => $l['action'] === $a));
        admin_view('import_preview', ['title' => 'Import — preview', 'st' => $st, 'lines' => $analysed,
            'summary' => ['create' => $count('create'), 'update' => $count('update'), 'nochange' => $count('nochange'), 'error' => $count('error'), 'skip' => $count('skip')]]);
        return;
    }
    admin_view('import', ['title' => 'Import products', 'presets' => $presets, 'pending' => $st]);
}

function admin_import_template(string $type): void
{
    require_admin();
    $rows = template_rows();
    if ($type === 'csv') {
        csv_download('setwel-product-import-template.csv', $rows);
    }
    xlsx_download('setwel-product-import-template.xlsx', $rows, [14, 48, 12, 16, 14, 12, 11, 12, 13, 8, 9, 40, 50, 50, 40, 40, 14, 14, 20, 30, 40]);
}
