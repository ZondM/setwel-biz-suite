<?php
/**
 * Read and write spreadsheets without extra libraries.
 * Reads: .csv and .xlsx (Excel 2007+). Old .xls files must be "Saved As" .xlsx or .csv first.
 * Writes: .csv and .xlsx.
 */

/** Returns rows as arrays of strings (first sheet only for xlsx). */
function sheet_read(string $file, string $originalName): array
{
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    return match ($ext) {
        'csv', 'txt' => csv_read($file),
        'xlsx', 'xlsm' => xlsx_read($file),
        'xls' => throw new RuntimeException('Old Excel (.xls) files are not supported. In Excel click File → Save As → choose "Excel Workbook (.xlsx)" and upload that file.'),
        default => throw new RuntimeException('Please upload a .xlsx or .csv file.'),
    };
}

function csv_read(string $file): array
{
    $raw = file_get_contents($file);
    if (str_starts_with($raw, "\xEF\xBB\xBF")) {
        $raw = substr($raw, 3);
    }
    if (!mb_check_encoding($raw, 'UTF-8')) {
        $raw = mb_convert_encoding($raw, 'UTF-8', 'Windows-1252');
    }
    // Detect separator: South African Excel often saves CSV with semicolons.
    $first = strtok($raw, "\n");
    $sep = substr_count($first, ';') > substr_count($first, ',') ? ';' : (substr_count($first, "\t") > substr_count($first, ',') ? "\t" : ',');
    $fh = fopen('php://memory', 'r+');
    fwrite($fh, $raw);
    rewind($fh);
    $rows = [];
    while (($r = fgetcsv($fh, 0, $sep, '"', '')) !== false) {
        $rows[] = array_map(fn($v) => trim((string)$v), $r);
    }
    fclose($fh);
    return $rows;
}

function xlsx_read(string $file): array
{
    $zip = new ZipArchive();
    if ($zip->open($file) !== true) {
        throw new RuntimeException('Could not open the Excel file. Is it a real .xlsx file?');
    }
    $shared = [];
    if (($xml = $zip->getFromName('xl/sharedStrings.xml')) !== false) {
        $sx = simplexml_load_string($xml);
        foreach ($sx->si as $si) {
            if (isset($si->t)) {
                $shared[] = (string)$si->t;
            } else {
                $s = '';
                foreach ($si->r as $r) {
                    $s .= (string)$r->t;
                }
                $shared[] = $s;
            }
        }
    }
    // Find the first sheet's file through the workbook relationships.
    $sheetPath = 'xl/worksheets/sheet1.xml';
    $wb = $zip->getFromName('xl/workbook.xml');
    $rels = $zip->getFromName('xl/_rels/workbook.xml.rels');
    if ($wb && $rels) {
        $wbx = simplexml_load_string($wb);
        $wbx->registerXPathNamespace('m', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main');
        $first = $wbx->xpath('//m:sheets/m:sheet')[0] ?? null;
        if ($first) {
            $rid = (string)$first->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships')['id'];
            $rx = simplexml_load_string($rels);
            foreach ($rx->Relationship as $rel) {
                if ((string)$rel['Id'] === $rid) {
                    $t = ltrim((string)$rel['Target'], '/');
                    $sheetPath = str_starts_with($t, 'xl/') ? $t : 'xl/' . $t;
                }
            }
        }
    }
    $sheet = $zip->getFromName($sheetPath);
    $zip->close();
    if ($sheet === false) {
        throw new RuntimeException('Could not find a worksheet in this Excel file.');
    }
    $sx = simplexml_load_string($sheet);
    $rows = [];
    foreach ($sx->sheetData->row as $row) {
        $r = [];
        foreach ($row->c as $c) {
            $ref = (string)$c['r'];
            $col = $ref ? col_index(preg_replace('/\d+/', '', $ref)) : count($r);
            $type = (string)$c['t'];
            if ($type === 's') {
                $v = $shared[(int)$c->v] ?? '';
            } elseif ($type === 'inlineStr') {
                $v = (string)$c->is->t;
                if ($v === '' && isset($c->is->r)) {
                    foreach ($c->is->r as $rr) {
                        $v .= (string)$rr->t;
                    }
                }
            } else {
                $v = (string)$c->v;
                // Tidy floating-point noise like 298.99999999999994
                if (is_numeric($v) && str_contains($v, '.') && strlen($v) > 12) {
                    $v = (string)round((float)$v, 6);
                }
            }
            while (count($r) < $col) {
                $r[] = '';
            }
            $r[$col] = trim($v);
        }
        $rows[] = $r;
    }
    return $rows;
}

function col_index(string $letters): int
{
    $n = 0;
    foreach (str_split(strtoupper($letters)) as $ch) {
        $n = $n * 26 + (ord($ch) - 64);
    }
    return $n - 1;
}

function col_letter(int $i): string
{
    $s = '';
    $i++;
    while ($i > 0) {
        $m = ($i - 1) % 26;
        $s = chr(65 + $m) . $s;
        $i = intdiv($i - 1, 26);
    }
    return $s;
}

function csv_download(string $filename, array $rows): never
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // so Excel opens it as UTF-8
    foreach ($rows as $r) {
        // Stop spreadsheet formulas sneaking in through customer-typed text (CSV injection).
        $r = array_map(fn($v) => is_string($v) && $v !== '' && !is_numeric($v) && in_array($v[0], ['=', '+', '@'], true) ? "'" . $v : $v, $r);
        fputcsv($out, $r, ',', '"', '');
    }
    fclose($out);
    exit;
}

/** Build a simple .xlsx file. $rows[0] is treated as a bold header row. */
function xlsx_build(array $rows, string $sheetName = 'Products', array $widths = []): string
{
    $tmp = tempnam(sys_get_temp_dir(), 'xlsx');
    $zip = new ZipArchive();
    $zip->open($tmp, ZipArchive::OVERWRITE);
    $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
    $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' . htmlspecialchars($sheetName, ENT_XML1) . '" sheetId="1" r:id="rId1"/></sheets></workbook>');
    $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    $zip->addFromString('xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1A2F45"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs></styleSheet>');
    $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
    if ($rows) {
        $xml .= '<cols>';
        foreach (array_keys($rows[0]) as $i) {
            $w = $widths[$i] ?? 18;
            $xml .= '<col min="' . ($i + 1) . '" max="' . ($i + 1) . '" width="' . $w . '" customWidth="1"/>';
        }
        $xml .= '</cols>';
    }
    $xml .= '<sheetData>';
    foreach ($rows as $ri => $row) {
        $xml .= '<row r="' . ($ri + 1) . '">';
        foreach (array_values($row) as $ci => $v) {
            $ref = col_letter($ci) . ($ri + 1);
            $style = $ri === 0 ? ' s="1"' : '';
            if ($ri > 0 && is_numeric($v) && !preg_match('/^0\d/', (string)$v) && strlen((string)$v) < 15) {
                $xml .= '<c r="' . $ref . '"' . $style . '><v>' . $v . '</v></c>';
            } elseif ((string)$v !== '') {
                $xml .= '<c r="' . $ref . '" t="inlineStr"' . $style . '><is><t xml:space="preserve">' . htmlspecialchars((string)$v, ENT_XML1 | ENT_QUOTES, 'UTF-8') . '</t></is></c>';
            }
        }
        $xml .= '</row>';
    }
    $xml .= '</sheetData></worksheet>';
    $zip->addFromString('xl/worksheets/sheet1.xml', $xml);
    $zip->close();
    $data = file_get_contents($tmp);
    @unlink($tmp);
    return $data;
}

function xlsx_download(string $filename, array $rows, array $widths = []): never
{
    $data = xlsx_build($rows, 'Products', $widths);
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($data));
    echo $data;
    exit;
}
