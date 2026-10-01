<?php
/**
 * Tiny PDF writer (no external libraries needed) used for invoices.
 * Coordinates are in points from the TOP-LEFT of an A4 page (595 × 842).
 */
class SimplePdf
{
    private array $pages = [];
    private string $cur = '';
    private array $images = [];
    private const W = 595.28;
    private const H = 841.89;

    private const WIDTHS_REG = [32 => 278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
    private const WIDTHS_BOLD = [32 => 278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

    public function addPage(): void
    {
        if ($this->cur !== '') {
            $this->pages[] = $this->cur;
        }
        $this->cur = ' ';
    }

    private static function enc(string $s): string
    {
        $s = @iconv('UTF-8', 'Windows-1252//TRANSLIT', $s);
        return $s === false ? '' : $s;
    }

    private static function color(string $hex): string
    {
        $hex = ltrim($hex, '#');
        return sprintf('%.3F %.3F %.3F', hexdec(substr($hex, 0, 2)) / 255, hexdec(substr($hex, 2, 2)) / 255, hexdec(substr($hex, 4, 2)) / 255);
    }

    public function textWidth(string $s, float $size, bool $bold = false): float
    {
        $w = 0;
        $tbl = $bold ? self::WIDTHS_BOLD : self::WIDTHS_REG;
        $s = self::enc($s);
        for ($i = 0, $n = strlen($s); $i < $n; $i++) {
            $w += $tbl[ord($s[$i])] ?? 556;
        }
        return $w * $size / 1000;
    }

    /** align: L, R or C. $x is the left edge (L), right edge (R) or centre (C). */
    public function text(float $x, float $y, string $s, float $size = 10, bool $bold = false, string $color = '1d2733', string $align = 'L'): void
    {
        if ($align === 'R') {
            $x -= $this->textWidth($s, $size, $bold);
        } elseif ($align === 'C') {
            $x -= $this->textWidth($s, $size, $bold) / 2;
        }
        $t = str_replace(['\\', '(', ')', "\r"], ['\\\\', '\\(', '\\)', ''], self::enc($s));
        $this->cur .= sprintf("BT /%s %.2F Tf %s rg %.2F %.2F Td (%s) Tj ET\n", $bold ? 'F2' : 'F1', $size, self::color($color), $x, self::H - $y, $t);
    }

    /** Wrap text into lines that fit $width. Returns the lines. */
    public function wrap(string $s, float $width, float $size, bool $bold = false): array
    {
        $lines = [];
        foreach (preg_split('/\r?\n/', $s) as $para) {
            $line = '';
            foreach (preg_split('/\s+/', trim($para)) as $word) {
                $try = $line === '' ? $word : "$line $word";
                if ($this->textWidth($try, $size, $bold) > $width && $line !== '') {
                    $lines[] = $line;
                    $line = $word;
                } else {
                    $line = $try;
                }
            }
            $lines[] = $line;
        }
        return $lines;
    }

    public function rect(float $x, float $y, float $w, float $h, string $fill): void
    {
        $this->cur .= sprintf("%s rg %.2F %.2F %.2F %.2F re f\n", self::color($fill), $x, self::H - $y - $h, $w, $h);
    }

    public function line(float $x1, float $y1, float $x2, float $y2, string $color = 'd9dee5', float $width = 0.7): void
    {
        $this->cur .= sprintf("%s RG %.2F w %.2F %.2F m %.2F %.2F l S\n", self::color($color), $width, $x1, self::H - $y1, $x2, self::H - $y2);
    }

    /** Place a JPEG image (only baseline JPEG is supported). */
    public function jpeg(string $file, float $x, float $y, float $w): void
    {
        $info = @getimagesize($file);
        if (!$info || $info[2] !== IMAGETYPE_JPEG) {
            return;
        }
        $key = md5($file);
        if (!isset($this->images[$key])) {
            $this->images[$key] = ['data' => file_get_contents($file), 'w' => $info[0], 'h' => $info[1], 'n' => count($this->images) + 1, 'cs' => ($info['channels'] ?? 3) === 1 ? '/DeviceGray' : (($info['channels'] ?? 3) === 4 ? '/DeviceCMYK' : '/DeviceRGB')];
        }
        $im = $this->images[$key];
        $h = $w * $im['h'] / $im['w'];
        $this->cur .= sprintf("q %.2F 0 0 %.2F %.2F %.2F cm /I%d Do Q\n", $w, $h, $x, self::H - $y - $h, $im['n']);
    }

    public function output(): string
    {
        if ($this->cur !== '') {
            $this->pages[] = $this->cur;
            $this->cur = '';
        }
        $objs = [];
        $objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        $objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
        $n = 5;
        $xobj = '';
        foreach ($this->images as $im) {
            $objs[$n] = "<< /Type /XObject /Subtype /Image /Width {$im['w']} /Height {$im['h']} /ColorSpace {$im['cs']} /BitsPerComponent 8 /Filter /DCTDecode /Length " . strlen($im['data']) . " >>\nstream\n" . $im['data'] . "\nendstream";
            $xobj .= "/I{$im['n']} $n 0 R ";
            $n++;
        }
        $kids = [];
        foreach ($this->pages as $content) {
            $c = gzcompress($content);
            $objs[$n] = '<< /Length ' . strlen($c) . " /Filter /FlateDecode >>\nstream\n" . $c . "\nendstream";
            $objs[$n + 1] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' . self::W . ' ' . self::H . "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << $xobj>> >> /Contents $n 0 R >>";
            $kids[] = ($n + 1) . ' 0 R';
            $n += 2;
        }
        $objs[2] = '<< /Type /Pages /Kids [' . implode(' ', $kids) . '] /Count ' . count($kids) . ' >>';
        ksort($objs);
        $out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [];
        foreach ($objs as $i => $o) {
            $offsets[$i] = strlen($out);
            $out .= "$i 0 obj\n$o\nendobj\n";
        }
        $xref = strlen($out);
        $max = max(array_keys($objs));
        $out .= "xref\n0 " . ($max + 1) . "\n0000000000 65535 f \n";
        for ($i = 1; $i <= $max; $i++) {
            $out .= sprintf("%010d 00000 n \n", $offsets[$i] ?? 0);
        }
        $out .= "trailer\n<< /Size " . ($max + 1) . " /Root 1 0 R >>\nstartxref\n$xref\n%%EOF";
        return $out;
    }
}

/**
 * Invoice / receipt PDF for an order.
 * Setwel Africa is not VAT registered, so this is an "INVOICE" (not a "TAX INVOICE") and no VAT is shown.
 */
function invoice_pdf(array $order, array $items): string
{
    $pdf = new SimplePdf();
    $pdf->addPage();
    $navy = '1a2f45';
    $gold = 'c9a84c';
    $muted = '5b6573';
    $paid = $order['payment_status'] === 'paid';

    $pdf->rect(0, 0, 595.28, 110, $navy);
    $pdf->rect(0, 110, 595.28, 4, $gold);
    $logo = ROOT_DIR . '/assets/img/logo-pdf.jpg';
    if (is_file($logo)) {
        $pdf->jpeg($logo, 40, 22, 66);
    }
    $pdf->text(120, 50, setting('legal_name') ?: setting('business_name'), 18, true, 'ffffff');
    $pdf->text(120, 70, setting('tagline'), 9, false, 'e2c070');
    $docTitle = $paid ? 'RECEIPT' : 'INVOICE';
    $pdf->text(555, 50, $docTitle, 22, true, 'ffffff', 'R');
    $pdf->text(555, 72, $order['ref'], 11, false, 'e2c070', 'R');

    $y = 145;
    $pdf->text(40, $y, 'FROM', 8, true, $muted);
    $pdf->text(320, $y, 'BILL TO', 8, true, $muted);
    $y += 15;
    $from = array_filter(array_merge(
        [setting('legal_name')],
        setting('registration_number') ? ['Reg. no: ' . setting('registration_number')] : [],
        preg_split('/\r?\n/', setting('address')),
        [setting('phone'), setting('email')]
    ));
    $to = array_filter([
        $order['customer_name'], $order['company'], $order['customer_vat'] ? 'VAT no: ' . $order['customer_vat'] : '',
        $order['delivery_method'] === 'courier' ? $order['address1'] : '', $order['delivery_method'] === 'courier' ? $order['address2'] : '',
        $order['delivery_method'] === 'courier' ? trim($order['city'] . ', ' . $order['province'] . ' ' . $order['postal_code'], ', ') : 'Collection',
        $order['phone'], $order['email'],
    ]);
    $yy = $y;
    foreach ($from as $l) {
        $pdf->text(40, $yy, $l, 9.5);
        $yy += 13;
    }
    $yy2 = $y;
    foreach ($to as $l) {
        $pdf->text(320, $yy2, $l, 9.5);
        $yy2 += 13;
    }
    $y = max($yy, $yy2) + 12;

    $meta = [
        ['Date', date('d M Y', strtotime($order['created_at']))],
        ['Payment', $order['payment_method'] === 'payfast' ? 'PayFast (card / EFT)' : 'Bank EFT'],
        ['Status', $paid ? 'PAID' . ($order['paid_at'] ? ' ' . date('d M Y', strtotime($order['paid_at'])) : '') : 'Awaiting payment'],
    ];
    $x = 40;
    foreach ($meta as [$k, $v]) {
        $pdf->text($x, $y, strtoupper($k), 7.5, true, $muted);
        $pdf->text($x, $y + 13, $v, 10, true, $k === 'Status' ? ($paid ? '1e7d4f' : 'a0522d') : '1d2733');
        $x += 170;
    }
    $y += 38;

    $pdf->rect(40, $y, 515, 22, 'f0f2f5');
    $pdf->text(48, $y + 15, 'Item', 9, true);
    $pdf->text(330, $y + 15, 'Qty', 9, true, '1d2733', 'R');
    $pdf->text(440, $y + 15, 'Unit price', 9, true, '1d2733', 'R');
    $pdf->text(547, $y + 15, 'Amount', 9, true, '1d2733', 'R');
    $y += 22;
    foreach ($items as $it) {
        $lines = $pdf->wrap($it['name'] . ($it['sku'] ? '  [' . $it['sku'] . ']' : ''), 250, 9.5);
        $rowH = max(22, 8 + 13 * count($lines));
        if ($y + $rowH > 760) {
            $pdf->addPage();
            $y = 50;
        }
        $ly = $y + 15;
        foreach ($lines as $l) {
            $pdf->text(48, $ly, $l, 9.5);
            $ly += 13;
        }
        $pdf->text(330, $y + 15, (string)$it['qty'], 9.5, false, '1d2733', 'R');
        $pdf->text(440, $y + 15, money($it['price']), 9.5, false, '1d2733', 'R');
        $pdf->text(547, $y + 15, money($it['line_total']), 9.5, false, '1d2733', 'R');
        $y += $rowH;
        $pdf->line(40, $y, 555, $y);
    }
    $y += 18;
    $tot = [
        ['Subtotal', money($order['subtotal'])],
        [$order['delivery_method'] === 'collect' ? 'Collection' : 'Delivery', (float)$order['delivery_fee'] > 0 ? money($order['delivery_fee']) : 'Free'],
    ];
    foreach ($tot as [$k, $v]) {
        $pdf->text(440, $y, $k, 10, false, $muted, 'R');
        $pdf->text(547, $y, $v, 10, false, '1d2733', 'R');
        $y += 16;
    }
    $pdf->rect(330, $y - 4, 225, 26, $navy);
    $pdf->text(440, $y + 13, 'TOTAL', 11, true, 'ffffff', 'R');
    $pdf->text(547, $y + 13, money($order['total']), 12, true, 'ffffff', 'R');
    $y += 44;

    if (setting('vat_registered') !== '1') {
        $pdf->text(40, $y, (setting('legal_name') ?: setting('business_name')) . ' is not registered for VAT. No VAT has been charged.', 8.5, false, $muted);
        $y += 16;
    }
    if (!$paid && $order['payment_method'] === 'eft' && setting('bank_account_number')) {
        $y += 6;
        $pdf->text(40, $y, 'BANKING DETAILS (use reference ' . $order['ref'] . ')', 8, true, $muted);
        $y += 14;
        foreach ([
            'Bank: ' . setting('bank_name'),
            'Account name: ' . setting('bank_account_name'),
            'Account number: ' . setting('bank_account_number'),
            'Branch code: ' . setting('bank_branch_code') . '   Type: ' . setting('bank_account_type'),
        ] as $l) {
            $pdf->text(40, $y, $l, 9.5);
            $y += 13;
        }
    }
    $pdf->line(40, 790, 555, 790, $gold, 1);
    $pdf->text(297, 805, 'Thank you for your business · ' . (setting('site_url') ? preg_replace('#^https?://#', '', setting('site_url')) : setting('email')), 8.5, false, $muted, 'C');
    return $pdf->output();
}
