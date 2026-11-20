import { Request, Response } from 'express';
import { APP_NAME } from '../constants';
import { env } from '../config/env';
import { getDatabaseStatus } from '../config/database';

export const getHealth = (_req: Request, res: Response): void => {
  const database = getDatabaseStatus();

  res.status(database === 'connected' ? 200 : 503).json({
    success: database === 'connected',
    status: database === 'connected' ? 'ok' : 'degraded',
    application: APP_NAME,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    database,
  });
};
