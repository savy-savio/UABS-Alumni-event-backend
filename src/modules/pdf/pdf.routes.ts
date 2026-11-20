import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate } from '../../middleware/authenticate';
import { authorizeRoles } from '../../middleware/authorize';
import { downloadAdminPdf, downloadParticipantPdf } from './pdf.controller';

/* Admin: download any participant's pass (login required) */
const adminRoutes = Router();
adminRoutes.use(authenticate, authorizeRoles('SUPER_ADMIN'));
adminRoutes.get('/:participantId/accreditation-pass', downloadAdminPdf);

/* Public: participant downloads their own pass using registration ID + email */
export const publicPdfRoutes = Router();
const participantDocumentLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many document requests. Try again later.' },
});
publicPdfRoutes.post('/:registrationId/accreditation-pass', participantDocumentLimit, downloadParticipantPdf);

export default adminRoutes;