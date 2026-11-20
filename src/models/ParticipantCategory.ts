import { Schema, model, models, type InferSchemaType } from 'mongoose';
import { PARTICIPANT_FIELD_KEYS } from '../constants/modelEnums';

const participantCategorySchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 1000 },
  requiredFields: [{ type: String, enum: PARTICIPANT_FIELD_KEYS }],
  optionalFields: [{ type: String, enum: PARTICIPANT_FIELD_KEYS }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false });
participantCategorySchema.pre('validate', function validateFieldLists() {
  const required = this.requiredFields as string[];
  const optional = this.optionalFields as string[];
  if (new Set(required).size !== required.length) this.invalidate('requiredFields', 'Required fields must not contain duplicates');
  if (new Set(optional).size !== optional.length) this.invalidate('optionalFields', 'Optional fields must not contain duplicates');
  if (required.some((field) => optional.includes(field))) this.invalidate('optionalFields', 'A field cannot be both required and optional');
});
participantCategorySchema.index({ eventId: 1, name: 1 }, { unique: true, name: 'uniq_category_name_per_event' });
participantCategorySchema.index({ eventId: 1, isActive: 1 }, { name: 'categories_by_event_active' });

export type ParticipantCategory = InferSchemaType<typeof participantCategorySchema>;
export const ParticipantCategoryModel = models.ParticipantCategory || model('ParticipantCategory', participantCategorySchema);
