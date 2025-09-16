import { Telegraf, Context, Markup } from 'telegraf';
import { config, isDevelopment } from './config';
import { CommandHandler } from './handlers/commandHandler';
import { AuthHandler } from './handlers/authHandler';
import { InterviewHandler } from './handlers/interviewHandler';
import { logger } from './utils/logger';
import { handleError } from './utils/helpers';

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
    // Basic commands
    this.bot.command('start', CommandHandler.start);
    this.bot.command('help', CommandHandler.help);
    this.bot.command('settings', CommandHandler.settings);
    this.bot.command('profile', CommandHandler.profile);
    this.bot.command('admin', CommandHandler.admin);

    // Auth commands
    this.bot.command('login', AuthHandler.startLogin);
    this.bot.command('register', AuthHandler.startRegistration);
    this.bot.command('logout', AuthHandler.logout);
    this.bot.command('auth', AuthHandler.checkAuth);

    // Interview commands
    this.bot.command('interviews', InterviewHandler.showInterviews);
    this.bot.command('add_interview', InterviewHandler.startAddInterview);
    this.bot.command('stats', InterviewHandler.showStatistics);

    // Wellness commands
    this.bot.command('wellness', async (ctx) => {
      const { WellnessHandler } = await import('./handlers/wellnessHandler');
      await WellnessHandler.showWellnessStatistics(ctx);
    });
    this.bot.command('wellness_start', async (ctx) => {
      const { WellnessHandler } = await import('./handlers/wellnessHandler');
      await WellnessHandler.startWellnessInterview(ctx);
    });

    // Handle unknown commands
    this.bot.on('text', CommandHandler.handleText);
  }

  private setupCallbacks(): void {
    // Auth callbacks
    this.bot.action('login', async (ctx) => {
      await ctx.answerCbQuery();
      await AuthHandler.startLogin(ctx);
    });

    this.bot.action('register', async (ctx) => {
      await ctx.answerCbQuery();
      await AuthHandler.startRegistration(ctx);
    });

    // Interview callbacks
    this.bot.action('show_interviews', async (ctx) => {
      await ctx.answerCbQuery();
      await InterviewHandler.showInterviews(ctx);
    });

    this.bot.action('add_interview', async (ctx) => {
      await ctx.answerCbQuery();
      await InterviewHandler.startAddInterview(ctx);
    });

    this.bot.action('interview_stats', async (ctx) => {
      await ctx.answerCbQuery();
      await InterviewHandler.showStatistics(ctx);
    });

    // Interview result callbacks
    this.bot.action('result_pending', async (ctx) => {
      await ctx.answerCbQuery();
      await InterviewHandler.handleResultSelection(ctx, 'pending');
    });

    this.bot.action('result_passed', async (ctx) => {
      await ctx.answerCbQuery();
      await InterviewHandler.handleResultSelection(ctx, 'passed');
    });

    this.bot.action('result_failed', async (ctx) => {
      await ctx.answerCbQuery();
      await InterviewHandler.handleResultSelection(ctx, 'failed');
    });

    // Skip callbacks
    this.bot.action('skip_score', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleSkipToNotes(ctx);
    });

    this.bot.action('skip_notes', async (ctx) => {
      await ctx.answerCbQuery();
      await this.handleSkipNotes(ctx);
    });

    // Settings callbacks
    this.bot.action('settings_notifications', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('🔔 Настройки уведомлений будут доступны в следующих версиях.');
    });

    this.bot.action('settings_calendar', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('📅 Настройки календаря будут доступны в следующих версиях.');
    });

    this.bot.action('settings_language', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('🌐 Настройки языка будут доступны в следующих версиях.');
    });

    this.bot.action('settings_security', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('🔐 Настройки безопасности будут доступны в следующих версиях.');
    });

    // Admin callbacks
    this.bot.action('admin_stats', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('📊 Детальная статистика будет доступна в следующих версиях.');
    });

    this.bot.action('admin_users', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('👥 Управление пользователями будет доступно в следующих версиях.');
    });

    this.bot.action('admin_broadcast', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('📢 Функция рассылки будет доступна в следующих версиях.');
    });

    this.bot.action('admin_system', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('🔧 Системные настройки будут доступны в следующих версиях.');
    });

    // Help callback
    this.bot.action('help', async (ctx) => {
      await ctx.answerCbQuery();
      await CommandHandler.help(ctx);
    });

    // Wellness callbacks
    this.bot.action('start_wellness', async (ctx) => {
      await ctx.answerCbQuery();
      const { WellnessHandler } = await import('./handlers/wellnessHandler');
      await WellnessHandler.startWellnessInterview(ctx);
    });

    this.bot.action('skip_wellness', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        '⏭️ Wellness-интервью пропущено.\n\n' +
        'Вы можете пройти его в любое время через команду /wellness_start',
        Markup.keyboard([
          ['📊 Мои интервью', '🌿 Wellness'],
          ['📅 Календарь', '⚙️ Настройки'],
          ['❓ Помощь']
        ]).resize()
      );
    });

    this.bot.action('complete_wellness', async (ctx) => {
      await ctx.answerCbQuery();
      const { WellnessHandler } = await import('./handlers/wellnessHandler');
      await WellnessHandler.completeWellnessInterview(ctx);
    });

    this.bot.action('wellness_stats', async (ctx) => {
      await ctx.answerCbQuery();
      const { WellnessHandler } = await import('./handlers/wellnessHandler');
      await WellnessHandler.showWellnessStatistics(ctx);
    });

    this.bot.action('restart_wellness', async (ctx) => {
      await ctx.answerCbQuery();
      const { WellnessHandler } = await import('./handlers/wellnessHandler');
      await WellnessHandler.restartWellnessInterview(ctx);
    });

    this.bot.action('confirm_restart_wellness', async (ctx) => {
      await ctx.answerCbQuery();
      const { WellnessHandler } = await import('./handlers/wellnessHandler');
      await WellnessHandler.startWellnessInterview(ctx);
    });

    this.bot.action('cancel_restart_wellness', async (ctx) => {
      await ctx.answerCbQuery();
      const { WellnessHandler } = await import('./handlers/wellnessHandler');
      await WellnessHandler.showWellnessStatistics(ctx);
    });

    this.bot.action('main_menu', async (ctx) => {
      await ctx.answerCbQuery();
      await CommandHandler.start(ctx);
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
          '📝 Добавьте заметки об интервью (или пропустите, отправив "-"):',
          Markup.inlineKeyboard([
            [Markup.button.callback('Пропустить', 'skip_notes')]
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
          '✅ *Интервью успешно сохранено!*\n\n' +
          formatInterviewResult(savedInterview),
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('📊 Мои интервью', 'show_interviews')],
              [Markup.button.callback('➕ Добавить еще', 'add_interview')]
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

      logger.info('Bot started successfully', {
        username: config.username,
        mode: isDevelopment ? 'development' : 'production'
      });

      // Enable graceful stop
      process.once('SIGINT', () => this.stop('SIGINT'));
      process.once('SIGTERM', () => this.stop('SIGTERM'));

    } catch (error) {
      logger.error('Failed to start bot', error);
      throw error;
    }
  }

  async stop(signal?: string): Promise<void> {
    logger.info('Stopping bot...', { signal });
    this.bot.stop(signal);
    logger.info('Bot stopped');
  }

  getBotInstance(): Telegraf {
    return this.bot;
  }
}
