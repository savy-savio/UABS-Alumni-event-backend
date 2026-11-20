import type { Request, Response, NextFunction } from 'express';
import { ParticipantModel } from '../../models/Participant';
import { generateParticipantPdf } from './pdf.service';
import { AppError } from '../../utils/AppError';

export async function downloadAdminPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await generateParticipantPdf(req.params.participantId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(result.buffer);
  } catch (error) { next(error); }
}
export async function downloadParticipantPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const registrationId = String(req.params.registrationId || '').trim().toUpperCase();
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!registrationId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Valid registration ID and registered email are required', 400);
    const participant = (await ParticipantModel.findOne({ registrationId, email }).select('_id').lean()) as unknown as { _id: unknown } | null;
    if (!participant) throw new AppError('Registration verification failed', 404);
    const result = await generateParticipantPdf(String(participant._id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(result.buffer);
  } catch (error) { next(error); }
}
