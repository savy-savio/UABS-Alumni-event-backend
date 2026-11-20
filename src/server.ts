import http from 'http';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utils/logger';
import app from './app';

let server: http.Server | undefined;
let shuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received. Shutting down gracefully...`);

  // Force exit if shutdown hangs.
  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('HTTP server closed');
    }
    await disconnectDatabase();
    process.exit(0);
  } catch (error) {
    logger.error(`Error during shutdown: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

const start = async (): Promise<void> => {
  // env.ts has already validated the environment on import and exits on failure.
  await connectDatabase();

  server = app.listen(env.PORT, () => {
    logger.info(`Server running at http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    logger.error(
      error.code === 'EADDRINUSE'
        ? `Port ${env.PORT} is already in use`
        : `Server error: ${error.message}`,
    );
    process.exit(1);
  });
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
});
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

start().catch((error: unknown) => {
  logger.error(`Failed to start server: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
