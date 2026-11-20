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
    email: z.string().trim().toLowerCase().regex(EMAIL_REGEX, 'Enter a valid email address'),
  })
  .strict();

export const lookupSchema = z
  .object({
    registrationId: z.string().trim().min(5).max(40),
    email: z.string().trim().toLowerCase().regex(EMAIL_REGEX),
  })
  .strict();