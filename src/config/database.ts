import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

let listenersRegistered = false;

const registerConnectionListeners = (): void => {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on('error', (error: Error) => {
    logger.error(`MongoDB connection error: ${error.message}`);
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
};

export const connectDatabase = async (): Promise<void> => {
  registerConnectionListeners();

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
    });
    // Log host and database name only, never the connection string.
    logger.info(
      `MongoDB connected (host: ${mongoose.connection.host}, db: ${mongoose.connection.name})`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Mongo error messages can echo parts of the URI, so mask it before logging.
    logger.error(`MongoDB connection failed: ${message.replace(env.MONGODB_URI, '[redacted]')}`);
    throw new Error('Database connection failed');
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info('MongoDB connection closed');
  }
};

export type DatabaseStatus = 'disconnected' | 'connected' | 'connecting' | 'disconnecting';

export const getDatabaseStatus = (): DatabaseStatus => {
  switch (mongoose.connection.readyState) {
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'disconnected';
  }
};
