import { Schema, model, models, type InferSchemaType } from 'mongoose';
import { QR_STATUSES, REGISTRATION_STATUSES } from '../constants/modelEnums';
import { EMAIL_REGEX, normalizeEmail, normalizePhone, PHONE_REGEX } from '../utils/validators';

const participantSchema = new Schema({
  fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
  email: { type: String, required: true, trim: true, lowercase: true, set: normalizeEmail, match: EMAIL_REGEX },
  phone: { type: String, trim: true, set: (v?: string) => (v ? normalizePhone(v) : v), match: PHONE_REGEX },
  gender: { type: String, trim: true, enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] },
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  categoryId: { type: Schema.Types.ObjectId, ref: 'ParticipantCategory', required: true },
  registrationId: { type: String, required: true, trim: true, uppercase: true, minlength: 5, maxlength: 40 },
  registrationStatus: { type: String, enum: REGISTRATION_STATUSES, default: 'PENDING', required: true },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'Administrator' },
  approvedAt: { type: Date },
  rejectedBy: { type: Schema.Types.ObjectId, ref: 'Administrator' },
  rejectedAt: { type: Date },
  rejectionReason: { type: String, trim: true, maxlength: 1000 },
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'Administrator' },
  cancelledAt: { type: Date },
  cancellationReason: { type: String, trim: true, maxlength: 1000 },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'Administrator' },
  registeredAt: { type: Date, default: Date.now, required: true },
  registrationSource: { type: String, trim: true, maxlength: 80, default: 'WEB' },
  institution: { type: String, trim: true, maxlength: 180 },
  department: { type: String, trim: true, maxlength: 160 },
  matriculationNumber: { type: String, trim: true, uppercase: true, maxlength: 80 },
  enrolledProgramme: { type: String, trim: true, maxlength: 180 },
  qrTokenHash: { type: String, select: false, trim: true, minlength: 32, maxlength: 256 },
  qrIssuedAt: { type: Date },
  qrStatus: { type: String, enum: QR_STATUSES, default: 'ACTIVE' },
  additionalInformation: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, versionKey: false });

participantSchema.index({ registrationId: 1 }, { unique: true, name: 'uniq_participant_registration_id' });
// Default event policy: one registration per normalized email per event.
participantSchema.index({ eventId: 1, email: 1 }, { unique: true, name: 'uniq_participant_email_per_event' });
participantSchema.index({ eventId: 1, matriculationNumber: 1 }, {
  unique: true, name: 'uniq_matriculation_per_event', partialFilterExpression: { matriculationNumber: { $type: 'string' } },
});
participantSchema.index({ eventId: 1, categoryId: 1 }, { name: 'participants_by_event_category' });
participantSchema.index({ eventId: 1, registrationStatus: 1, createdAt: -1 }, { name: 'participants_by_registration_status' });
participantSchema.index({ qrTokenHash: 1 }, { unique: true, sparse: true, name: 'uniq_qr_token_hash' });

export type Participant = InferSchemaType<typeof participantSchema>;
export const ParticipantModel = models.Participant || model('Participant', participantSchema);