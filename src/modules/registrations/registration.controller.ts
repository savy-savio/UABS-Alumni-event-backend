import { Request, Response, NextFunction } from 'express';
import { registrationSchema, lookupSchema } from './registration.validation';
import * as service from './registration.service';

export async function registration(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = registrationSchema.parse(req.body);
    const data = await service.registerForEvent(parsed);
    res.status(201).json({ success: true, message: 'Registration submitted successfully.', data });
  } catch (e) {
    next(e);
  }
}

export async function lookup(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = lookupSchema.parse(req.query);
    res.json({ success: true, data: await service.lookupRegistration(parsed.registrationId, parsed.email) });
  } catch (e) {
    next(e);
  }
}