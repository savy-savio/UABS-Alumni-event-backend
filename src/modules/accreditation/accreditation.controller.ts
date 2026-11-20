import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyQrToken, safeQrParticipant, getCurrentQr, revokeQr, regenerateQr } from '../../services/qr.service';
import { ActivityLogModel } from '../../models/ActivityLog';
import { AppError } from '../../utils/AppError';
const verifySchema = z.object({ token: z.string().trim().min(20).max(512) }).strict();
const idSchema = z.string().regex(/^[a-f\d]{24}$/i);
async function logAction(req: Request, action: 'QR_VERIFIED'|'INVALID_QR_ATTEMPT'|'QR_REGENERATED'|'QR_REVOKED', description: string, targetId?: string, result: 'SUCCESS'|'FAILURE' = 'SUCCESS') {
  if (!req.auth?.administratorId) return;
  await ActivityLogModel.create({ administratorId: req.auth.administratorId, action, description, targetType: 'Participant', targetId: targetId, ipAddress: req.ip, userAgent: req.get('user-agent'), result });
}
export async function verify(req: Request, res: Response, next: NextFunction) { try {
  const { token } = verifySchema.parse(req.body); const result = await verifyQrToken(token);
  const valid = result.outcome === 'VALID';
  if ('participant' in result && result.participant) await logAction(req, valid ? 'QR_VERIFIED' : 'INVALID_QR_ATTEMPT', `QR verification ${result.outcome}`, String(result.participant._id), valid ? 'SUCCESS' : 'FAILURE'); else await logAction(req, 'INVALID_QR_ATTEMPT', `QR verification ${result.outcome}`, undefined, 'FAILURE');
  res.json({ success: true, data: { outcome: result.outcome, participant: 'participant' in result && result.participant ? safeQrParticipant(result.participant as unknown as Record<string, unknown>) : undefined } });
} catch(e) { next(e); } }
export async function qrImage(req: Request, res: Response, next: NextFunction) { try { const id=idSchema.parse(req.params.participantId);const current=await getCurrentQr(id);if(!current)throw new AppError('Active QR pass not found',404);res.setHeader('Content-Type','image/png');res.setHeader('Cache-Control','no-store');res.send(current.image); }catch(e){next(e);} }
export async function revoke(req: Request,res:Response,next:NextFunction){try{const id=idSchema.parse(req.params.participantId);const result=await revokeQr(id);if(!result.matchedCount)throw new AppError('Active QR pass not found',404);await logAction(req,'QR_REVOKED','QR pass revoked',id);res.json({success:true,message:'QR pass revoked'});}catch(e){next(e);}}
export async function regenerate(req: Request,res:Response,next:NextFunction){try{const id=idSchema.parse(req.params.participantId);const result=await regenerateQr(id);if(!result)throw new AppError('Participant not found',404);await logAction(req,'QR_REGENERATED','QR pass regenerated',id);res.json({success:true,message:'QR pass regenerated',data:{issuedAt:result.issuedAt,image:`data:image/png;base64,${result.image.toString('base64')}`}});}catch(e){next(e);}}
