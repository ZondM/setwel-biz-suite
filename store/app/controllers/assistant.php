<?php
/** POST /api/chat — the website chat widget talks to the AI assistant here. */

function chat_api(): void
{
    $wa = 'https://wa.me/' . wa_number(setting('whatsapp'));
    if (!assistant_enabled()) {
        json_out(['reply' => 'Our assistant is offline. Please WhatsApp us on ' . setting('whatsapp') . ' — we reply quickly.', 'wa' => $wa]);
    }
    $text = trim((string)($_POST['message'] ?? ''));
    if ($text === '') {
        json_out(['reply' => 'Please type your question.']);
    }
    $text = mb_substr($text, 0, 1000);
    if (rate_limited('chat', 30, 3600)) {
        json_out(['reply' => 'You have sent a lot of messages. Please continue on WhatsApp: ' . setting('whatsapp') . '.', 'wa' => $wa]);
    }
    $chat = !empty($_SESSION['chat_id']) ? q_one('SELECT * FROM chats WHERE id = ?', [(int)$_SESSION['chat_id']]) : null;
    if (!$chat) {
        $today = (int)q_val('SELECT COUNT(*) FROM chats WHERE created_at >= ?', [date('Y-m-d 00:00:00')]);
        if ($today >= max(1, (int)setting('ai_daily_limit', 200))) {
            json_out(['reply' => 'Our assistant is very busy today. Please WhatsApp us on ' . setting('whatsapp') . ' and a person will help you.', 'wa' => $wa]);
        }
        $id = db_insert('chats', ['skey' => bin2hex(random_bytes(16)), 'messages' => '[]', 'ip' => client_ip(), 'created_at' => now(), 'updated_at' => now()]);
        $_SESSION['chat_id'] = $id;
        $chat = q_one('SELECT * FROM chats WHERE id = ?', [$id]);
    }
    if ((int)$chat['turns'] >= ASSISTANT_MAX_TURNS) {
        json_out(['reply' => 'This chat is getting long — please continue with a person on WhatsApp (' . setting('whatsapp') . ') so nothing gets missed.', 'wa' => $wa]);
    }
    @set_time_limit(120);
    $out = assistant_reply($chat, $text);
    json_out($out + ['wa' => $wa]);
}
