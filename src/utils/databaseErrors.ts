import mongoose from 'mongoose';

export type DatabaseErrorCode = 'DUPLICATE_KEY' | 'INVALID_ID' | 'VALIDATION' | 'DATABASE' | 'UNKNOWN';
export interface SafeDatabaseError {
  code: DatabaseErrorCode;
  message: string;
  fields?: string[];
}

export const toSafeDatabaseError = (error: unknown): SafeDatabaseError => {
  if (error instanceof mongoose.Error.ValidationError) {
    return { code: 'VALIDATION', message: 'One or more fields are invalid.', fields: Object.keys(error.errors) };
  }
  if (error instanceof mongoose.Error.CastError) {
    return { code: error.kind === 'ObjectId' ? 'INVALID_ID' : 'VALIDATION', message: 'A supplied value has an invalid format.', fields: [error.path] };
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
    return { code: 'DUPLICATE_KEY', message: 'A record with one or more of these values already exists.' };
  }
  if (
    error instanceof mongoose.Error.MongooseServerSelectionError ||
    error instanceof mongoose.mongo.MongoNetworkError
  ) {
    return { code: 'DATABASE', message: 'The database is temporarily unavailable.' };
  }
  return { code: 'UNKNOWN', message: 'A database operation could not be completed.' };
};

export const isValidObjectId = (value: string): boolean => mongoose.isValidObjectId(value);