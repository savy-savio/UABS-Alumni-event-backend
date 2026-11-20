import { EventModel } from '../../models/Event';
import { ParticipantCategoryModel } from '../../models/ParticipantCategory';
import { AppError } from '../../utils/AppError';

type LeanDoc = Record<string, any>;

const publicEventProjection = 'name slug description theme eventDate endDate venue address city country contactEmail contactPhone logo bannerImage registrationOpen registrationStartDate registrationEndDate';

export const isRegistrationOpen = (event: Record<string, unknown>, now = new Date()): boolean => {
  if (event.registrationOpen !== true) return false;
  const start = event.registrationStartDate as Date | undefined;
  const end = event.registrationEndDate as Date | undefined;
  return (!start || start <= now) && (!end || end >= now);
};

/** The one and only event, whatever its status. Used by admin routes. */
export async function getEvent(): Promise<LeanDoc> {
  const event = (await EventModel.findOne().sort({ createdAt: 1 }).lean()) as unknown as LeanDoc | null;
  if (!event) throw new AppError('Event has not been set up yet. Run the seed script.', 404);
  return event;
}

/** The event as the public sees it: it must be PUBLISHED. */
export async function getPublishedEventDoc(): Promise<LeanDoc> {
  const event = (await EventModel.findOne({ status: 'PUBLISHED' }).sort({ createdAt: 1 }).lean()) as unknown as LeanDoc | null;
  if (!event) throw new AppError('Event not found', 404);
  return event;
}

export async function getPublicEvent() {
  const event = (await EventModel.findOne({ status: 'PUBLISHED' })
    .sort({ createdAt: 1 })
    .select(publicEventProjection)
    .lean()) as unknown as LeanDoc | null;
  if (!event) throw new AppError('Event not found', 404);

  const categories = (await ParticipantCategoryModel.find({ eventId: event._id, isActive: true })
    .select('name description requiredFields optionalFields')
    .lean()) as unknown as LeanDoc[];

  return { ...event, registrationCurrentlyOpen: isRegistrationOpen(event), categories };
}

export async function getEventCategories() {
  const event = await getPublishedEventDoc();
  return (await ParticipantCategoryModel.find({ eventId: event._id, isActive: true })
    .select('name description requiredFields optionalFields')
    .lean()) as unknown as LeanDoc[];
}