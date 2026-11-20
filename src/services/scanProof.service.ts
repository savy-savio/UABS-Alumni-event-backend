import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

/**
 * A "scan proof" is issued by the server when an administrator scans a participant's QR code.
 * Approving or rejecting a registration requires a valid proof for that exact participant and
 * that exact administrator, so a registration can only be approved after its QR code was scanned.
 * Proofs are stateless (HMAC signed) and expire after 10 minutes.
 */
const TTL_MS = 10 * 60 * 1000;

const sign = (data: string): string =>
  createHmac('sha256', env.QR_TOKEN_SECRET).update(`scan-proof:${data}`).digest('base64url');

export function issueScanProof(participantId: string, administratorId: string): string {
  const exp = Date.now() + TTL_MS;
  return `${exp}.${sign(`${participantId}.${administratorId}.${exp}`)}`;
}

export function assertScanProof(proof: unknown, participantId: string, administratorId: string): void {
  const needScan = "Scan this participant's QR code before approving or rejecting.";
  if (typeof proof !== 'string') throw new AppError(needScan, 403);

  const [expRaw, signature] = proof.split('.');
  const exp = Number(expRaw);
  if (!signature || !Number.isFinite(exp)) throw new AppError(needScan, 403);
  if (exp < Date.now()) throw new AppError('The scan has expired. Scan the participant\'s QR code again.', 403);

  const expected = Buffer.from(sign(`${participantId}.${administratorId}.${exp}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new AppError(needScan, 403);
  }
}