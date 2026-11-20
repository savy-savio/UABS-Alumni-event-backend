import { Schema, model, models, type InferSchemaType } from 'mongoose';
import { CHECK_IN_STATUSES } from '../constants/modelEnums';

const attendanceSchema = new Schema({
  eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true },
  participantId: { type: Schema.Types.ObjectId, ref: 'Participant', required: true },
  registrationId: { type: String, required: true, trim: true, uppercase: true },
  checkInStatus: { type: String, enum: CHECK_IN_STATUSES, default: 'NOT_CHECKED_IN', required: true },
  checkedInAt: { type: Date },
  checkedInBy: { type: Schema.Types.ObjectId, ref: 'Administrator' },
  gate: { type: String, trim: true, maxlength: 100 },
  deviceInformation: { type: String, trim: true, maxlength: 500 },
  reversedAt: { type: Date },
  reversedBy: { type: Schema.Types.ObjectId, ref: 'Administrator' },
  reversalReason: { type: String, trim: true, maxlength: 1000 },
  attendanceHistory: { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true, versionKey: false });
attendanceSchema.pre('validate', function validateCheckIn() {
  if (this.checkInStatus === 'CHECKED_IN' && (!this.checkedInAt || !this.checkedInBy)) {
    this.invalidate('checkedInAt', 'A checked-in record requires checkedInAt and checkedInBy');
  }
});
// The unique key serializes competing inserts; check-in updates should use conditional atomic updates.
attendanceSchema.index({ eventId: 1, participantId: 1 }, { unique: true, name: 'uniq_attendance_per_event_participant' });
attendanceSchema.index({ eventId: 1, checkInStatus: 1, checkedInAt: -1 }, { name: 'attendance_by_event_status' });

export type Attendance = InferSchemaType<typeof attendanceSchema>;
export const AttendanceModel = models.Attendance || model('Attendance', attendanceSchema);
