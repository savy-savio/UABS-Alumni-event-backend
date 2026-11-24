import { get } from 'node:https';
import { logger } from '../utils/logger';

const INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

/** Pings this server's own public URL so Render's free plan never sees 15 idle minutes. */
export function startKeepAlive(): void {
  const baseUrl = process.env.RENDER_EXTERNAL_URL; // Render sets this automatically
  if (!baseUrl) return; // does nothing on your own computer

  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/health`;

  setInterval(() => {
    get(url, (res) => {
      res.resume();
      logger.info(`[keep-alive] ${res.statusCode}`);
    }).on('error', () => logger.warn('[keep-alive] ping failed'));
  }, INTERVAL_MS).unref();
}