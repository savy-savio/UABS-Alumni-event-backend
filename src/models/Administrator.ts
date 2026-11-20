import { Schema, model, models, type InferSchemaType } from 'mongoose';
import { ADMIN_PERMISSIONS, ADMIN_ROLES } from '../constants/modelEnums';
import { EMAIL_REGEX, normalizeEmail } from '../utils/validators';

const administratorSchema = new Schema({
  fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
  email: { type: String, required: true, trim: true, lowercase: true, set: normalizeEmail, match: EMAIL_REGEX },
  passwordHash: { type: String, required: true, select: false, minlength: 20, maxlength: 512 },
  role: { type: String, enum: ADMIN_ROLES, required: true, default: 'SUPER_ADMIN' },
  permissions: [{ type: String, enum: ADMIN_PERMISSIONS }],
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date },
  passwordChangedAt: { type: Date },
}, { timestamps: true, versionKey: false });
administratorSchema.index({ email: 1 }, { unique: true, name: 'uniq_administrator_email' });
administratorSchema.index({ role: 1, isActive: 1 }, { name: 'administrators_by_role_active' });

export type Administrator = InferSchemaType<typeof administratorSchema>;
export const AdministratorModel = models.Administrator || model('Administrator', administratorSchema);