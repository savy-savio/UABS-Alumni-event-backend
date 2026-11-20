import type { Request, Response, NextFunction } from 'express';
import { verifyAccess } from '../utils/jwt';
import { AdministratorModel } from '../models/Administrator';
import { AppError } from '../utils/AppError';
import { permissionsFor } from '../services/auth.service';

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Read the bearer token
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AppError('Authentication required', 401);

    // 2. Verify the token and load the administrator
    const payload = verifyAccess(header.slice(7));
    const admin = await AdministratorModel.findById(payload.administratorId);
    if (!admin || !admin.isActive) throw new AppError('Authentication required', 401);

    // 3. Attach the identity to the request
    req.auth = {
      administratorId: admin._id.toString(),
      role: admin.role,
      sessionId: payload.sessionId,
    };
    req.administrator = {
      _id: admin._id.toString(),
      role: admin.role,
      permissions: permissionsFor(admin.role, admin.permissions),
      isActive: admin.isActive,
    };

    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError('Authentication required', 401));
  }
};