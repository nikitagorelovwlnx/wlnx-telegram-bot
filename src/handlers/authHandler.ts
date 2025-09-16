import { Context, Markup } from 'telegraf';
import { apiService } from '../services/apiService';
import { userService } from '../services/userService';
import { getUserInfo, handleError, logUserAction, validateEmail, validatePassword } from '../utils/helpers';
import { logger } from '../utils/logger';

export class AuthHandler {
  // Registration flow
  static async startRegistration(ctx: Context): Promise<void> {
    try {
      logUserAction(ctx, 'start_registration');
      
      await ctx.reply(
        '📝 *Регистрация в системе WLNX*\n\n' +
        'Для начала работы с ботом необходимо зарегистрироваться в системе.\n\n' +
        'Введите ваш email адрес:',
        { parse_mode: 'Markdown' }
      );
      
      // Set user state for registration
      const userInfo = getUserInfo(ctx);
      userService.setUser(userInfo.id.toString(), {
        telegramId: userInfo.id.toString(),
        username: userInfo.username,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
      });
      
    } catch (error) {
      handleError(ctx, error, 'Ошибка при начале регистрации');
    }
  }

  static async handleEmailInput(ctx: Context, email: string): Promise<void> {
    try {
      if (!validateEmail(email)) {
        await ctx.reply('❌ Неверный формат email. Попробуйте еще раз:');
        return;
      }

      const userInfo = getUserInfo(ctx);
      userService.setUser(userInfo.id.toString(), { email });
      
      await ctx.reply(
        '🔐 Теперь введите пароль:\n\n' +
        '• Минимум 6 символов\n' +
        '• Должен содержать строчные и заглавные буквы\n' +
        '• Должен содержать хотя бы одну цифру'
      );
      
    } catch (error) {
      handleError(ctx, error, 'Ошибка при обработке email');
    }
  }

  static async handlePasswordInput(ctx: Context, password: string): Promise<void> {
    try {
      const validation = validatePassword(password);
      if (!validation.valid) {
        await ctx.reply(`❌ ${validation.message}\n\nПопробуйте еще раз:`);
        return;
      }

      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());
      
      if (!user?.email) {
        await ctx.reply('❌ Ошибка: email не найден. Начните регистрацию заново с команды /register');
        return;
      }

      await ctx.reply('⏳ Регистрируем вас в системе...');

      try {
        const authResponse = await apiService.registerUser(
          user.email,
          password,
          user.firstName || user.username
        );

        userService.authenticate(
          userInfo.id.toString(),
          authResponse.token,
          authResponse.user.id
        );

        logUserAction(ctx, 'registration_success', { userId: authResponse.user.id });

        await ctx.reply(
          '✅ *Регистрация успешно завершена!*\n\n' +
          `Добро пожаловать, ${authResponse.user.name || authResponse.user.email}!\n\n` +
          'Теперь вы можете использовать все функции бота.',
          { 
            parse_mode: 'Markdown',
            ...Markup.keyboard([
              ['📊 Мои интервью', '📅 Календарь'],
              ['⚙️ Настройки', '❓ Помощь']
            ]).resize()
          }
        );

      } catch (apiError: any) {
        logger.error('Registration API error', apiError);
        
        if (apiError.status === 409) {
          await ctx.reply(
            '❌ Пользователь с таким email уже существует.\n\n' +
            'Попробуйте войти в систему с помощью команды /login'
          );
        } else {
          await ctx.reply('❌ Ошибка при регистрации. Попробуйте позже или обратитесь к администратору.');
        }
      }

    } catch (error) {
      handleError(ctx, error, 'Ошибка при обработке пароля');
    }
  }

  // Login flow
  static async startLogin(ctx: Context): Promise<void> {
    try {
      logUserAction(ctx, 'start_login');
      
      await ctx.reply(
        '🔑 *Вход в систему WLNX*\n\n' +
        'Введите ваш email адрес:',
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      handleError(ctx, error, 'Ошибка при начале входа');
    }
  }

  static async handleLoginPassword(ctx: Context, email: string, password: string): Promise<void> {
    try {
      await ctx.reply('⏳ Выполняем вход...');

      const authResponse = await apiService.loginUser(email, password);
      const userInfo = getUserInfo(ctx);

      userService.authenticate(
        userInfo.id.toString(),
        authResponse.token,
        authResponse.user.id
      );

      // Update user info
      userService.setUser(userInfo.id.toString(), {
        username: userInfo.username,
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
      });

      logUserAction(ctx, 'login_success', { userId: authResponse.user.id });

      await ctx.reply(
        '✅ *Вход выполнен успешно!*\n\n' +
        `Добро пожаловать, ${authResponse.user.name || authResponse.user.email}!`,
        { 
          parse_mode: 'Markdown',
          ...Markup.keyboard([
            ['📊 Мои интервью', '📅 Календарь'],
            ['⚙️ Настройки', '❓ Помощь']
          ]).resize()
        }
      );

    } catch (apiError: any) {
      logger.error('Login API error', apiError);
      
      if (apiError.status === 401) {
        await ctx.reply('❌ Неверный email или пароль. Попробуйте еще раз.');
      } else {
        await ctx.reply('❌ Ошибка при входе. Попробуйте позже или обратитесь к администратору.');
      }
    }
  }

  // Logout
  static async logout(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      
      if (!userService.isAuthenticated(userInfo.id.toString())) {
        await ctx.reply('❌ Вы не авторизованы в системе.');
        return;
      }

      userService.logout(userInfo.id.toString());
      logUserAction(ctx, 'logout');

      await ctx.reply(
        '👋 Вы успешно вышли из системы.\n\n' +
        'Для повторного входа используйте команду /login',
        Markup.removeKeyboard()
      );

    } catch (error) {
      handleError(ctx, error, 'Ошибка при выходе');
    }
  }

  // Check authentication status
  static async checkAuth(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const isAuth = userService.isAuthenticated(userInfo.id.toString());
      
      if (isAuth) {
        const user = userService.getUser(userInfo.id.toString());
        const token = userService.getApiToken(userInfo.id.toString());
        
        if (token) {
          try {
            const apiUser = await apiService.getCurrentUser(token);
            await ctx.reply(
              '✅ *Вы авторизованы в системе*\n\n' +
              `👤 Имя: ${apiUser.name || 'Не указано'}\n` +
              `📧 Email: ${apiUser.email}\n` +
              `🆔 ID: ${apiUser.id}\n` +
              `📅 Регистрация: ${new Date(apiUser.created_at).toLocaleDateString('ru-RU')}`,
              { parse_mode: 'Markdown' }
            );
          } catch (apiError) {
            await ctx.reply('❌ Ошибка при получении данных пользователя. Попробуйте войти заново.');
            userService.logout(userInfo.id.toString());
          }
        }
      } else {
        await ctx.reply(
          '❌ Вы не авторизованы в системе.\n\n' +
          'Используйте /login для входа или /register для регистрации.'
        );
      }

    } catch (error) {
      handleError(ctx, error, 'Ошибка при проверке авторизации');
    }
  }
}
