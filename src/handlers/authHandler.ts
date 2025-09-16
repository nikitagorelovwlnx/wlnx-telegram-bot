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
        '📝 *WLNX Registration*\n\n' +
        'To start using the bot, please register in the system.\n\n' +
        'Enter your email address:',
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
      handleError(ctx, error, 'Error starting registration');
    }
  }

  static async handleEmailInput(ctx: Context, email: string): Promise<void> {
    try {
      if (!validateEmail(email)) {
        await ctx.reply('❌ Invalid email format. Try again:');
        return;
      }

      const userInfo = getUserInfo(ctx);
      userService.setUser(userInfo.id.toString(), { email });
      
      await ctx.reply(
        '🔐 Now enter a password:\n\n' +
        '• At least 6 characters\n' +
        '• Must include lowercase and uppercase letters\n' +
        '• Must include at least one number'
      );
      
    } catch (error) {
      handleError(ctx, error, 'Error processing email');
    }
  }

  static async handlePasswordInput(ctx: Context, password: string): Promise<void> {
    try {
      const validation = validatePassword(password);
      if (!validation.valid) {
        await ctx.reply(`❌ ${validation.message}\n\nTry again:`);
        return;
      }

      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());
      
      if (!user?.email) {
        await ctx.reply('❌ Error: email not found. Start registration again with /register');
        return;
      }

      await ctx.reply('⏳ Registering you in the system...');

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
          '✅ *Registration completed successfully!*\n\n' +
          `Welcome, ${authResponse.user.name || authResponse.user.email}!\n\n` +
          'You can now use all bot features.',
          { 
            parse_mode: 'Markdown',
            ...Markup.keyboard([
              ['📊 My Interviews', '📅 Calendar'],
              ['⚙️ Settings', '❓ Help']
            ]).resize()
          }
        );

      } catch (apiError: any) {
        logger.error('Registration API error', apiError);
        
        if (apiError.status === 409) {
          await ctx.reply(
            '❌ A user with this email already exists.\n\n' +
            'Try logging in using /login'
          );
        } else {
          await ctx.reply('❌ Registration error. Try again later or contact the administrator.');
        }
      }

    } catch (error) {
      handleError(ctx, error, 'Error processing password');
    }
  }

  // Login flow
  static async startLogin(ctx: Context): Promise<void> {
    try {
      logUserAction(ctx, 'start_login');
      
      await ctx.reply(
        '🔑 *WLNX Login*\n\n' +
        'Enter your email address:',
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      handleError(ctx, error, 'Error starting login');
    }
  }

  static async handleLoginPassword(ctx: Context, email: string, password: string): Promise<void> {
    try {
      await ctx.reply('⏳ Logging you in...');

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
        '✅ *Login successful!*\n\n' +
        `Welcome, ${authResponse.user.name || authResponse.user.email}!`,
        { 
          parse_mode: 'Markdown',
          ...Markup.keyboard([
            ['📊 My Interviews', '📅 Calendar'],
            ['⚙️ Settings', '❓ Help']
          ]).resize()
        }
      );

    } catch (apiError: any) {
      logger.error('Login API error', apiError);
      
      if (apiError.status === 401) {
        await ctx.reply('❌ Invalid email or password. Try again.');
      } else {
        await ctx.reply('❌ Login error. Try again later or contact the administrator.');
      }
    }
  }

  // Logout
  static async logout(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      
      if (!userService.isAuthenticated(userInfo.id.toString())) {
        await ctx.reply('❌ You are not authenticated.');
        return;
      }

      userService.logout(userInfo.id.toString());
      logUserAction(ctx, 'logout');

      await ctx.reply(
        '👋 You have successfully logged out.\n\n' +
        'To log in again, use /login',
        Markup.removeKeyboard()
      );

    } catch (error) {
      handleError(ctx, error, 'Error during logout');
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
              '✅ *You are authenticated*\n\n' +
              `👤 Name: ${apiUser.name || 'Not specified'}\n` +
              `📧 Email: ${apiUser.email}\n` +
              `🆔 ID: ${apiUser.id}\n` +
              `📅 Registered: ${new Date(apiUser.created_at).toLocaleDateString('en-US')}`,
              { parse_mode: 'Markdown' }
            );
          } catch (apiError) {
            await ctx.reply('❌ Error fetching user data. Try logging in again.');
            userService.logout(userInfo.id.toString());
          }
        }
      } else {
        await ctx.reply(
          '❌ You are not authenticated.\n\n' +
          'Use /login to sign in or /register to create an account.'
        );
      }

    } catch (error) {
      handleError(ctx, error, 'Error checking authentication');
    }
  }
}
