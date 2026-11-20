import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from '../modules/auth/auth.routes';
import eventRoutes from '../modules/events/events.routes';
import registrationRoutes, { lookupRoutes } from '../modules/registrations/registration.routes';
import accreditationRoutes, { participantQrRoutes } from '../modules/accreditation/accreditation.routes';
import pdfRoutes, { publicPdfRoutes } from '../modules/pdf/pdf.routes';
import adminParticipantRoutes from '../modules/adminParticipants/adminParticipants.routes';
import attendanceRoutes from '../modules/attendance/attendance.routes';

const router = Router();

/* ---------- Public routes (no login) ---------- */
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/event', eventRoutes);               // GET /event, GET /event/categories
router.use('/', registrationRoutes);             // POST /register
router.use('/registrations', lookupRoutes);      // GET /registrations/lookup
router.use('/participants', publicPdfRoutes);    // POST /participants/:registrationId/accreditation-pass

/* ---------- Admin routes (login required) ---------- */
router.use('/admin', adminParticipantRoutes);
router.use('/accreditation', accreditationRoutes);
router.use('/participants', pdfRoutes);
router.use('/participants', participantQrRoutes);
router.use('/', attendanceRoutes);               // keep last: it applies authenticate to everything it sees

export default router;