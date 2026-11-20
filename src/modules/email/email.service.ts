import nodemailer, {Transporter} from 'nodemailer';
import {env} from '../../config/env';
import {EmailDeliveryModel} from '../../models/EmailDelivery';
import type {EmailPayload} from './email.types';
import {MAX_EMAIL_ATTEMPTS} from './email.constants';

let transporter: Transporter | undefined;
const getTransporter = () =>
  transporter ||
  (transporter = nodemailer.createTransport({
    host: env.BREVO_SMTP_HOST,
    port: env.BREVO_SMTP_PORT,
    secure: env.BREVO_SMTP_PORT === 465,
    auth: {user: env.BREVO_SMTP_LOGIN, pass: env.BREVO_SMTP_KEY},
  }));

const valid = (s: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);

export const emailService = {
  async send(payload: EmailPayload) {
    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
    if (!recipients.length || recipients.some(r => !valid(r))) throw new Error('Invalid email recipient');

    const key = payload.idempotencyKey;
    let log: any;
    if (key) {
      log = await EmailDeliveryModel.findOne({idempotencyKey: key});
      if (log && log.status === 'SENT') return {sent: true, messageId: log.providerMessageId, skipped: true};
    }
    if (!log)
      log = await EmailDeliveryModel.create({
        eventId: payload.eventId,
        participantId: payload.participantId,
        emailAddress: recipients.join(','),
        emailType: payload.type,
        status: 'PENDING',
        idempotencyKey: key,
        adminId: payload.adminId,
      });

    log.attempts = (log.attempts || 0) + 1;
    log.lastAttemptAt = new Date();
    await log.save();

    const brevoConfigured = !!(env.BREVO_SMTP_LOGIN && env.BREVO_SMTP_KEY);
    if (!env.EMAIL_ENABLED || env.NODE_ENV === 'test' || !brevoConfigured) {
      log.status = 'FAILED';
      log.lastError = !env.EMAIL_ENABLED
        ? 'Email delivery disabled'
        : env.NODE_ENV === 'test'
        ? 'Test mode suppresses delivery'
        : 'Brevo SMTP credentials missing';
      await log.save();
      return {sent: false, error: log.lastError, deliveryId: String(log._id)};
    }

    if (log.attempts > MAX_EMAIL_ATTEMPTS) {
      log.status = 'FAILED';
      log.lastError = 'Maximum email attempts exceeded';
      await log.save();
      return {sent: false, error: log.lastError, deliveryId: String(log._id)};
    }

    try {
      const info = await getTransporter().sendMail({
        from: {name: env.EMAIL_FROM_NAME, address: env.EMAIL_FROM},
        to: recipients,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo || env.EMAIL_REPLY_TO,
        attachments: payload.attachments?.map(a => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
          cid: a.contentId, // inline images (logo, QR) referenced as cid: in the templates
        })),
      });
      log.status = 'SENT';
      log.providerMessageId = info.messageId;
      log.lastSuccessfulSendAt = new Date();
      log.lastError = undefined;
      await log.save();
      return {sent: true, messageId: info.messageId, deliveryId: String(log._id)};
    } catch (err) {
      log.status = 'FAILED';
      log.lastError = String((err as any)?.message || 'Provider error').slice(0, 500);
      await log.save();
      return {sent: false, error: log.lastError, deliveryId: String(log._id)};
    }
  },
};