import { createApp } from './app.js';
import { DEFAULT_CMS_API_TOKEN, env } from './config/env.js';
import { initDatabase } from './db/index.js';
import { logger } from './utils/logger.js';

async function main() {
  const database = await initDatabase();
  const server = createApp().listen(env.PORT, () => {
    logger.info(`BlogCMS listening on http://localhost:${env.PORT} (docs: /docs)`);
    if (env.CMS_API_TOKEN === DEFAULT_CMS_API_TOKEN) {
      logger.warn('Using the default CMS token. Set CMS_API_TOKEN for anything but the test.');
    }
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down`);
    // Safety net in case connections never drain.
    setTimeout(() => process.exit(1), 10_000).unref();
    server.close(() => {
      database
        .close()
        .then(() => process.exit(0))
        .catch((err: unknown) => {
          logger.error({ err }, 'Error while closing the database');
          process.exit(1);
        });
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
