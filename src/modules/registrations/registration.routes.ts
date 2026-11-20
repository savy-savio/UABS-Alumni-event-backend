import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { registration, lookup } from './registration.controller';

const router = Router();

const publicRegistrationLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Try again later.' },
});

const lookupLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many lookup attempts. Try again later.' },
});

// POST /register
router.post('/register', publicRegistrationLimit, registration);

// GET /registrations/lookup
export const lookupRoutes = Router();
lookupRoutes.get('/lookup', lookupLimit, lookup);

export default router;