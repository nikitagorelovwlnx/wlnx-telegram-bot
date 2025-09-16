import { TelegramBot } from './bot';
import { logger } from './utils/logger';
import { config } from './config';

async function main(): Promise<void> {
  try {
    logger.info('Initializing WLNX Telegram Bot...', {
      nodeEnv: process.env.NODE_ENV,
      botUsername: config.username,
      apiBaseUrl: config.apiBaseUrl
    });

    const bot = new TelegramBot();
    await bot.start();

  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the application
main().catch((error) => {
  logger.error('Unhandled error in main', error);
  process.exit(1);
});
