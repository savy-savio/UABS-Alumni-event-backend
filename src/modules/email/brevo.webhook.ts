import {Router} from 'express';
import {timingSafeEqual} from 'node:crypto';
import {EmailDeliveryModel} from '../../models/EmailDelivery';
import {env} from '../../config/env';

const router = Router();

const safeEqual = (a: string, b: string) => {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
};

router.post('/', async (req, res) => {
  try {
    if (!env.BREVO_WEBHOOK_SECRET) return res.status(503).json({message: 'Webhook not configured'});

    // Brevo has no signature header, so we use a secret in the URL: /webhooks/brevo?secret=XXXX
    const provided = String(req.query.secret || req.header('x-webhook-secret') || '');
    if (!provided || !safeEqual(provided, env.BREVO_WEBHOOK_SECRET))
      return res.status(401).json({message: 'Invalid webhook secret'});

    const body: any = req.body || {};
    const type = String(body.event || '');
    const rawMessageId = String(body['message-id'] || '');
    const messageId = rawMessageId.replace(/^<|>$/g, '');
    const email = String(body.email || '').toLowerCase();
    if (!type || (!messageId && !email)) return res.status(200).json({received: true});

    // Match by provider message id first, then fall back to the latest delivery for that recipient.
    let log: any = null;
    if (messageId)
      log = await EmailDeliveryModel.findOne({
        providerMessageId: {$in: [messageId, `<${messageId}>`, rawMessageId]},
      });
    if (!log && email)
      log = await EmailDeliveryModel.findOne({
        emailAddress: email,
        status: {$in: ['PENDING', 'SENT', 'DELIVERED']},
      }).sort({createdAt: -1});
    if (!log) return res.status(200).json({received: true, matched: false});

    const eventId = `${type}:${messageId || email}:${body.ts_event || body.ts || body.date || ''}`;
    if (log.webhookEvents.includes(eventId)) return res.status(200).json({received: true, duplicate: true});
    log.webhookEvents.push(eventId);

    if (type === 'delivered' && log.status !== 'BOUNCED') log.status = 'DELIVERED';
    else if (['hard_bounce', 'blocked', 'spam', 'invalid_email', 'complaint'].includes(type) && log.status !== 'DELIVERED')
      log.status = 'BOUNCED';
    else if (type === 'request' && log.status === 'PENDING') log.status = 'SENT';
    else if (['deferred', 'soft_bounce'].includes(type) && log.status !== 'DELIVERED')
      log.lastError = type === 'deferred' ? 'Delivery delayed' : 'Soft bounce (temporary failure)';

    await log.save();
    return res.status(200).json({received: true});
  } catch {
    return res.status(400).json({message: 'Invalid webhook payload'});
  }
});

export default router;