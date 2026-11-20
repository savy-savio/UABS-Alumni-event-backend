import { AppError } from './AppError';

export const MAX_PHOTO_BYTES = 500 * 1024; // decoded size
const MIN_PHOTO_BYTES = 1024;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

const startsWith = (buf: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

function matchesSignature(type: string, buf: Buffer): boolean {
  if (type === 'image/jpeg') return startsWith(buf, [0xff, 0xd8, 0xff]);
  if (type === 'image/png') return startsWith(buf, [0x89, 0x50, 0x4e, 0x47]);
  if (type === 'image/webp') return startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8);
  return false;
}

/** Validates a data-URL image and returns the raw bytes. Throws a 400 AppError when it is not an acceptable photo. */
export function parsePhoto(value: unknown): { buffer: Buffer; contentType: 'image/jpeg' | 'image/png' | 'image/webp' } {
  if (typeof value !== 'string' || !value) throw new AppError('A passport photograph is required', 400);
  const match = DATA_URL.exec(value);
  if (!match) throw new AppError('Photo must be a JPEG, PNG or WebP image', 400);

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length < MIN_PHOTO_BYTES) throw new AppError('Photo is too small or corrupt', 400);
  if (buffer.length > MAX_PHOTO_BYTES) throw new AppError('Photo is too large. Maximum size is 500 KB', 400);
  // The declared type must match the real file signature (stops disguised files)
  if (!matchesSignature(match[1], buffer)) throw new AppError('Photo file is not a valid image', 400);

  return { buffer, contentType: match[1] as 'image/jpeg' | 'image/png' | 'image/webp' };
}
