import { TelegramBot } from './bot';
import { logger } from './utils/logger';
import { config } from './config';
import * as http from 'http';

async function main(): Promise<void> {
  try {
    logger.info('Initializing WLNX Telegram Bot...', {
      nodeEnv: process.env.NODE_ENV,
      botUsername: config.username,
      apiBaseUrl: config.apiBaseUrl
    });

    // Start Telegram Bot
    const bot = new TelegramBot();
    await bot.start();

    // Create HTTP server for Cloud Run health checks
    const port = parseInt(process.env.PORT || '8080', 10);
    const server = http.createServer((req, res) => {
      if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'healthy', 
          service: 'wlnx-telegram-bot',
          timestamp: new Date().toISOString()
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(port, '0.0.0.0', () => {
      logger.info(`HTTP server listening on port ${port} for health checks`);
    });

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
