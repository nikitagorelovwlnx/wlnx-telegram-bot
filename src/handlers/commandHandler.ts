import { Context, Markup } from 'telegraf';
import { userService } from '../services/userService';
import { getUserInfo, handleError, logUserAction, isAdmin } from '../utils/helpers';
import { config } from '../config';

export class CommandHandler {
  // Start command
  static async start(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      logUserAction(ctx, 'start');

      // Initialize user in service
      userService.setUser(userInfo.id.toString(), {
        telegramId: userInfo.id.toString(),
        username: userInfo.username,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
      });

      const isAuthenticated = userService.isAuthenticated(userInfo.id.toString());
      const userName = userInfo.firstName || userInfo.username || 'пользователь';

      if (isAuthenticated) {
        // Check if user has completed wellness interview
        const { WellnessHandler } = await import('./wellnessHandler');
        const hasWellnessInterview = await WellnessHandler.checkWellnessInterview(ctx);

        if (!hasWellnessInterview) {
          await ctx.reply(
            `👋 Добро пожаловать обратно, ${userName}!\n\n` +
            '🌿 Я заметил, что вы еще не прошли wellness-интервью с нашим коучем. ' +
            'Это поможет нам лучше понять ваши потребности в области здоровья.\n\n' +
            'Хотели бы пройти короткое интервью?',
            Markup.inlineKeyboard([
              [Markup.button.callback('🌿 Пройти wellness-интервью', 'start_wellness')],
              [Markup.button.callback('⏭️ Пропустить', 'skip_wellness')]
            ])
          );
        } else {
          await ctx.reply(
            `👋 Добро пожаловать обратно, ${userName}!\n\n` +
            '🤖 Я бот для работы с системой WLNX. Вы уже авторизованы и можете использовать все функции.',
            Markup.keyboard([
              ['📊 Мои интервью', '🌿 Wellness'],
              ['📅 Календарь', '⚙️ Настройки'],
              ['❓ Помощь']
            ]).resize()
          );
        }
      } else {
        await ctx.reply(
          `👋 Привет, ${userName}!\n\n` +
          '🤖 Я бот для работы с системой WLNX.\n\n' +
          '📝 Здесь вы можете:\n' +
          '• Управлять результатами интервью\n' +
          '• Проходить wellness-интервью с ИИ-коучем\n' +
          '• Настраивать интеграции с календарем\n' +
          '• Получать уведомления и напоминания\n\n' +
          '🔑 Для начала работы необходимо авторизоваться:',
          Markup.inlineKeyboard([
            [Markup.button.callback('🔑 Войти', 'login')],
            [Markup.button.callback('📝 Регистрация', 'register')]
          ])
        );
      }

    } catch (error) {
      handleError(ctx, error, 'Ошибка при запуске бота');
    }
  }

  // Help command
  static async help(ctx: Context): Promise<void> {
    try {
      logUserAction(ctx, 'help');

      const isAuthenticated = userService.isAuthenticated(getUserInfo(ctx).id.toString());

      let message = '❓ *Справка по боту WLNX*\n\n';

      if (isAuthenticated) {
        message += '📋 *Доступные команды:*\n\n';
        message += '🔐 *Аккаунт:*\n';
        message += '/profile - Информация о профиле\n';
        message += '/logout - Выйти из системы\n\n';
        
        message += '📊 *Интервью:*\n';
        message += '/interviews - Мои интервью\n';
        message += '/add_interview - Добавить интервью\n';
        message += '/stats - Статистика интервью\n\n';
        
        message += '📅 *Календарь:*\n';
        message += '/calendar - Настройки календаря\n\n';
        
        message += '⚙️ *Настройки:*\n';
        message += '/settings - Настройки бота\n';
        message += '/help - Эта справка\n\n';
        
        if (isAdmin(getUserInfo(ctx).id)) {
          message += '👑 *Администрирование:*\n';
          message += '/admin - Панель администратора\n\n';
        }
      } else {
        message += '🔑 *Для начала работы:*\n';
        message += '/login - Войти в систему\n';
        message += '/register - Зарегистрироваться\n\n';
      }

      message += '📞 *Поддержка:*\n';
      message += 'Если у вас возникли вопросы, обратитесь к администратору.';

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      handleError(ctx, error, 'Ошибка при показе справки');
    }
  }

  // Settings command
  static async settings(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      
      if (!userService.isAuthenticated(userInfo.id.toString())) {
        await ctx.reply('❌ Вы не авторизованы. Используйте /login для входа.');
        return;
      }

      logUserAction(ctx, 'settings');

      await ctx.reply(
        '⚙️ *Настройки бота*\n\n' +
        'Выберите раздел настроек:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔔 Уведомления', 'settings_notifications')],
            [Markup.button.callback('📅 Календарь', 'settings_calendar')],
            [Markup.button.callback('🌐 Язык', 'settings_language')],
            [Markup.button.callback('🔐 Безопасность', 'settings_security')]
          ])
        }
      );

    } catch (error) {
      handleError(ctx, error, 'Ошибка при открытии настроек');
    }
  }

  // Admin panel (for admin users only)
  static async admin(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      
      if (!isAdmin(userInfo.id)) {
        await ctx.reply('❌ У вас нет прав администратора.');
        return;
      }

      logUserAction(ctx, 'admin_panel');

      const totalUsers = userService.getUserCount();
      const authenticatedUsers = userService.getAuthenticatedUserCount();

      await ctx.reply(
        '👑 *Панель администратора*\n\n' +
        `👥 Всего пользователей: ${totalUsers}\n` +
        `🔐 Авторизованных: ${authenticatedUsers}\n` +
        `🤖 Версия бота: 1.0.0\n` +
        `🌐 API сервер: ${config.apiBaseUrl}\n\n` +
        'Выберите действие:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📊 Статистика', 'admin_stats')],
            [Markup.button.callback('👥 Пользователи', 'admin_users')],
            [Markup.button.callback('📢 Рассылка', 'admin_broadcast')],
            [Markup.button.callback('🔧 Система', 'admin_system')]
          ])
        }
      );

    } catch (error) {
      handleError(ctx, error, 'Ошибка в панели администратора');
    }
  }

  // Profile command
  static async profile(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token) {
        await ctx.reply('❌ Вы не авторизованы. Используйте /login для входа.');
        return;
      }

      logUserAction(ctx, 'profile');

      // This will be handled by AuthHandler.checkAuth
      const { AuthHandler } = await import('./authHandler');
      await AuthHandler.checkAuth(ctx);

    } catch (error) {
      handleError(ctx, error, 'Ошибка при загрузке профиля');
    }
  }

  // Handle unknown commands
  static async unknown(ctx: Context): Promise<void> {
    try {
      await ctx.reply(
        '❓ Неизвестная команда.\n\n' +
        'Используйте /help для просмотра доступных команд.',
        Markup.inlineKeyboard([
          [Markup.button.callback('❓ Помощь', 'help')]
        ])
      );

    } catch (error) {
      handleError(ctx, error, 'Ошибка при обработке неизвестной команды');
    }
  }

  // Handle text messages based on current user state
  static async handleText(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());
      const text = (ctx.message as any)?.text;

      if (!text) return;

      // Handle authentication flow
      if (user?.email && !user.isAuthenticated) {
        const { AuthHandler } = await import('./authHandler');
        await AuthHandler.handlePasswordInput(ctx, text);
        return;
      }

      // Handle wellness interview messages first
      if (user?.wellnessInterviewActive) {
        const { WellnessHandler } = await import('./wellnessHandler');
        await WellnessHandler.handleWellnessMessage(ctx, text);
        return;
      }

      // Handle interview data input
      if (user?.interviewData) {
        const { InterviewHandler } = await import('./interviewHandler');
        
        if (user.interviewData.step === 'score') {
          await InterviewHandler.handleScoreInput(ctx, text);
        } else {
          await InterviewHandler.handleInterviewInput(ctx, text);
        }
        return;
      }

      // Handle keyboard buttons
      switch (text) {
        case '📊 Мои интервью':
          const { InterviewHandler } = await import('./interviewHandler');
          await InterviewHandler.showInterviews(ctx);
          break;

        case '🌿 Wellness':
          const { WellnessHandler } = await import('./wellnessHandler');
          await WellnessHandler.showWellnessStatistics(ctx);
          break;

        case '📅 Календарь':
          await ctx.reply('📅 Функция календаря будет доступна в следующих версиях.');
          break;

        case '⚙️ Настройки':
          await CommandHandler.settings(ctx);
          break;

        case '❓ Помощь':
          await CommandHandler.help(ctx);
          break;

        default:
          // Check if it looks like an email for login flow
          if (text.includes('@') && !user?.isAuthenticated) {
            const { AuthHandler } = await import('./authHandler');
            await AuthHandler.handleEmailInput(ctx, text);
          } else {
            await ctx.reply(
              '🤔 Я не понимаю эту команду.\n\n' +
              'Используйте /help для просмотра доступных команд или выберите действие из меню.'
            );
          }
      }

    } catch (error) {
      handleError(ctx, error, 'Ошибка при обработке текста');
    }
  }
}
