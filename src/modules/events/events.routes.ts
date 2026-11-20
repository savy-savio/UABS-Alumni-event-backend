import { Router } from 'express';
import { eventDetails, eventCategories } from './events.controller';

const router = Router();
router.get('/', eventDetails);
router.get('/categories', eventCategories);
export default router;