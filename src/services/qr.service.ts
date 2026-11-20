import { createHash, createHmac } from 'node:crypto';
import QRCode from 'qrcode';
import { env } from '../config/env';
import { ParticipantModel } from '../models/Participant';
type QrParticipantDoc = Record<string, any>;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
function deriveToken(participantId: string, issuedAt: Date) {
  return createHmac('sha256', env.QR_TOKEN_SECRET).update(`${participantId}:${issuedAt.toISOString()}`).digest('base64url');
}
export async function renderQrPng(token: string) {
  return QRCode.toBuffer(token, { type: 'png', errorCorrectionLevel: 'H', width: 480, margin: 4 });
}
export async function issueQrForParticipant(participant: { _id: unknown; qrIssuedAt?: Date | null }) {
  const issuedAt = new Date();
  const token = deriveToken(String(participant._id), issuedAt);
  const tokenHash = hashToken(token);
  await ParticipantModel.updateOne({ _id: participant._id }, { $set: { qrTokenHash: tokenHash, qrIssuedAt: issuedAt, qrStatus: 'ACTIVE' } });
  const payload = env.QR_VERIFY_URL ? `${env.QR_VERIFY_URL}?token=${encodeURIComponent(token)}` : token;
  const image = await QRCode.toBuffer(payload, { type: 'png', errorCorrectionLevel: 'H', width: 480, margin: 4 });
  return { token, tokenHash, issuedAt, image };
}
export async function getCurrentQr(participantId: string) {
  const participant = (await ParticipantModel.findById(participantId)
    .select('+qrTokenHash qrIssuedAt qrStatus registrationStatus eventId categoryId registrationId fullName')
    .lean()) as unknown as QrParticipantDoc | null;
  if (!participant || participant.qrStatus !== 'ACTIVE' || !participant.qrTokenHash || !participant.qrIssuedAt) return null;
  const token = deriveToken(participantId, participant.qrIssuedAt as Date);
  if (hashToken(token) !== participant.qrTokenHash) return null;
  const payload = env.QR_VERIFY_URL ? `${env.QR_VERIFY_URL}?token=${encodeURIComponent(token)}` : token;
  return { token, image: await QRCode.toBuffer(payload, { type: 'png', errorCorrectionLevel: 'H', width: 480, margin: 4 }), participant };
}

export async function verifyQrToken(token: string) {
  const participant = (await ParticipantModel.findOne({ qrTokenHash: hashToken(token) })
    .select('+qrTokenHash')
    .populate({ path: 'eventId', select: 'name status slug' })
    .populate({ path: 'categoryId', select: 'name' })
    .lean()) as unknown as QrParticipantDoc | null;
  if (!participant) return { outcome: 'NOT_FOUND' as const };
  if (participant.qrStatus === 'REVOKED') return { outcome: 'REVOKED' as const, participant };
  if (participant.qrStatus === 'EXPIRED') return { outcome: 'EXPIRED' as const, participant };
  const event = participant.eventId as unknown as { name: string; status: string } | null;
  if (!event) return { outcome: 'INVALID' as const, participant };
  if (event.status === 'CANCELLED') return { outcome: 'EVENT_CANCELLED' as const, participant };
  if (participant.registrationStatus === 'REJECTED') return { outcome: 'REGISTRATION_NOT_APPROVED' as const, participant };
  if (participant.registrationStatus === 'CANCELLED') return { outcome: 'REGISTRATION_CANCELLED' as const, participant };
  if (participant.registrationStatus !== 'APPROVED') return { outcome: 'REGISTRATION_NOT_APPROVED' as const, participant };
  return { outcome: 'VALID' as const, participant };
}
export async function revokeQr(participantId: string) {
  return ParticipantModel.updateOne({ _id: participantId, qrStatus: 'ACTIVE' }, { $set: { qrStatus: 'REVOKED' } });
}
export async function regenerateQr(participantId: string) {
  const participant = await ParticipantModel.findById(participantId).select('+qrTokenHash');
  if (!participant) return null;
  const issued = new Date();
  const token = deriveToken(participantId, issued);
  participant.qrTokenHash = hashToken(token);
  participant.qrIssuedAt = issued;
  participant.qrStatus = 'ACTIVE';
  await participant.save();
  const payload = env.QR_VERIFY_URL ? `${env.QR_VERIFY_URL}?token=${encodeURIComponent(token)}` : token;
  return { image: await QRCode.toBuffer(payload, { type: 'png', errorCorrectionLevel: 'H', width: 480, margin: 4 }), issuedAt: issued };
}
export function safeQrParticipant(p: Record<string, unknown>) {
  const event = p.eventId as { name?: string } | null;
  const category = p.categoryId as { name?: string } | null;
  return { fullName: p.fullName, registrationId: p.registrationId, category: category?.name, eventName: event?.name, registrationStatus: p.registrationStatus, qrStatus: p.qrStatus };
}
