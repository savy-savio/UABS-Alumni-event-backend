import { getPhotoDataUrl } from '../../services/photo.service';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ParticipantModel } from '../../models/Participant';
import { AttendanceModel } from '../../models/Attendance';
import { ParticipantCategoryModel } from '../../models/ParticipantCategory';
import { EventModel } from '../../models/Event';
import { InvitationModel } from '../../models/Invitation';
import { ActivityLogModel } from '../../models/ActivityLog';
import { authenticate } from '../../middleware/authenticate';
import { authorizeRoles } from '../../middleware/authorize';
import { AppError } from '../../utils/AppError';
import { emailService } from '../email/email.service';
import { renderMail } from '../email/email.templates';
import { getEvent } from '../events/events.service';
import { getCurrentQr, revokeQr, regenerateQr } from '../../services/qr.service';
import { generateParticipantPdf } from '../pdf/pdf.service';
import { assertScanProof } from '../../services/scanProof.service';

type LeanDoc = Record<string, any>;

const router = Router();

/* ------------------------------------------------------------------ */
/* Roles                                                              */
/* ------------------------------------------------------------------ */

const managers = ['SUPER_ADMIN'] as const;
const viewers = ['SUPER_ADMIN'] as const;

/* ------------------------------------------------------------------ */
/* Validation schemas                                                 */
/* ------------------------------------------------------------------ */

const idSchema = z.string().regex(/^[a-f\d]{24}$/i);

const editSchema = z
  .object({
    fullName: z.string().trim().min(2).max(160).optional(),
    email: z.string().trim().email().max(254).optional(),
    phone: z.string().trim().min(7).max(30).optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
    institution: z.string().trim().max(180).optional(),
    department: z.string().trim().max(160).optional(),
    matriculationNumber: z.string().trim().max(80).optional(),
    enrolledProgramme: z.string().trim().max(180).optional(),
    categoryId: idSchema.optional(),
    additionalInformation: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const reasonSchema = z.object({ reason: z.string().trim().min(3).max(1000).optional() }).strict();
const rejectSchema = z.object({ reason: z.string().trim().min(3).max(1000), scanProof: z.string().max(300).optional() }).strict();

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  category: idSchema.optional(),
  registrationStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  qrStatus: z.enum(['ACTIVE', 'REVOKED', 'EXPIRED']).optional(),
  email: z.string().optional(),
  matriculationNumber: z.string().optional(),
  department: z.string().optional(),
  programme: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(['registeredAt', 'fullName', 'email', 'registrationId', 'registrationStatus']).default('registeredAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };

function adminId(req: Request) {
  if (!req.auth?.administratorId) throw new AppError('Authentication required', 401);
  return req.auth.administratorId;
}

async function audit(
  req: Request,
  action: string,
  description: string,
  eventId?: any,
  targetId?: any,
  metadata: any = {},
) {
  await ActivityLogModel.create({
    eventId,
    administratorId: adminId(req),
    action,
    description,
    targetType: 'Participant',
    targetId,
    metadata,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
}

/** Removes the QR token hash before a participant is sent to the client. */
function safe(p: any) {
  const { qrTokenHash, ...rest } = p;
  return rest;
}

async function loadParticipant(id: string) {
  const p: any = await ParticipantModel.findById(id);
  if (!p) throw new AppError('Participant not found', 404);

  const event = (await EventModel.findById(p.eventId).lean()) as unknown as LeanDoc | null;
  if (!event) throw new AppError('Event not found', 404);

  const category = (await ParticipantCategoryModel.findById(p.categoryId).lean()) as unknown as LeanDoc | null;
  return { p, event, category };
}

function buildFilters(q: any, eventId: string) {
  const f: any = { eventId };

  if (q.search) {
    const term = q.search.trim();
    f.$or = [
      { fullName: { $regex: term, $options: 'i' } },
      { email: { $regex: term, $options: 'i' } },
      { registrationId: { $regex: term, $options: 'i' } },
      { matriculationNumber: { $regex: term, $options: 'i' } },
    ];
  }
  if (q.category) f.categoryId = q.category;
  if (q.registrationStatus) f.registrationStatus = q.registrationStatus;
  if (q.qrStatus) f.qrStatus = q.qrStatus;
  if (q.email) f.email = { $regex: q.email.trim(), $options: 'i' };
  if (q.matriculationNumber) f.matriculationNumber = { $regex: q.matriculationNumber.trim(), $options: 'i' };
  if (q.department) f.department = { $regex: q.department.trim(), $options: 'i' };
  if (q.programme) f.enrolledProgramme = { $regex: q.programme.trim(), $options: 'i' };
  if (q.startDate || q.endDate) {
    f.registeredAt = {
      $gte: q.startDate ? new Date(q.startDate) : new Date('1970-01-01'),
      $lte: q.endDate ? new Date(q.endDate) : new Date(),
    };
  }
  return f;
}

/* ------------------------------------------------------------------ */
/* Email attachment helpers                                           */
/* ------------------------------------------------------------------ */

const QR_CID = 'uabs-accreditation-qr';
const LOGO_PATH = join(__dirname, '../email/uabs-logo.png');

const logoAttachment = () => ({
  filename: 'uabs-logo.png',
  content: readFileSync(LOGO_PATH),
  contentType: 'image/png',
  contentId: 'uabs-logo',
});

const qrAttachment = (image: Buffer, filename: string) => ({
  filename,
  content: image,
  contentType: 'image/png',
  contentId: QR_CID,
});

/** PDF is best effort: emails still go out if it cannot be generated. */
async function tryPdfAttachment(participantId: string) {
  try {
    const out = await generateParticipantPdf(participantId);
    return { filename: out.filename, content: out.buffer, contentType: 'application/pdf' };
  } catch {
    return undefined;
  }
}

/* ------------------------------------------------------------------ */
/* Rate limiter                                                       */
/* ------------------------------------------------------------------ */

const resendLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });

/* ------------------------------------------------------------------ */
/* Handlers: statistics, export, listing                              */
/* ------------------------------------------------------------------ */

const participantStatistics = asyncHandler(async (_req, res) => {
  const eventId = String((await getEvent())._id);

  const now = new Date();
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  const week = new Date(now);
  week.setDate(now.getDate() - 7);
  const month = new Date(now);
  month.setDate(1);
  const base = { eventId: new Types.ObjectId(eventId) };

  const [counts, byCategory, byDepartment, byProgramme, dates, qr] = await Promise.all([
    ParticipantModel.aggregate([{ $match: base }, { $group: { _id: '$registrationStatus', count: { $sum: 1 } } }]),
    ParticipantModel.aggregate([
      { $match: base },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
      { $lookup: { from: 'participantcategories', localField: '_id', foreignField: '_id', as: 'category' } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      { $project: { name: '$category.name', count: 1 } },
    ]),
    ParticipantModel.aggregate([
      { $match: { ...base, department: { $type: 'string' } } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]),
    ParticipantModel.aggregate([
      { $match: { ...base, enrolledProgramme: { $type: 'string' } } },
      { $group: { _id: '$enrolledProgramme', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 },
    ]),
    ParticipantModel.aggregate([
      { $match: base },
      {
        $group: {
          _id: null,
          today: { $sum: { $cond: [{ $gte: ['$registeredAt', day] }, 1, 0] } },
          week: { $sum: { $cond: [{ $gte: ['$registeredAt', week] }, 1, 0] } },
          month: { $sum: { $cond: [{ $gte: ['$registeredAt', month] }, 1, 0] } },
        },
      },
    ]),
    ParticipantModel.aggregate([{ $match: base }, { $group: { _id: '$qrStatus', count: { $sum: 1 } } }]),
  ]);

  const stat = (arr: any[], key: string) => arr.find((x) => x._id === key)?.count || 0;
  const total = counts.reduce((a: number, b: any) => a + b.count, 0);

  res.json({
    success: true,
    data: {
      total,
      pending: stat(counts, 'PENDING'),
      approved: stat(counts, 'APPROVED'),
      rejected: stat(counts, 'REJECTED'),
      cancelled: stat(counts, 'CANCELLED'),
      byCategory,
      byDepartment,
      byProgramme,
      registeredToday: dates[0]?.today || 0,
      registeredThisWeek: dates[0]?.week || 0,
      registeredThisMonth: dates[0]?.month || 0,
      qrActive: stat(qr, 'ACTIVE'),
      qrRevoked: stat(qr, 'REVOKED'),
      qrExpired: stat(qr, 'EXPIRED'),
    },
  });
});

const exportParticipants = asyncHandler(async (req, res) => {
  const eventId = String((await getEvent())._id);
  const q = listQuery.partial().parse(req.query);
  const filter = buildFilters(q, eventId);

  const rows = (await ParticipantModel.find(filter)
    .populate('categoryId', 'name')
    .sort({ registeredAt: -1 })
    .limit(10000)
    .lean()) as unknown as LeanDoc[];

  const columns = [
    'Full name', 'Email', 'Phone', 'Registration ID', 'Category', 'Institution', 'Department',
    'Matriculation number', 'Programme', 'Registration status', 'Registration date', 'QR status',
  ];

  // Escapes quotes and neutralises spreadsheet formula injection
  const escapeCsv = (v: any) => {
    let s = String(v ?? '');
    if (/^[=+\-@ \t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };

  const csv = [
    columns.map(escapeCsv).join(','),
    ...rows.map((p) =>
      [
        p.fullName, p.email, p.phone, p.registrationId, p.categoryId?.name, p.institution, p.department,
        p.matriculationNumber, p.enrolledProgramme, p.registrationStatus, p.registeredAt?.toISOString?.(), p.qrStatus,
      ]
        .map(escapeCsv)
        .join(','),
    ),
  ].join('\r\n');

  await audit(req, 'PARTICIPANT_EXPORTED', `Exported ${rows.length} participant records`, eventId, undefined, {
    count: rows.length,
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="participants.csv"');
  res.send('\ufeff' + csv);
});

const listParticipants = asyncHandler(async (req, res) => {
  const eventId = String((await getEvent())._id);
  const q = listQuery.parse(req.query);

  const filter = buildFilters(q, eventId);
  const sort: any = { [q.sortBy]: q.sortOrder === 'asc' ? 1 : -1 };

  const [rowsRaw, total] = await Promise.all([
    ParticipantModel.find(filter)
      .select('-qrTokenHash')
      .populate('categoryId', 'name')
      .sort(sort)
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    ParticipantModel.countDocuments(filter),
  ]);
  const rows = rowsRaw as unknown as LeanDoc[];

  res.json({
    success: true,
    data: rows.map(safe),
    pagination: { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) },
  });
});

/* ------------------------------------------------------------------ */
/* Handlers: single participant                                       */
/* ------------------------------------------------------------------ */

const getParticipant = asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.participantId);

  const p = (await ParticipantModel.findById(id)
    .select('-qrTokenHash')
    .populate('eventId')
    .populate('categoryId')
    .lean()) as unknown as LeanDoc | null;
  if (!p) throw new AppError('Participant not found', 404);

  const invitation = (await InvitationModel.findOne({ participantId: id }).select('-__v').lean()) as unknown as LeanDoc | null;

  res.json({ success: true, data: { ...safe(p), invitation, photo: await getPhotoDataUrl(id) } });
});

const editParticipant = asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.participantId);
  const input = editSchema.parse(req.body);

  const p: any = await ParticipantModel.findById(id);
  if (!p) throw new AppError('Participant not found', 404);

  if (input.categoryId) {
    const category = await ParticipantCategoryModel.findOne({ _id: input.categoryId, eventId: p.eventId, isActive: true });
    if (!category) throw new AppError('Invalid participant category', 400);
  }

  const update = { ...input };
  if (update.email) update.email = update.email.trim().toLowerCase();
  Object.assign(p, update);
  p.updatedBy = new Types.ObjectId(adminId(req));

  try {
    await p.save();
  } catch (e: any) {
    if (e?.code === 11000) throw new AppError('Email or matriculation number already registered for this event', 409);
    throw e;
  }

  await audit(req, 'PARTICIPANT_UPDATED', 'Participant information updated', p.eventId, p._id, {
    fields: Object.keys(input),
  });
  res.json({ success: true, data: safe(p.toObject()) });
});

/* ------------------------------------------------------------------ */
/* Handlers: registration status workflow                             */
/* ------------------------------------------------------------------ */

const approveParticipant = asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.participantId);
  assertScanProof(req.body?.scanProof, id, adminId(req));
  const { p, event, category } = await loadParticipant(id);

  if (p.registrationStatus !== 'PENDING') throw new AppError('Only pending registrations may be approved', 409);

  p.registrationStatus = 'APPROVED';
  p.approvedBy = new Types.ObjectId(adminId(req));
  p.approvedAt = new Date();
  await p.save();
  await audit(req, 'REGISTRATION_APPROVED', 'Registration approved', p.eventId, p._id);

  // Approval counts as check-in
  await AttendanceModel.findOneAndUpdate(
    { eventId: p.eventId, participantId: p._id },
    {
      $set: {
        eventId: p.eventId,
        participantId: p._id,
        registrationId: p.registrationId,
        checkInStatus: 'CHECKED_IN',
        checkedInAt: new Date(),
        checkedInBy: new Types.ObjectId(adminId(req)),
      },
    },
    { upsert: true, new: true },
  );

  // No QR code or PDF pass: the person is already at the event
  const mail = renderMail('REGISTRATION_APPROVED', {
    name: p.fullName,
    email: p.email,
    registrationId: p.registrationId,
    category: category?.name,
    status: p.registrationStatus,
    matriculationNumber: p.matriculationNumber,
    programme: p.enrolledProgramme,
    event,
  });

  const delivery = await emailService.send({
    to: p.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    type: 'REGISTRATION_APPROVED',
    eventId: String(p.eventId),
    participantId: id,
    idempotencyKey: `approve-${id}-${p.updatedAt?.getTime() || Date.now()}`,
    adminId: adminId(req),
    attachments: [logoAttachment()],
  });

  res.json({ success: true, data: { participant: safe(p.toObject()), emailDelivery: delivery.sent } });
});

const rejectParticipant = asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.participantId);
  const body = rejectSchema.parse(req.body);
  assertScanProof(body.scanProof, id, adminId(req));
  const { p, event } = await loadParticipant(id);

  if (!['PENDING', 'APPROVED'].includes(p.registrationStatus)) {
    throw new AppError('Registration cannot be rejected in its current state', 409);
  }

  p.registrationStatus = 'REJECTED';
  p.rejectedBy = new Types.ObjectId(adminId(req));
  p.rejectedAt = new Date();
  p.rejectionReason = body.reason;
  await p.save();
  await audit(req, 'REGISTRATION_REJECTED', 'Registration rejected', p.eventId, p._id);

  const mail = renderMail('REGISTRATION_REJECTED', {
    name: p.fullName,
    email: p.email,
    registrationId: p.registrationId,
    event,
    message: body.reason,
  });
  const delivery = await emailService.send({
    to: p.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    type: 'REGISTRATION_REJECTED',
    eventId: String(p.eventId),
    participantId: id,
    idempotencyKey: `reject-${id}-${Date.now()}`,
    adminId: adminId(req),
  });

  res.json({ success: true, data: { registrationStatus: p.registrationStatus, emailDelivery: delivery.sent } });
});

const cancelParticipant = asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.participantId);
  const body = reasonSchema.parse(req.body);
  const { p, event } = await loadParticipant(id);

  if (['CANCELLED', 'REJECTED'].includes(p.registrationStatus)) {
    throw new AppError('Registration cannot be cancelled in its current state', 409);
  }

  p.registrationStatus = 'CANCELLED';
  p.cancelledBy = new Types.ObjectId(adminId(req));
  p.cancelledAt = new Date();
  p.cancellationReason = body.reason;
  await p.save();
  await audit(req, 'REGISTRATION_CANCELLED', 'Registration cancelled', p.eventId, p._id, { reason: body.reason });

  const mail = renderMail('REGISTRATION_CANCELLED', {
    name: p.fullName,
    email: p.email,
    registrationId: p.registrationId,
    event,
    message: body.reason,
  });
  const delivery = await emailService.send({
    to: p.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    type: 'REGISTRATION_CANCELLED',
    eventId: String(p.eventId),
    participantId: id,
    idempotencyKey: `cancel-${id}-${Date.now()}`,
    adminId: adminId(req),
  });

  res.json({ success: true, data: { registrationStatus: p.registrationStatus, emailDelivery: delivery.sent } });
});

/* ------------------------------------------------------------------ */
/* Handlers: resending emails                                         */
/* ------------------------------------------------------------------ */

const resendEmail = asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.participantId);
  const { p, event, category } = await loadParticipant(id);

  if (!p.email || !/^\S+@\S+\.\S+$/.test(p.email)) throw new AppError('Participant email is invalid', 400);

  const qr = await getCurrentQr(id);
  if (!qr) throw new AppError('Active QR credential unavailable', 409);

  const type = req.body?.type === 'APPROVED' ? 'REGISTRATION_APPROVED' : 'REGISTRATION_RECEIVED';
  const mail = renderMail(type, {
    name: p.fullName,
    email: p.email,
    registrationId: p.registrationId,
    category: category?.name,
    status: p.registrationStatus,
    matriculationNumber: p.matriculationNumber,
    programme: p.enrolledProgramme,
    event,
    qrCid: QR_CID,
  });
  const pdf = await tryPdfAttachment(id);

  const delivery = await emailService.send({
    to: p.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    type,
    eventId: String(p.eventId),
    participantId: id,
    idempotencyKey: `admin-resend-${id}-${Date.now()}`,
    adminId: adminId(req),
    attachments: [logoAttachment(), qrAttachment(qr.image, 'qr.png'), ...(pdf ? [pdf] : [])],
  });

  await audit(req, 'INVITATION_RESENT', 'Registration email resent', p.eventId, p._id, { sent: delivery.sent });
  res.json({ success: true, data: { sent: delivery.sent, deliveryId: delivery.deliveryId } });
});

const resendAccreditationPass = asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.participantId);
  const { p, event, category } = await loadParticipant(id);

  const qr = await getCurrentQr(id);
  if (!qr) throw new AppError('Active QR credential unavailable', 409);

  const pdf = await generateParticipantPdf(id); // required here: this email exists to deliver the pass

  const mail = renderMail('REGISTRATION_APPROVED', {
    name: p.fullName,
    email: p.email,
    registrationId: p.registrationId,
    category: category?.name,
    status: p.registrationStatus,
    event,
    qrCid: QR_CID,
  });

  const delivery = await emailService.send({
    to: p.email,
    subject: `Accreditation pass — ${event.name}`,
    html: mail.html,
    text: mail.text,
    type: 'REGISTRATION_APPROVED',
    eventId: String(p.eventId),
    participantId: id,
    idempotencyKey: `pass-resend-${id}-${Date.now()}`,
    adminId: adminId(req),
    attachments: [
      logoAttachment(),
      { filename: pdf.filename, content: pdf.buffer, contentType: 'application/pdf' },
      qrAttachment(qr.image, 'qr.png'),
    ],
  });

  await audit(req, 'INVITATION_RESENT', 'Accreditation pass resent', p.eventId, p._id, { sent: delivery.sent });
  res.json({
    success: true,
    data: { sent: delivery.sent, deliveryId: delivery.deliveryId, referenceCode: pdf.referenceCode },
  });
});

/* ------------------------------------------------------------------ */
/* Handlers: QR credential management                                 */
/* ------------------------------------------------------------------ */

const revokeParticipantQr = asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.participantId);
  const { p } = await loadParticipant(id);

  const out: any = await revokeQr(id);
  if (!out.matchedCount) throw new AppError('Active QR credential not found', 404);

  await audit(req, 'QR_REVOKED', 'QR credential revoked by participant management', p.eventId, p._id);
  res.json({ success: true });
});

const regenerateParticipantQr = asyncHandler(async (req, res) => {
  const id = idSchema.parse(req.params.participantId);
  const { p } = await loadParticipant(id);

  if (['REJECTED', 'CANCELLED'].includes(p.registrationStatus)) {
    throw new AppError('QR cannot be issued for rejected or cancelled registration', 409);
  }

  const out = await regenerateQr(id);
  if (!out) throw new AppError('Participant not found', 404);

  await audit(req, 'QR_REGENERATED', 'QR credential regenerated by participant management', p.eventId, p._id);
  res.json({
    success: true,
    data: { issuedAt: out.issuedAt, image: `data:image/png;base64,${out.image.toString('base64')}` },
  });
});

/* ------------------------------------------------------------------ */
/* Routes                                                             */
/* ------------------------------------------------------------------ */

router.use(authenticate);

// Participant lists (statistics and export must stay above '/participants/:participantId')
router.get('/participants/statistics', authorizeRoles(...viewers), participantStatistics);
router.get('/participants/export', authorizeRoles(...managers), exportParticipants);
router.get('/participants', authorizeRoles(...viewers), listParticipants);

// Single participant
router.get('/participants/:participantId', authorizeRoles(...viewers), getParticipant);
router.patch('/participants/:participantId', authorizeRoles(...managers), editParticipant);

// Registration status workflow
router.patch('/participants/:participantId/approve', authorizeRoles(...managers), approveParticipant);
router.patch('/participants/:participantId/reject', authorizeRoles(...managers), rejectParticipant);
router.patch('/participants/:participantId/cancel', authorizeRoles(...managers), cancelParticipant);

// Resending emails
router.post('/participants/:participantId/resend-email', authorizeRoles(...managers), resendLimit, resendEmail);
router.post('/participants/:participantId/resend-accreditation-pass', authorizeRoles(...managers), resendLimit, resendAccreditationPass);

// QR credential management
router.post('/participants/:participantId/revoke-qr', authorizeRoles(...managers), revokeParticipantQr);
router.post('/participants/:participantId/regenerate-qr', authorizeRoles(...managers), regenerateParticipantQr);

export default router;