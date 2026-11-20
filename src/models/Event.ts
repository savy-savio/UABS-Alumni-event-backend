import { Schema, model, models, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { EVENT_STATUSES } from '../constants/modelEnums';
import { EMAIL_REGEX, PHONE_REGEX, normalizePhone } from '../utils/validators';

const eventSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 5, maxlength: 180 },
  institution: { type: String, trim: true, maxlength: 180 },
  organizingBody: { type: String, trim: true, maxlength: 180 },
  slug: { type: String, required: true, trim: true, lowercase: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, maxlength: 180 },
  description: { type: String, trim: true, maxlength: 5000 },
  theme: { type: String, trim: true, maxlength: 500 },
  eventDate: { type: Date, required: true },
  endDate: { type: Date, validate: { validator(this: { eventDate?: Date }, value?: Date) { return !value || !this.eventDate || value >= this.eventDate; }, message: 'endDate must be on or after eventDate' } },
  venue: { type: String, required: true, trim: true, minlength: 2, maxlength: 180 },
  address: { type: String, required: true, trim: true, minlength: 3, maxlength: 300 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  country: { type: String, required: true, trim: true, maxlength: 100 },
  contactEmail: { type: String, trim: true, lowercase: true, validate: { validator: (v: string) => !v || EMAIL_REGEX.test(v), message: 'contactEmail must be valid' } },
  contactPhone: { type: String, trim: true, set: (v: string) => v ? normalizePhone(v) : v, validate: { validator: (v: string) => !v || PHONE_REGEX.test(v), message: 'contactPhone must be a valid international phone number' } },
  logo: { type: String, trim: true, maxlength: 2048 },
  bannerImage: { type: String, trim: true, maxlength: 2048 },
  registrationOpen: { type: Boolean, default: false },
  registrationStartDate: { type: Date },
  registrationEndDate: { type: Date },
  status: { type: String, enum: EVENT_STATUSES, default: 'DRAFT', required: true },
}, { timestamps: true, versionKey: false });

eventSchema.pre('validate', function validateRegistrationWindow() {
  if (this.registrationStartDate && this.registrationEndDate && this.registrationEndDate < this.registrationStartDate) {
    this.invalidate('registrationEndDate', 'registrationEndDate must be on or after registrationStartDate');
  }
});
eventSchema.index({ slug: 1 }, { unique: true, name: 'uniq_event_slug' });
eventSchema.index({ status: 1, eventDate: 1 }, { name: 'event_status_date' });

export type Event = InferSchemaType<typeof eventSchema>;
export type EventDocument = HydratedDocument<Event>;
export const EventModel = models.Event || model('Event', eventSchema);
