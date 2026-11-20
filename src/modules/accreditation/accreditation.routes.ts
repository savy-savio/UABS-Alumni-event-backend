import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorizeRoles } from '../../middleware/authorize';
import { verify, qrImage, revoke, regenerate } from './accreditation.controller';

const router = Router();
router.use(authenticate, authorizeRoles('SUPER_ADMIN'));
router.post('/verify', verify);
router.get('/participants/:participantId/qr', qrImage);
router.post('/participants/:participantId/qr/revoke', revoke);
router.post('/participants/:participantId/qr/regenerate', regenerate);
export default router;

export const participantQrRoutes = Router();
participantQrRoutes.use(authenticate, authorizeRoles('SUPER_ADMIN'));
participantQrRoutes.get('/:participantId/qr', qrImage);
participantQrRoutes.post('/:participantId/qr/revoke', revoke);
participantQrRoutes.post('/:participantId/qr/regenerate', regenerate);