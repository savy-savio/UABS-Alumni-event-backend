import { Schema, model, models, type InferSchemaType } from 'mongoose';
import { INVITATION_DELIVERY_STATUSES } from '../constants/modelEnums';
import { EMAIL_REGEX, normalizeEmail } from '../utils/validators';

const invitationSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  participantId: { type: Schema.Types.ObjectId, ref: 'Participant', required: true },
  referenceCode: { type: String, required: true, trim: true, uppercase: true, minlength: 6, maxlength: 40 },
  issueDate: { type: Date, default: Date.now, required: true },
  deliveryStatus: { type: String, enum: INVITATION_DELIVERY_STATUSES, default: 'PENDING', required: true },
  emailAddress: { type: String, required: true, trim: true, lowercase: true, set: normalizeEmail, match: EMAIL_REGEX },
  resendCount: { type: Number, min: 0, max: 1000, default: 0 },
  lastSentAt: { type: Date },
  emailProviderMessageId: { type: String, trim: true, maxlength: 300 },
  lastError: { type: String, trim: true, maxlength: 2000 },
}, { timestamps: true, versionKey: false });
invitationSchema.index({ eventId: 1, participantId: 1 }, { unique: true, name: 'uniq_invitation_per_event_participant' });
invitationSchema.index({ referenceCode: 1 }, { unique: true, name: 'uniq_invitation_reference_code' });
invitationSchema.index({ eventId: 1, deliveryStatus: 1, createdAt: -1 }, { name: 'invitations_by_delivery_status' });

export type Invitation = InferSchemaType<typeof invitationSchema>;
export const InvitationModel = models.Invitation || model('Invitation', invitationSchema);
