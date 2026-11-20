import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { AdministratorModel } from '../src/models/Administrator';
import { hashPassword, validatePassword } from '../src/utils/password';
import { normalizeEmail } from '../src/utils/validators';

const run = async (): Promise<void> => {
  const fullName = process.env.ADMIN_NAME?.trim();
  const emailRaw = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!fullName || !emailRaw || !password) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD before running this script.');
  }

  validatePassword(password);
  const email = normalizeEmail(emailRaw);
  const passwordHash = await hashPassword(password);

  await connectDatabase();

  const existing = await AdministratorModel.findOne({ email });
  if (existing) {
    existing.fullName = fullName;
    existing.passwordHash = passwordHash;
    existing.role = 'SUPER_ADMIN';
    existing.isActive = true;
    existing.passwordChangedAt = new Date();
    await existing.save();
    console.log(`Updated existing administrator ${email} (password reset, SUPER_ADMIN, active).`);
  } else {
    await AdministratorModel.create({
      fullName,
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    });
    console.log(`SUPER_ADMIN created: ${email}`);
  }
};

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Failed to create Super Admin');
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
    await mongoose.disconnect().catch(() => undefined);
  });