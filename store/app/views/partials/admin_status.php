<?php $cls = ['pending_payment' => 'warn', 'payment_review' => 'info', 'processing' => 'gold', 'ready_for_collection' => 'info', 'shipped' => 'info', 'completed' => 'ok', 'cancelled' => 'bad'][$o['status']] ?? ''; ?>
<span class="badge <?= $cls ?>"><?= e(order_status_label($o['status'])) ?></span><?php if ($o['payment_status'] === 'paid'): ?> <span class="badge ok">Paid</span><?php endif; ?>
