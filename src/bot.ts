import { Telegraf, Context, Markup } from 'telegraf';
import { config, isDevelopment } from './config';
import { CommandHandler } from './handlers/commandHandler';
import { AuthHandler } from './handlers/authHandler';
import { InterviewHandler } from './handlers/interviewHandler';
import { logger } from './utils/logger';
import { handleError } from './utils/helpers';
import { healthCheckService } from './healthcheck';

export class TelegramBot {
  private bot: Telegraf;

  constructor() {
    this.bot = new Telegraf(config.token);
    this.setupMiddleware();
    this.setupCommands();
    this.setupCallbacks();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Logging middleware
    this.bot.use((ctx, next) => {
      const start = Date.now();
      return next().then(() => {
        const duration = Date.now() - start;
        logger.debug('Request processed', {
          userId: ctx.from?.id,
          username: ctx.from?.username,
          updateType: ctx.updateType,
          duration: `${duration}ms`
        });
      });
    });

    // Error handling middleware
    this.bot.catch((err, ctx) => {
      logger.error('Bot error', { error: err, userId: ctx.from?.id });
      handleError(ctx, err);
    });
  }

  private setupCommands(): void {
    // Main commands
    this.bot.command('start', CommandHandler.start);
    this.bot.command('save_interview', CommandHandler.saveConversation);
    this.bot.command('new_interview', CommandHandler.startNewInterview);
    this.bot.command('help', CommandHandler.help);
    this.bot.command('settings', CommandHandler.settings);

    // All text messages are handled as natural conversation
    this.bot.on('text', CommandHandler.handleText);
  }

  private setupCallbacks(): void {
    // No callbacks needed - everything is natural conversation
    // Only handle callback queries to prevent errors
    this.bot.on('callback_query', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('Just text me what you want to talk about! 😊');
    });
  }

  private async handleSkipToNotes(ctx: Context): Promise<void> {
    try {
      const { userService } = await import('./services/userService');
      const { getUserInfo } = await import('./utils/helpers');
      
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());
      
      if (user?.interviewData) {
        const interviewData = user.interviewData;
        interviewData.step = 'notes';
        userService.setUser(userInfo.id.toString(), { interviewData });
        
        await ctx.reply(
          '📝 Add interview notes (or skip by sending "-"):',
          Markup.inlineKeyboard([
            [Markup.button.callback('Skip', 'skip_notes')]
          ])
        );
      }
    } catch (error) {
      handleError(ctx, error);
    }
  }

  private async handleSkipNotes(ctx: Context): Promise<void> {
    try {
      const { userService } = await import('./services/userService');
      const { getUserInfo } = await import('./utils/helpers');
      
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());
      const token = userService.getApiToken(userInfo.id.toString());
      
      if (user?.interviewData && token) {
        const interviewData = user.interviewData;
        interviewData.notes = undefined;
        
        // Save interview
        const { apiService } = await import('./services/apiService');
        
        await ctx.reply('⏳ Сохраняю интервью...');
        
        const interview = {
          position: interviewData.position!,
          company: interviewData.company!,
          interview_date: interviewData.interview_date!,
          result: interviewData.result!,
          score: interviewData.score,
        };
        
        const savedInterview = await apiService.createInterviewResult(token, interview);
        
        // Clear interview data
        userService.setUser(userInfo.id.toString(), { interviewData: undefined });
        
        const { formatInterviewResult } = await import('./utils/helpers');
        
        await ctx.reply(
          '✅ *Interview successfully saved!*\n\n' +
          formatInterviewResult(savedInterview),
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('📊 My Interviews', 'show_interviews')],
              [Markup.button.callback('➕ Add Another', 'add_interview')]
            ])
          }
        );
      }
    } catch (error) {
      handleError(ctx, error);
    }
  }

  private setupErrorHandling(): void {
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
    });
  }

  async start(): Promise<void> {
    try {
      // Start health check server first
      logger.info('Starting health check server...');
      await healthCheckService.start(3002);

      if (isDevelopment) {
        // Use polling in development
        logger.info('Starting bot in polling mode...');
        await this.bot.launch();
      } else {
        // Use webhooks in production
        if (config.webhookUrl) {
          logger.info('Starting bot with webhook...', { webhookUrl: config.webhookUrl });
          await this.bot.launch({
            webhook: {
              domain: config.webhookUrl,
              port: config.webhookPort
            }
          });
        } else {
          logger.info('Starting bot in polling mode...');
          await this.bot.launch();
        }
      }

    } catch (error) {
      logger.error('Failed to start bot:', error);
      throw error;
    }
  }

  async stop(signal?: string): Promise<void> {
    logger.info('Stopping bot...', { signal });
    
    // Stop health check server
    await healthCheckService.stop();
    
    // Stop Telegram bot
    this.bot.stop(signal);
    logger.info('Bot stopped');
  }

  getBotInstance(): Telegraf {
    return this.bot;
  }
}
