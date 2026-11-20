import { randomBytes } from 'crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ParticipantModel } from '../../models/Participant';
import { ParticipantCategoryModel } from '../../models/ParticipantCategory';
import { AppError } from '../../utils/AppError';
import { isRegistrationOpen, getPublishedEventDoc } from '../events/events.service';
import { renderMail } from '../email/email.templates';
import { emailService } from '../email/email.service';
import { issueQrForParticipant } from '../../services/qr.service';
import { generateParticipantPdf } from '../pdf/pdf.service';
import { InvitationModel } from '../../models/Invitation';

/** Everyone who registers through the public form is a postgraduate student. */
const DEFAULT_CATEGORY_NAME = 'Postgraduate Students';

const supported = new Set(['fullName', 'email', 'phone', 'gender', 'institution', 'department', 'matriculationNumber', 'enrolledProgramme']);

export async function registerForEvent(input: Record<string, unknown>) {
  const event = await getPublishedEventDoc();
  if (!isRegistrationOpen(event)) throw new AppError('Registration is not currently open for this event', 400);

  const category = (await ParticipantCategoryModel.findOne({
    eventId: event._id,
    name: DEFAULT_CATEGORY_NAME,
    isActive: true,
  }).lean()) as unknown as Record<string, any> | null;
  if (!category) throw new AppError('Registration is not configured yet. Please contact the organisers.', 500);

  // Fields required by the category
  const fieldData: Record<string, unknown> = { ...input };
  for (const key of category.requiredFields ?? []) {
    if (!supported.has(key)) continue;
    const val = fieldData[key];
    if (val === undefined || val === null || (typeof val === 'string' && !val.trim())) {
      throw new AppError(`${key} is required for this participant category`, 400);
    }
  }

  // Reject fields the category does not allow
  const permitted = new Set([
    ...(category.requiredFields ?? []),
    ...(category.optionalFields ?? []),
    'fullName', 'email', 'phone', 'gender', 'categoryId', 'additionalInformation',
  ]);
  for (const key of Object.keys(input)) {
    if (!permitted.has(key)) throw new AppError(`Field '${key}' is not permitted for this participant category`, 400);
  }

  const registrationId = `UABS-${new Date().getFullYear()}-${randomBytes(6).toString('hex').toUpperCase()}`;

  try {
    const participant = await ParticipantModel.create({
      fullName: input.fullName,
      email: input.email,
      eventId: event._id,
      categoryId: category._id,
      registrationId,
      registrationStatus: 'PENDING',
      matriculationNumber: input.matriculationNumber,
      enrolledProgramme: input.enrolledProgramme,
    });

    try {
      const qr = await issueQrForParticipant(participant);
      const qrImage = `data:image/png;base64,${qr.image.toString('base64')}`;
      const cid = 'uabs-registration-qr';

      const mail = renderMail('REGISTRATION_RECEIVED', {
        name: participant.fullName,
        email: participant.email,
        registrationId: participant.registrationId,
        category: category.name,
        status: participant.registrationStatus,
        matriculationNumber: participant.matriculationNumber,
        programme: participant.enrolledProgramme,
        event,
        qrCid: cid,
      });

      let delivery: any = { sent: false };
      let invitation: any;

      // PDF generation is deliberately best-effort: it must never roll back a valid registration or QR credential.
      let pdfAttachment: { filename: string; content: Buffer; contentType: string } | undefined;
      try {
        const pdf = await generateParticipantPdf(String(participant._id));
        invitation = { referenceCode: pdf.referenceCode };
        pdfAttachment = { filename: pdf.filename, content: pdf.buffer, contentType: 'application/pdf' };
      } catch {
        // A later authenticated resend/download can safely regenerate the PDF with the same invitation reference.
      }

      try {
        delivery = await emailService.send({
          to: participant.email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          type: 'REGISTRATION_RECEIVED',
          eventId: String(event._id),
          participantId: String(participant._id),
          idempotencyKey: `registration-${participant._id}`,
          attachments: [
            {
              filename: 'uabs-logo.png',
              content: readFileSync(join(__dirname, '../email/uabs-logo.png')),
              contentType: 'image/png',
              contentId: 'uabs-logo',
            },
            { filename: 'uabs-accreditation-qr.png', content: qr.image, contentType: 'image/png', contentId: cid },
            ...(pdfAttachment ? [pdfAttachment] : []),
          ],
        });

        if (invitation) {
          await InvitationModel.updateOne(
            { eventId: event._id, participantId: participant._id },
            {
              $set: {
                deliveryStatus: delivery.sent ? 'SENT' : 'FAILED',
                lastSentAt: delivery.sent ? new Date() : undefined,
                emailProviderMessageId: delivery.messageId,
                lastError: delivery.sent ? undefined : delivery.error,
              },
            },
          );
        }
      } catch {
        delivery = { sent: false };
      }

      return {
        registrationId: participant.registrationId,
        fullName: participant.fullName,
        eventName: event.name,
        category: category.name,
        email: participant.email,
        registrationStatus: participant.registrationStatus,
        qrCode: { status: 'ACTIVE', image: qrImage },
        accreditationDocument: { attached: Boolean(pdfAttachment), referenceCode: invitation?.referenceCode },
        emailDelivery: { sent: delivery.sent, deliveryId: delivery.deliveryId },
        pdfAttached: Boolean(pdfAttachment),
      };
    } catch (qrError) {
      // No QR credential means no valid registration: roll back.
      await ParticipantModel.deleteOne({ _id: participant._id });
      throw qrError;
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000) {
      throw new AppError('A registration already exists for this email or matriculation number', 409);
    }
    throw error;
  }
}

export async function lookupRegistration(registrationId: string, email: string) {
  const participant = (await ParticipantModel.findOne({ registrationId: registrationId.toUpperCase(), email })
    .select('registrationId fullName email registrationStatus registeredAt eventId categoryId')
    .populate({ path: 'eventId', select: 'name' })
    .populate({ path: 'categoryId', select: 'name' })
    .lean()) as unknown as Record<string, any> | null;
  if (!participant) throw new AppError('Registration not found', 404);

  return {
    registrationId: participant.registrationId,
    fullName: participant.fullName,
    email: participant.email,
    registrationStatus: participant.registrationStatus,
    registeredAt: participant.registeredAt,
    eventName: (participant.eventId as { name: string }).name,
    category: (participant.categoryId as { name: string }).name,
  };
}