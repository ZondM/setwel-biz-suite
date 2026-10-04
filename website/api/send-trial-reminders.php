<?php
/**
 * Emails a PayFast activation link to every trial whose 30 days are up.
 *
 * This is NOT a web page — it refuses to run over HTTP, because it sends
 * real emails on behalf of your business and must only ever run on a
 * schedule you control, not whenever someone happens to request a URL.
 *
 * ONE-TIME SETUP on your live host: add a daily cron job that runs
 *
 *   php /full/path/to/website/api/send-trial-reminders.php
 *
 * In cPanel: Cron Jobs → Add New Cron Job → once a day (e.g. 08:00),
 * command: php /home/youruser/public_html/api/send-trial-reminders.php
 * (adjust the path to match where this site actually lives on your host).
 * Without this cron job, trials will start correctly with no payment
 * taken, but nobody will ever be emailed the activation link after their
 * 30 days end — set it up before you rely on this for real customers.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo "This script only runs from the command line (cron), not the web.";
    exit;
}

require __DIR__ . '/config.php';
require __DIR__ . '/payfast.php';

$due = pf_trials_due_for_reminder();
if (!$due) {
    pf_log('send-trial-reminders: nothing due');
    echo "No trial reminders due.\n";
    exit;
}

foreach ($due as $id => $trial) {
    pf_email_trial_activation_link($trial, $id);
    pf_update_trial($id, ['reminder_sent_at' => date('c')]);
    pf_log('Trial reminder + activation link emailed — ' . $id, ['email' => $trial['email'] ?? '']);
}

echo count($due) . " trial reminder(s) sent.\n";
