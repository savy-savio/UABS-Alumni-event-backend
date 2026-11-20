import { z } from 'zod';
import { EMAIL_REGEX } from '../../utils/validators';

// Matches numbers like 23/407BADP/097 (letters, digits, / - _ .)
const MATRIC_REGEX = /^[A-Za-z0-9][A-Za-z0-9/\-_.]{2,79}$/;

/** Public registration form: Full name, Matriculation number, Enrolled programme, Email address. */
export const registrationSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name is required').max(160),
    matriculationNumber: z.string().trim().regex(MATRIC_REGEX, 'Enter a valid matriculation number'),
    enrolledProgramme: z.string().trim().min(2, 'Select your programme').max(180),
    graduationYear: z.coerce
      .number({ invalid_type_error: 'Select your year of graduation' })
      .int('Select a valid year of graduation')
      .min(1990, 'Select a valid year of graduation')
      .max(2035, 'Select a valid year of graduation'),
    email: z.string().trim().toLowerCase().regex(EMAIL_REGEX, 'Enter a valid email address'),
    // Passport photograph as a data URL (the browser resizes it before upload)
    photo: z
      .string({ required_error: 'A passport photograph is required' })
      .min(1, 'A passport photograph is required')
      .max(700_000, 'Photo is too large. Maximum size is 500 KB'),
  })
  .strict();

export const lookupSchema = z
  .object({
    registrationId: z.string().trim().min(5).max(40),
    email: z.string().trim().toLowerCase().regex(EMAIL_REGEX),
  })
  .strict();