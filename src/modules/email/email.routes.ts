import { Router, Request, Response, NextFunction } from 'express';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rateLimit } from 'express-rate-limit';

import { ParticipantModel } from '../../models/Participant';
import { EventModel } from '../../models/Event';
import { ParticipantCategoryModel } from '../../models/ParticipantCategory';
import { getCurrentQr } from '../../services/qr.service';
import { renderMail } from './email.templates';
import { emailService } from './email.service';
import { authenticate } from '../../middleware/authenticate';
import { authorizeRoles } from '../../middleware/authorize';
import { generateParticipantPdf } from '../pdf/pdf.service';

type LeanDoc = Record<string, any>;

const router = Router();

/* ------------------------------------------------------------------ */
/* Rate limiter: 5 resend requests per hour                           */
/* ------------------------------------------------------------------ */

const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ------------------------------------------------------------------ */
/* POST /participants/:id/resend                                      */
/* ------------------------------------------------------------------ */

async function resendRegistrationEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1. Load participant and check the QR credential
    const p: any = await ParticipantModel.findById(req.params.id);
    if (!p) {
      res.status(404).json({ message: 'Participant not found' });
      return;
    }
    if (p.qrStatus !== 'ACTIVE') {
      res.status(400).json({ message: 'Participant QR credential is not active' });
      return;
    }

    // 2. Load related event, category and current QR
    const event = (await EventModel.findById(p.eventId).lean()) as unknown as LeanDoc | null;
    const category = (await ParticipantCategoryModel.findById(p.categoryId).lean()) as unknown as LeanDoc | null;
    const qr = await getCurrentQr(String(p._id));
    if (!event || !qr) {
      res.status(400).json({ message: 'Active accreditation credential unavailable' });
      return;
    }

    // 3. Build the email content
    const qrCid = 'uabs-accreditation-qr';
    const mail = renderMail('REGISTRATION_RECEIVED', {
      name: p.fullName,
      email: p.email,
      registrationId: p.registrationId,
      category: category?.name,
      status: p.registrationStatus,
      matriculationNumber: p.matriculationNumber,
      programme: p.enrolledProgramme,
      event,
      qrCid,
    });

    // 4. Generate the PDF (best effort: the email still goes out without it)
    let pdfAttachment: { filename: string; content: Buffer; contentType: string } | undefined;
    try {
      const pdf = await generateParticipantPdf(String(p._id));
      pdfAttachment = { filename: pdf.filename, content: pdf.buffer, contentType: 'application/pdf' };
    } catch {
      /* PDF is optional */
    }

    // 5. Send the email
    const result = await emailService.send({
      to: p.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      type: 'REGISTRATION_RECEIVED',
      eventId: String(event._id),
      participantId: String(p._id),
      idempotencyKey: `resend-${p._id}-${Date.now()}`,
      adminId: (req as any).administrator?._id,
      attachments: [
        {
          filename: 'uabs-logo.png',
          content: readFileSync(join(__dirname, 'uabs-logo.png')),
          contentType: 'image/png',
          contentId: 'uabs-logo',
        },
        {
          filename: 'accreditation-qr.png',
          content: qr.image,
          contentType: 'image/png',
          contentId: qrCid,
        },
        ...(pdfAttachment ? [pdfAttachment] : []),
      ],
    });

    // 6. Respond
    res.status(result.sent ? 200 : 502).json({
      sent: result.sent,
      registrationId: p.registrationId,
      deliveryId: result.deliveryId,
    });
  } catch (error) {
    next(error);
  }
}

router.post(
  '/participants/:id/resend',
  authenticate,
  authorizeRoles('SUPER_ADMIN'),
  resendLimiter,
  resendRegistrationEmail,
);

export default router;