import { Request, Response, NextFunction } from 'express';
import * as service from './events.service';

/** GET /event: the single published event, with its categories. */
export async function eventDetails(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await service.getPublicEvent() });
  } catch (e) {
    next(e);
  }
}

/** GET /event/categories: active participant categories for the event. */
export async function eventCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await service.getEventCategories() });
  } catch (e) {
    next(e);
  }
}