import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { isProduction } from '../config/env';

interface ErrorBody {
  success: false;
  message: string;
  errors?: { path: string; message: string }[];
  stack?: string;
}

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  // Express identifies error handlers by their four-argument signature.
  _next: NextFunction,
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: ErrorBody['errors'];

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    errors = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  } else if (err instanceof Error && err.message === 'Not allowed by CORS') {
    statusCode = 403;
    message = 'Origin not allowed';
  } else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON in request body';
  }

  if (statusCode >= 500) {
    logger.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  }

  const body: ErrorBody = { success: false, message };
  if (errors) body.errors = errors;
  if (!isProduction && err instanceof Error && statusCode >= 500) body.stack = err.stack;

  res.status(statusCode).json(body);
};
