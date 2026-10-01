<?php
/**
 * Sends email through your hosting mailbox (SMTP), e.g. sa@setwelafrica.com.
 * If SMTP is not filled in under Admin → Settings, PHP's built-in mail() is used.
 * Every email is also written to storage/logs/mail.log so nothing is silently lost.
 */

function send_mail(string $to, string $subject, string $html, array $attachments = [], ?string $replyTo = null): bool
{
    $fromEmail = setting('mail_from') ?: setting('email');
    $fromName = setting('mail_from_name') ?: setting('business_name');
    $boundary = 'b' . bin2hex(random_bytes(8));
    $alt = 'a' . bin2hex(random_bytes(8));
    $text = trim(html_entity_decode(strip_tags(preg_replace(['/<br\s*\/?>/i', '/<\/(p|h\d|tr|li|div)>/i'], "\n", $html)), ENT_QUOTES, 'UTF-8'));
    $text = preg_replace("/\n{3,}/", "\n\n", preg_replace('/[ \t]+/', ' ', $text));

    $headers = [
        'Date: ' . date('r'),
        'From: ' . mime_header($fromName) . ' <' . $fromEmail . '>',
        'To: <' . $to . '>',
        'Subject: ' . mime_header($subject),
        'MIME-Version: 1.0',
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . (explode('@', $fromEmail)[1] ?? 'localhost') . '>',
    ];
    if ($replyTo) {
        $headers[] = 'Reply-To: <' . $replyTo . '>';
    }
    $altPart = "--$alt\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($text))
        . "--$alt\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html)) . "--$alt--\r\n";
    if ($attachments) {
        $headers[] = "Content-Type: multipart/mixed; boundary=\"$boundary\"";
        $body = "--$boundary\r\nContent-Type: multipart/alternative; boundary=\"$alt\"\r\n\r\n" . $altPart;
        foreach ($attachments as $att) {
            $body .= "--$boundary\r\nContent-Type: " . ($att['type'] ?? 'application/octet-stream') . '; name="' . $att['name'] . "\"\r\n"
                . "Content-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"" . $att['name'] . "\"\r\n\r\n"
                . chunk_split(base64_encode($att['data']));
        }
        $body .= "--$boundary--\r\n";
    } else {
        $headers[] = "Content-Type: multipart/alternative; boundary=\"$alt\"";
        $body = $altPart;
    }

    $ok = false;
    $error = '';
    try {
        if (setting('smtp_host')) {
            $ok = smtp_send($to, $fromEmail, implode("\r\n", $headers) . "\r\n\r\n" . $body);
        } else {
            $h = array_filter($headers, fn($l) => !str_starts_with($l, 'To:') && !str_starts_with($l, 'Subject:'));
            $ok = @mail($to, mime_header($subject), $body, implode("\r\n", $h), '-f' . $fromEmail);
        }
    } catch (Throwable $e) {
        $error = $e->getMessage();
    }
    log_message('mail', ($ok ? 'SENT' : 'FAILED') . " to=$to subject=\"$subject\"" . ($error ? " error=$error" : ''));
    return $ok;
}

function mime_header(string $s): string
{
    return preg_match('/[^\x20-\x7E]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
}

function smtp_send(string $to, string $from, string $data): bool
{
    $host = setting('smtp_host');
    $port = (int)setting('smtp_port', 465);
    $secure = setting('smtp_secure', 'ssl');
    $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $fp = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) {
        throw new RuntimeException("SMTP connect failed: $errstr ($errno)");
    }
    stream_set_timeout($fp, 20);
    $read = function () use ($fp) {
        $resp = '';
        while (($line = fgets($fp, 515)) !== false) {
            $resp .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }
        return $resp;
    };
    $cmd = function (string $c, array $expect) use ($fp, $read) {
        fwrite($fp, $c . "\r\n");
        $r = $read();
        if (!in_array((int)substr($r, 0, 3), $expect, true)) {
            throw new RuntimeException('SMTP error after "' . preg_replace('/^(AUTH|PASS).*/', '$1 ***', $c) . '": ' . trim($r));
        }
        return $r;
    };
    $read();
    $ehlo = 'EHLO ' . (parse_url(abs_url(), PHP_URL_HOST) ?: 'localhost');
    $cmd($ehlo, [250]);
    if ($secure === 'tls') {
        $cmd('STARTTLS', [220]);
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) {
            throw new RuntimeException('Could not start TLS');
        }
        $cmd($ehlo, [250]);
    }
    if (setting('smtp_user')) {
        $cmd('AUTH LOGIN', [334]);
        $cmd(base64_encode(setting('smtp_user')), [334]);
        $cmd(base64_encode(setting('smtp_pass')), [235]);
    }
    $cmd("MAIL FROM:<$from>", [250]);
    $cmd("RCPT TO:<$to>", [250, 251]);
    $cmd('DATA', [354]);
    $data = preg_replace('/^\./m', '..', str_replace(["\r\n", "\n"], ["\n", "\r\n"], $data));
    $cmd($data . "\r\n.", [250]);
    $cmd('QUIT', [221]);
    fclose($fp);
    return true;
}

/** Wrap email content in the Setwel Africa branded email template. */
function email_layout(string $title, string $bodyHtml): string
{
    $name = e(setting('business_name'));
    $footer = e(setting('legal_name')) . ' · ' . e(setting('phone')) . ' · ' . e(setting('email'));
    return '<!doctype html><html><body style="margin:0;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#1d2733">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f8;padding:24px 0"><tr><td align="center">'
        . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;overflow:hidden">'
        . '<tr><td style="background:#1a2f45;padding:20px 28px;color:#fff;font-size:20px;font-weight:bold;letter-spacing:.5px">' . $name . '<div style="height:3px;width:48px;background:#c9a84c;margin-top:8px"></div></td></tr>'
        . '<tr><td style="padding:28px;font-size:15px;line-height:1.6"><h1 style="font-size:20px;margin:0 0 16px;color:#1a2f45">' . e($title) . '</h1>' . $bodyHtml . '</td></tr>'
        . '<tr><td style="padding:16px 28px;background:#f7f5f0;font-size:12px;color:#5b6573">' . $footer . '</td></tr>'
        . '</table></td></tr></table></body></html>';
}

/** Table of order items for emails. */
function email_order_table(array $order, array $items): string
{
    $rows = '';
    foreach ($items as $it) {
        $rows .= '<tr><td style="padding:6px 0;border-bottom:1px solid #eee">' . e($it['name']) . ' <span style="color:#777">× ' . (int)$it['qty'] . '</span></td><td align="right" style="padding:6px 0;border-bottom:1px solid #eee">' . money($it['line_total']) . '</td></tr>';
    }
    $rows .= '<tr><td style="padding:6px 0">Delivery</td><td align="right">' . ((float)$order['delivery_fee'] > 0 ? money($order['delivery_fee']) : 'Free') . '</td></tr>';
    $rows .= '<tr><td style="padding:6px 0;font-weight:bold">Total</td><td align="right" style="font-weight:bold">' . money($order['total']) . '</td></tr>';
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">' . $rows . '</table>';
}
