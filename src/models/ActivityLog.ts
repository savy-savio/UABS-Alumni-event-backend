import { Schema, model, models, type InferSchemaType } from 'mongoose';
import { ACTIVITY_ACTIONS } from '../constants/modelEnums';

const activityLogSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event' },
  administratorId: { type: Schema.Types.ObjectId, ref: 'Administrator', required: true },
  action: { type: String, enum: ACTIVITY_ACTIONS, required: true },
  description: { type: String, required: true, trim: true, minlength: 3, maxlength: 1000 },
  targetType: { type: String, trim: true, maxlength: 80 },
  targetId: { type: Schema.Types.ObjectId },
  metadata: { type: Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, trim: true, maxlength: 64 },
  userAgent: { type: String, trim: true, maxlength: 500 },
  result: { type: String, enum: ['SUCCESS', 'FAILURE'], default: 'SUCCESS', required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
activityLogSchema.index({ eventId: 1, createdAt: -1 }, { name: 'activity_by_event_date' });
activityLogSchema.index({ administratorId: 1, createdAt: -1 }, { name: 'activity_by_admin_date' });
activityLogSchema.index({ action: 1, createdAt: -1 }, { name: 'activity_by_action_date' });
activityLogSchema.index({ createdAt: -1 }, { name: 'activity_by_date' });
// Append-only guard for normal Mongoose application operations (not a substitute for DB permissions).
for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete'] as const) {
  activityLogSchema.pre(operation, function rejectAuditMutation() {
    throw new Error('Activity logs are append-only and cannot be modified or deleted');
  });
}
activityLogSchema.pre('save', function rejectAuditResave() {
  if (!this.isNew) throw new Error('Activity logs are append-only and cannot be modified');
});

export type ActivityLog = InferSchemaType<typeof activityLogSchema>;
export const ActivityLogModel = models.ActivityLog || model('ActivityLog', activityLogSchema);
