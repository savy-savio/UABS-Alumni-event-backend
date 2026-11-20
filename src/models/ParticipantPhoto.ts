import { Schema, model, models } from 'mongoose';

/**
 * Passport photograph of a participant, kept in its own collection so normal
 * participant queries never load image bytes. Stored in MongoDB because hosts
 * such as Render have an ephemeral disk.
 */
const participantPhotoSchema = new Schema({
  participantId: { type: Schema.Types.ObjectId, ref: 'Participant', required: true },
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  contentType: { type: String, required: true, enum: ['image/jpeg', 'image/png', 'image/webp'] },
  data: { type: Buffer, required: true },
  size: { type: Number, required: true },
}, { timestamps: true, versionKey: false });

participantPhotoSchema.index({ participantId: 1 }, { unique: true, name: 'uniq_photo_per_participant' });

export const ParticipantPhotoModel = models.ParticipantPhoto || model('ParticipantPhoto', participantPhotoSchema);
