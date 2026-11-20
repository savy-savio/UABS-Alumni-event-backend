import { Router, type Request, type Response, type NextFunction } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { authenticate } from '../../middleware/authenticate';
import { authorizeRoles } from '../../middleware/authorize';
import { ParticipantModel, AttendanceModel, ActivityLogModel } from '../../models';
import { verifyQrToken } from '../../services/qr.service';
import { getEvent } from '../events/events.service';
import { AppError } from '../../utils/AppError';
import { getPhotoDataUrl } from '../../services/photo.service';

type LeanDoc = Record<string, any>;

const router = Router();

/* ------------------------------------------------------------------ */
/* Validation schemas                                                 */
/* ------------------------------------------------------------------ */

const objectIdRegex = /^[a-f\d]{24}$/i;
const idSchema = z.string().regex(objectIdRegex);

const scanBodySchema = z.object({
  token: z.string().min(20).max(2048),
  gate: z.string().trim().max(100).optional(),
  deviceId: z.string().trim().max(200).optional(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).optional(),
  category: z.string().optional(),
  gate: z.string().trim().max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  checkInStatus: z.enum(['CHECKED_IN', 'NOT_CHECKED_IN', 'REVOKED']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const reverseSchema = z.object({ reason: z.string().trim().min(5).max(1000) });

/* ------------------------------------------------------------------ */
/* Middleware & request helpers                                       */
/* ------------------------------------------------------------------ */

const scanLimiter = rateLimit({
  windowMs: 60_000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Scan rate limit exceeded' },
});

const adminId = (req: Request) => req.auth!.administratorId;
const clientIp = (req: Request) => req.ip;
const userAgent = (req: Request) => req.get('user-agent')?.slice(0, 500);

const ADMIN_ROLES = ['SUPER_ADMIN'] as const;
const VIEW_ROLES = ['SUPER_ADMIN'] as const;

/* ------------------------------------------------------------------ */
/* Activity log helper                                                */
/* ------------------------------------------------------------------ */

const logActivity = async (
  req: Request,
  eventId: Types.ObjectId,
  action: string,
  description: string,
  targetId?: Types.ObjectId,
  result: 'SUCCESS' | 'FAILURE' = 'SUCCESS',
  metadata: Record<string, unknown> = {},
) =>
  ActivityLogModel.create({
    eventId,
    administratorId: new Types.ObjectId(adminId(req)),
    action,
    description,
    targetType: 'Attendance',
    targetId,
    metadata,
    result,
    ipAddress: clientIp(req),
    userAgent: userAgent(req),
  });

/* ------------------------------------------------------------------ */
/* QR verification helpers                                            */
/* ------------------------------------------------------------------ */

interface ScanVerification {
  event: LeanDoc;
  participant: LeanDoc | null;
  outcome: string;
}

const OUTCOME_MAP: Record<string, string> = {
  VALID: 'VALID',
  REVOKED: 'REVOKED',
  EXPIRED: 'EXPIRED',
  EVENT_CANCELLED: 'EVENT_CANCELLED',
  REGISTRATION_NOT_APPROVED: 'NOT_APPROVED',
  REGISTRATION_CANCELLED: 'CANCELLED',
  NOT_FOUND: 'INVALID',
};

async function verifyForEvent(token: string): Promise<ScanVerification> {
  const event = await getEvent();

  const verified = await verifyQrToken(token);
  const participant: LeanDoc | undefined = (verified as any).participant;

  if (verified.outcome === 'NOT_FOUND' || !participant) {
    return { event, participant: null, outcome: 'INVALID' };
  }
  if (String(participant.eventId?._id || participant.eventId) !== String(event._id)) {
    return { event, participant, outcome: 'WRONG_EVENT' };
  }

  let outcome = OUTCOME_MAP[verified.outcome] || 'INVALID';
  if (participant.registrationStatus === 'REJECTED') outcome = 'REJECTED';
  else if (participant.registrationStatus === 'CANCELLED') outcome = 'CANCELLED';
  else if (participant.registrationStatus !== 'APPROVED') outcome = 'NOT_APPROVED';
  if (event.status === 'CANCELLED') outcome = 'EVENT_CANCELLED';

  return { event, participant, outcome };
}

const toSafeParticipant = (p: LeanDoc, attendance: LeanDoc | null = null) => ({
  id: String(p._id),
  fullName: p.fullName,
  enrolledProgramme: p.enrolledProgramme,
  graduationYear: p.graduationYear,
  registrationId: p.registrationId,
  category: p.categoryId?.name,
  categoryId: p.categoryId?._id,
  email: p.email,
  matriculationNumber: p.matriculationNumber,
  registrationStatus: p.registrationStatus,
  qrStatus: p.qrStatus,
  attendanceStatus: attendance?.checkInStatus || 'NOT_CHECKED_IN',
  checkedInAt: attendance?.checkedInAt,
  gate: attendance?.gate,
});

/* ------------------------------------------------------------------ */
/* Handler: POST /accreditation/scan                                  */
/* ------------------------------------------------------------------ */

async function scanQr(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = scanBodySchema.parse(req.body);
    const result = await verifyForEvent(input.token);
    const eventObjectId = new Types.ObjectId(String(result.event._id));
    const participant = result.participant;

    // A valid QR for someone already checked in is reported as a duplicate
    if (result.outcome === 'VALID' && participant) {
      const alreadyIn = await AttendanceModel.findOne({
        eventId: eventObjectId,
        participantId: participant._id,
        checkInStatus: 'CHECKED_IN',
      }).lean();
      if (alreadyIn) result.outcome = 'ALREADY_CHECKED_IN';
    }

    if (result.outcome !== 'VALID' && result.outcome !== 'ALREADY_CHECKED_IN') {
      await logActivity(
        req,
        eventObjectId,
        'INVALID_QR_ATTEMPT',
        `QR scan failed: ${result.outcome}`,
        participant ? new Types.ObjectId(participant._id) : undefined,
        'FAILURE',
        { outcome: result.outcome },
      );
    }

    if (!participant) {
      res.status(400).json({ success: false, outcome: result.outcome, message: 'QR code is invalid' });
      return;
    }

    const isValid = result.outcome === 'VALID';
    await logActivity(
      req,
      eventObjectId,
      'QR_VERIFIED',
      `Accreditation scan result: ${result.outcome}`,
      new Types.ObjectId(participant._id),
      isValid ? 'SUCCESS' : 'FAILURE',
      { outcome: result.outcome },
    );

    const existing =
      result.outcome === 'ALREADY_CHECKED_IN'
        ? ((await AttendanceModel.findOne({
            eventId: eventObjectId,
            participantId: participant._id,
          }).lean()) as unknown as LeanDoc | null)
        : null;

    res.status(isValid ? 200 : 400).json({
      success: isValid,
      outcome: result.outcome,
      participant: { ...toSafeParticipant(participant, existing), photo: await getPhotoDataUrl(participant._id) },
      checkIn: existing ? { checkedInAt: existing.checkedInAt, gate: existing.gate } : undefined,
      message: isValid
        ? 'Participant is eligible for check-in'
        : result.outcome === 'ALREADY_CHECKED_IN'
        ? 'Participant already checked in'
        : `QR verification failed: ${result.outcome}`,
    });
  } catch (error) {
    next(error);
  }
}

/* ------------------------------------------------------------------ */
/* Handler: POST /accreditation/check-in                              */
/* ------------------------------------------------------------------ */

async function checkInParticipant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = scanBodySchema.parse(req.body);
    const result = await verifyForEvent(input.token);
    const eventObjectId = new Types.ObjectId(String(result.event._id));
    const participant = result.participant;

    // Reject anything that is not a valid QR for this event
    if (!participant || result.outcome !== 'VALID') {
      if (participant) {
        await logActivity(
          req,
          eventObjectId,
          'INVALID_QR_ATTEMPT',
          `Check-in rejected: ${result.outcome}`,
          new Types.ObjectId(participant._id),
          'FAILURE',
          { outcome: result.outcome },
        );
      }
      res.status(400).json({
        success: false,
        outcome: result.outcome,
        message: `Check-in rejected: ${result.outcome}`,
      });
      return;
    }

    const participantObjectId = new Types.ObjectId(participant._id);
    const currentAdminId = new Types.ObjectId(adminId(req));

    // Atomic check-in: the unique index stops two scans from both succeeding
    let record: any;
    let duplicate = false;
    try {
      record = await AttendanceModel.findOneAndUpdate(
        { eventId: eventObjectId, participantId: participantObjectId, checkInStatus: { $ne: 'CHECKED_IN' } },
        {
          $set: {
            eventId: eventObjectId,
            participantId: participantObjectId,
            registrationId: participant.registrationId,
            checkInStatus: 'CHECKED_IN',
            checkedInAt: new Date(),
            checkedInBy: currentAdminId,
            gate: input.gate,
            deviceInformation: input.deviceId,
          },
        },
        { upsert: true, new: true },
      ).lean();
    } catch (err: any) {
      if (err?.code === 11000) {
        duplicate = true;
        record = await AttendanceModel.findOne({ eventId: eventObjectId, participantId: participantObjectId }).lean();
      } else {
        throw err;
      }
    }

    const checkedInByAnother =
      record?.checkInStatus === 'CHECKED_IN' &&
      record?.checkedInAt &&
      !record?.checkedInBy?.equals?.(currentAdminId);

    if (duplicate || checkedInByAnother) {
      // A pre-existing check-in wins; no duplicate record is created.
      await logActivity(
        req,
        eventObjectId,
        'PARTICIPANT_CHECKED_IN',
        'Duplicate check-in attempt',
        participantObjectId,
        'FAILURE',
        { outcome: 'ALREADY_CHECKED_IN' },
      );
      res.status(409).json({
        success: false,
        outcome: 'ALREADY_CHECKED_IN',
        participant: toSafeParticipant(participant, record),
        checkedInAt: record.checkedInAt,
        gate: record.gate,
        message: 'This participant has already been checked in',
      });
      return;
    }

    await logActivity(req, eventObjectId, 'PARTICIPANT_CHECKED_IN', 'Participant checked in', participantObjectId, 'SUCCESS', {
      gate: input.gate,
      deviceId: input.deviceId,
    });

    res.status(200).json({
      success: true,
      outcome: 'CHECKED_IN',
      participant: toSafeParticipant(participant, record),
      checkedInAt: record.checkedInAt,
      gate: record.gate,
      message: 'Participant successfully checked in',
    });
  } catch (error) {
    next(error);
  }
}

/* ------------------------------------------------------------------ */
/* Handler: GET /admin/attendance                                     */
/* ------------------------------------------------------------------ */

async function listAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = listQuerySchema.parse(req.query);
    const eventId = new Types.ObjectId(String((await getEvent())._id));

    const match: any = { eventId, checkInStatus: q.checkInStatus || 'CHECKED_IN' };
    if (q.gate) match.gate = q.gate;
    if (q.startDate || q.endDate) {
      match.checkedInAt = {};
      if (q.startDate) match.checkedInAt.$gte = new Date(q.startDate);
      if (q.endDate) match.checkedInAt.$lte = new Date(q.endDate);
    }

    let rows = (await AttendanceModel.find(match)
      .sort({ checkedInAt: q.sortOrder === 'asc' ? 1 : -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate({
        path: 'participantId',
        select: 'fullName email registrationId matriculationNumber categoryId',
        populate: { path: 'categoryId', select: 'name' },
      })
      .populate({ path: 'checkedInBy', select: 'fullName email' })
      .lean()) as unknown as LeanDoc[];

    if (q.search) {
      const needle = q.search.toLowerCase();
      rows = rows.filter((r) => {
        const p = r.participantId;
        return (
          p &&
          (p.fullName?.toLowerCase().includes(needle) ||
            p.registrationId?.toLowerCase().includes(needle) ||
            p.matriculationNumber?.toLowerCase().includes(needle))
        );
      });
    }

    if (q.category) {
      rows = rows.filter(
        (r) => r.participantId?.categoryId?.name === q.category || String(r.participantId?.categoryId?._id) === q.category,
      );
    }

    const total = await AttendanceModel.countDocuments(match);

    res.json({
      success: true,
      data: rows.map((r) => ({
        participant: {
          fullName: r.participantId?.fullName,
          email: r.participantId?.email,
          registrationId: r.registrationId,
          matriculationNumber: r.participantId?.matriculationNumber,
          category: r.participantId?.categoryId?.name,
        },
        checkInStatus: r.checkInStatus,
        checkedInAt: r.checkedInAt,
        gate: r.gate,
        checkedInBy: r.checkedInBy ? { id: r.checkedInBy._id, name: r.checkedInBy.fullName } : null,
      })),
      pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
    });
  } catch (error) {
    next(error);
  }
}

/* ------------------------------------------------------------------ */
/* Handler: GET /admin/attendance/statistics                          */
/* ------------------------------------------------------------------ */

async function attendanceStatistics(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const eid = new Types.ObjectId(String((await getEvent())._id));

    const checkedInMatch = { eventId: eid, checkInStatus: 'CHECKED_IN' };
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
    const oneHourAgo = new Date(Date.now() - 3_600_000);

    const [approved, checkedIn, byCategory, byGate, today, lastHour] = await Promise.all([
      ParticipantModel.countDocuments({ eventId: eid, registrationStatus: 'APPROVED' }),
      AttendanceModel.countDocuments(checkedInMatch),
      AttendanceModel.aggregate([
        { $match: checkedInMatch },
        { $lookup: { from: 'participants', localField: 'participantId', foreignField: '_id', as: 'p' } },
        { $unwind: '$p' },
        { $lookup: { from: 'participantcategories', localField: 'p.categoryId', foreignField: '_id', as: 'c' } },
        { $unwind: { path: '$c', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$c.name', count: { $sum: 1 } } },
      ]),
      AttendanceModel.aggregate([{ $match: checkedInMatch }, { $group: { _id: '$gate', count: { $sum: 1 } } }]),
      AttendanceModel.countDocuments({ ...checkedInMatch, checkedInAt: { $gte: startOfToday } }),
      AttendanceModel.countDocuments({ ...checkedInMatch, checkedInAt: { $gte: oneHourAgo } }),
    ]);

    res.json({
      success: true,
      data: {
        approvedParticipants: approved,
        checkedIn,
        notCheckedIn: Math.max(0, approved - checkedIn),
        attendancePercentage: approved ? Math.round((checkedIn / approved) * 10000) / 100 : 0,
        byCategory,
        byGate,
        checkedInToday: today,
        checkedInLastHour: lastHour,
      },
    });
  } catch (error) {
    next(error);
  }
}

/* ------------------------------------------------------------------ */
/* Handler: GET /admin/participants/:participantId/attendance         */
/* ------------------------------------------------------------------ */

async function participantAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!idSchema.safeParse(req.params.participantId).success) throw new AppError('Invalid participant ID', 400);

    const p = (await ParticipantModel.findById(req.params.participantId)
      .populate('eventId', 'name status')
      .populate('categoryId', 'name')
      .lean()) as unknown as LeanDoc | null;
    if (!p) throw new AppError('Participant not found', 404);

    const a = (await AttendanceModel.findOne({ eventId: p.eventId, participantId: p._id })
      .populate('checkedInBy', 'fullName email')
      .lean()) as unknown as LeanDoc | null;

    res.json({
      success: true,
      data: {
        participant: {
          fullName: p.fullName,
          registrationId: p.registrationId,
          registrationStatus: p.registrationStatus,
          event: p.eventId,
          category: p.categoryId,
        },
        status: a?.checkInStatus || 'NOT_CHECKED_IN',
        checkedInAt: a?.checkedInAt,
        gate: a?.gate,
        checkedInBy: a?.checkedInBy || null,
      },
    });
  } catch (error) {
    next(error);
  }
}

/* ------------------------------------------------------------------ */
/* Handler: PATCH /admin/participants/:participantId/attendance/reverse */
/* ------------------------------------------------------------------ */

async function reverseCheckIn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!idSchema.safeParse(req.params.participantId).success) throw new AppError('Invalid participant ID', 400);

    const input = reverseSchema.parse(req.body);
    const p: any = await ParticipantModel.findById(req.params.participantId);
    if (!p) throw new AppError('Participant not found', 404);

    const eid = new Types.ObjectId(String(p.eventId));
    const a: any = await AttendanceModel.findOne({ eventId: eid, participantId: p._id });
    if (!a || a.checkInStatus !== 'CHECKED_IN') throw new AppError('No active check-in to reverse', 409);

    const previous = {
      checkedInAt: a.checkedInAt,
      checkedInBy: a.checkedInBy,
      gate: a.gate,
      deviceInformation: a.deviceInformation,
    };

    a.checkInStatus = 'NOT_CHECKED_IN';
    a.checkedInAt = undefined;
    a.checkedInBy = undefined;
    a.gate = undefined;
    a.deviceInformation = undefined;
    a.reversedAt = new Date();
    a.reversedBy = new Types.ObjectId(adminId(req));
    a.reversalReason = input.reason;
    a.attendanceHistory = [
      ...(a.attendanceHistory || []),
      { action: 'REVERSAL', at: new Date(), administratorId: adminId(req), reason: input.reason, previous },
    ];
    await a.save();

    await logActivity(req, eid, 'CHECK_IN_REVERSED', 'Check-in reversed', new Types.ObjectId(p._id), 'SUCCESS', {
      reason: input.reason,
      previous,
    });

    res.json({ success: true, outcome: 'REVERSED', message: 'Check-in reversed; participant may check in again' });
  } catch (error) {
    next(error);
  }
}

/* ------------------------------------------------------------------ */
/* Routes                                                             */
/* ------------------------------------------------------------------ */

router.use(authenticate);

// Gate scanning
router.post('/accreditation/scan', scanLimiter, authorizeRoles(...ADMIN_ROLES), scanQr);
router.post('/accreditation/check-in', scanLimiter, authorizeRoles(...ADMIN_ROLES), checkInParticipant);

// Attendance reporting
router.get('/admin/attendance', authorizeRoles(...VIEW_ROLES), listAttendance);
router.get('/admin/attendance/statistics', authorizeRoles(...VIEW_ROLES), attendanceStatistics);
router.get('/admin/participants/:participantId/attendance', authorizeRoles(...VIEW_ROLES), participantAttendance);

// Corrections
router.patch('/admin/participants/:participantId/attendance/reverse', authorizeRoles('SUPER_ADMIN'), reverseCheckIn);

export default router;