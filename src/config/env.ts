import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();
const envSchema = z.object({
 NODE_ENV:z.enum(['development','production','test']).default('development'),
 PORT:z.coerce.number().int().min(1).max(65535).default(5000),
 CLIENT_URL:z.string().min(1).transform(v=>v.split(',').map(x=>x.trim().replace(/\/+$/,'')).filter(Boolean)).pipe(z.array(z.string().url()).min(1)),
 MONGODB_URI:z.string().min(1).refine(v=>v.startsWith('mongodb://')||v.startsWith('mongodb+srv://')),
 JWT_ACCESS_SECRET:z.string().min(32), JWT_REFRESH_SECRET:z.string().min(32),
 JWT_ACCESS_EXPIRES_IN:z.string().default('12h'), JWT_REFRESH_EXPIRES_IN:z.string().default('30d'),
 COOKIE_SECURE:z.coerce.boolean().default(false), COOKIE_SAME_SITE:z.enum(['strict','lax','none']).default('lax'),
 COOKIE_DOMAIN:z.string().optional(), BCRYPT_SALT_ROUNDS:z.coerce.number().int().min(10).max(16).default(12),
 PASSWORD_RESET_EXPIRES_IN_MINUTES:z.coerce.number().int().min(5).max(120).default(30), QR_TOKEN_SECRET:z.string().min(32), QR_VERIFY_URL:z.string().url().optional(), BREVO_SMTP_HOST:z.string().default('smtp-relay.brevo.com'), BREVO_SMTP_PORT:z.coerce.number().int().default(587), BREVO_SMTP_LOGIN:z.string().optional(), BREVO_SMTP_KEY:z.string().optional(), EMAIL_FROM:z.string().email().default('noreply@example.com'), EMAIL_FROM_NAME:z.string().min(1).default('University of Abuja Business School'), EMAIL_REPLY_TO:z.string().email().default('uabs@uniabuja.edu.ng'), FRONTEND_URL:z.string().url().default('http://localhost:3000'), EMAIL_ENABLED:z.preprocess(v=>v==='true'||v===true,z.boolean()).default(false), BREVO_WEBHOOK_SECRET:z.string().optional(), EMAIL_MAX_ATTEMPTS:z.coerce.number().int().min(1).max(10).default(3),
});
const parsed=envSchema.safeParse(process.env);
if(!parsed.success){console.error('Invalid environment configuration:',parsed.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '));process.exit(1);}
export const env=parsed.data; export const isProduction=env.NODE_ENV==='production';
