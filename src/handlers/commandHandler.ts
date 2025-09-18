import { Context, Markup } from 'telegraf';
import { userService } from '../services/userService';
import { getUserInfo, handleError, logUserAction, isAdmin } from '../utils/helpers';
import { logger } from '../utils/logger';
import { config } from '../config';

export class CommandHandler {
  // Start command - now acts like a human conversation
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
        isAuthenticated: false,
      });

      const user = userService.getUser(userInfo.id.toString());

      // Check if user is already authenticated
      if (user?.isAuthenticated) {
        // Start natural conversation for authenticated users
        await ctx.reply(
          `Hey ${user.firstName || 'there'}! 😊\n\n` +
          'How are you doing? What\'s new?'
        );

        // Initialize conversation if not already active
        if (!user.conversationActive) {
          userService.setUser(userInfo.id.toString(), {
            conversationActive: true,
            conversationHistory: []
          });
        }
        return;
      }

      // User not authenticated - start natural registration flow
      await ctx.reply(
        'Hey! 😊 I\'m Anna\n\n' +
        'I\'m a wellness consultant, work with people online. I help with nutrition, fitness, health in general\n\n' +
        'What\'s your name?'
      );

      // Set registration step
      userService.setUser(userInfo.id.toString(), {
        registrationStep: 'name'
      });

    } catch (error) {
      handleError(ctx, error, 'Something went wrong... 😅 Try again!');
    }
  }

  // Help command - now more conversational
  static async help(ctx: Context): Promise<void> {
    try {
      logUserAction(ctx, 'help');

      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());

      if (!user?.isAuthenticated) {
        await ctx.reply(
          'Hey! 😊\n\n' +
          'I\'m Anna, a wellness consultant. To chat, let\'s get to know each other first!\n\n' +
          'Type /start'
        );
        return;
      }

      await ctx.reply(
        `Hey ${user.firstName || 'friend'}! 😊\n\n` +
        'Just text me whatever you want to discuss - health, nutrition, fitness, how you\'re feeling. I\'m always ready to chat and give advice!'
      );

    } catch (error) {
      handleError(ctx, error, 'Something went wrong... 😅');
    }
  }

  // Settings command - now more conversational
  static async settings(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());
      
      if (!user?.isAuthenticated) {
        await ctx.reply(
          'Hmm, looks like you\'re not registered yet 🤔\n\n' +
          'Type /start so we can get to know each other!'
        );
        return;
      }

      logUserAction(ctx, 'settings');

      await ctx.reply(
        `Here\'s your info, ${user.firstName || 'friend'}! 😊\n\n` +
        `👤 Name: ${user.firstName || 'Not specified'}\n` +
        `📧 Email: ${user.email || 'Not specified'}\n` +
        `💬 Status: We know each other and can chat! ✅\n\n` +
        'If you want to change something or log out, just let me know!'
      );

    } catch (error) {
      handleError(ctx, error, 'Something went wrong with settings 😅');
    }
  }

  // Admin panel (for admin users only)
  static async admin(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      
      if (!isAdmin(userInfo.id)) {
        await ctx.reply('❌ You don\'t have administrator rights.');
        return;
      }

      logUserAction(ctx, 'admin_panel');

      const totalUsers = userService.getUserCount();
      const authenticatedUsers = userService.getAuthenticatedUserCount();

      await ctx.reply(
        '👑 *Admin Panel*\n\n' +
        `👥 Total users: ${totalUsers}\n` +
        `🔐 Authenticated: ${authenticatedUsers}\n` +
        `🤖 Bot version: 1.0.0\n` +
        `🌐 API server: ${config.apiBaseUrl}\n\n` +
        'Choose an action:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📊 Statistics', 'admin_stats')],
            [Markup.button.callback('👥 Users', 'admin_users')],
            [Markup.button.callback('📢 Broadcast', 'admin_broadcast')],
            [Markup.button.callback('🔧 System', 'admin_system')]
          ])
        }
      );

    } catch (error) {
      handleError(ctx, error, 'Error in admin panel');
    }
  }

  // Profile command
  static async profile(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token) {
        await ctx.reply('❌ You are not authorized. Use /login to sign in.');
        return;
      }

      logUserAction(ctx, 'profile');

      // This will be handled by AuthHandler.checkAuth
      const { AuthHandler } = await import('./authHandler');
      await AuthHandler.checkAuth(ctx);

    } catch (error) {
      handleError(ctx, error, 'Error loading profile');
    }
  }

  // Handle unknown commands
  static async unknown(ctx: Context): Promise<void> {
    try {
      await ctx.reply(
        '❓ Unknown command.\n\n' +
        'Use /help to view available commands.',
        Markup.inlineKeyboard([
          [Markup.button.callback('❓ Help', 'help')]
        ])
      );

    } catch (error) {
      handleError(ctx, error, 'Error processing unknown command');
    }
  }

  // Handle text messages - now as natural conversation
  static async handleText(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());
      const text = (ctx.message as any)?.text;

      if (!text) return;

      // Handle registration flow for non-authenticated users
      if (!user?.isAuthenticated && user?.registrationStep) {
        await CommandHandler.handleRegistrationFlow(ctx, text);
        return;
      }

      // Handle authentication flow (password input)
      if (user?.email && !user.isAuthenticated) {
        const { AuthHandler } = await import('./authHandler');
        await AuthHandler.handlePasswordInput(ctx, text);
        return;
      }

      // Note: Old wellness interview handler removed - now using natural conversation

      // Handle interview data input (old format)
      if (user?.interviewData) {
        const { InterviewHandler } = await import('./interviewHandler');
        
        if (user.interviewData.step === 'score') {
          await InterviewHandler.handleScoreInput(ctx, text);
        } else {
          await InterviewHandler.handleInterviewInput(ctx, text);
        }
        return;
      }

      // Main conversation flow - natural chat with AI
      if (user?.isAuthenticated) {
        await CommandHandler.handleNaturalConversation(ctx, text);
        return;
      }

      // Fallback for unauthenticated users
      await ctx.reply(
        'Hey! 😊 To chat, I need to get to know you first.\n\n' +
        'Type /start to begin!'
      );

    } catch (error) {
      handleError(ctx, error, 'Something went wrong... 😅');
    }
  }

  // Save current conversation to server
  static async saveConversation(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());
      const { conversationService } = await import('../services/conversationService');

      if (!user?.isAuthenticated) {
        await ctx.reply('❌ Вы не авторизованы. Используйте /start для входа.');
        return;
      }

      const conversationHistory = user?.conversationHistory || [];
      
      if (conversationHistory.length === 0) {
        await ctx.reply('💬 Пока нет разговора для сохранения. Начните общение!');
        return;
      }

      if (!user.email) {
        await ctx.reply('❌ Email не найден. Зарегистрируйтесь заново с помощью /start.');
        return;
      }

      await ctx.reply('⏳ Сохраняю результаты интервью на сервер...');

      try {
        const { apiService } = await import('../services/apiService');
        
        // Extract user info for logging
        const extractedInfo = conversationService.extractUserInfo(conversationHistory);
        logger.info('Manual save - Extracted wellness data before summary generation:', {
          extractedFields: Object.keys(extractedInfo).filter(key => {
            const value = (extractedInfo as any)[key];
            return value !== undefined && value !== null && value !== '';
          }),
          extractedData: extractedInfo
        });
        
        // Generate comprehensive wellness summary (now uses extracted data internally)
        const wellnessSummary = await conversationService.generateWellnessSummary(conversationHistory);
        
        // Create transcription from conversation history
        const transcription = conversationHistory
          .map(msg => `${msg.role === 'user' ? 'User' : 'Anna'}: ${msg.content}`)
          .join('\n\n');
        
        // Check if wellness interview exists for this user
        const interviews = await apiService.getWellnessInterviews(user.email);
        let currentInterview = interviews.length > 0 ? interviews[0] : null;
        
        if (!currentInterview) {
          // Create new wellness interview
          currentInterview = await apiService.createWellnessInterview(user.email, {
            transcription: transcription,
            summary: wellnessSummary
          });
          await ctx.reply('✅ Новое интервью создано и сохранено на сервере!');
        } else {
          // Update existing interview
          await apiService.updateWellnessInterview(user.email, currentInterview.id, {
            transcription: transcription,
            summary: wellnessSummary
          });
          await ctx.reply('✅ Интервью обновлено на сервере!');
        }

        logUserAction(ctx, 'manual_conversation_save', {
          messageCount: conversationHistory.length,
          transcriptionLength: transcription.length,
          summaryLength: wellnessSummary.length
        });

      } catch (apiError: any) {
        logger.error('Failed to save conversation to API', {
          error: apiError,
          email: user.email,
          conversationLength: conversationHistory.length,
          errorStatus: apiError.status,
          errorResponse: apiError.response?.data
        });
        
        let errorMessage = '❌ Ошибка при сохранении на сервер:\n';
        
        if (apiError.status === 400) {
          errorMessage += 'Неверный формат данных.\n';
          if (apiError.response?.data?.error) {
            errorMessage += `Детали: ${apiError.response.data.error}\n`;
          }
        } else if (apiError.code === 'ECONNREFUSED') {
          errorMessage += 'API сервер недоступен. Проверьте, что сервер запущен на http://localhost:3000\n';
        } else {
          errorMessage += `${apiError.message || 'Неизвестная ошибка'}\n`;
        }
        
        errorMessage += '\nПопробуйте позже или проверьте подключение к серверу.';
        
        await ctx.reply(errorMessage);
      }

    } catch (error) {
      handleError(ctx, error, 'Ошибка при сохранении разговора');
    }
  }

  // Handle natural conversation with AI
  static async handleNaturalConversation(ctx: Context, text: string): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());
      const { conversationService } = await import('../services/conversationService');

      if (!conversationService.isAvailable()) {
        await ctx.reply('Sorry, I\'m having connection issues right now 😔 Try later');
        return;
      }

      // Get conversation history
      let conversationHistory = user?.conversationHistory || [];

      // Add user message to history
      const userMessage = {
        role: 'user' as const,
        content: text,
        timestamp: new Date().toISOString()
      };
      conversationHistory.push(userMessage);

      // Generate AI response
      const response = await conversationService.generateResponse(conversationHistory);

      // Add AI response to history
      const aiMessage = {
        role: 'assistant' as const,
        content: response,
        timestamp: new Date().toISOString()
      };
      conversationHistory.push(aiMessage);

      // Extract user info from conversation
      const extractedInfo = conversationService.extractUserInfo(conversationHistory);

      // Update user with new conversation history and extracted info
      userService.setUser(userInfo.id.toString(), {
        conversationHistory: conversationHistory,
        extractedUserInfo: extractedInfo
      });

      // Auto-save/update transcription after every exchange for real-time client display
      if (user?.email && conversationHistory.length >= 2) { // Start saving from first exchange
        try {
          const { apiService } = await import('../services/apiService');
          
          // Extract user info for logging
          const extractedInfo = conversationService.extractUserInfo(conversationHistory);
          logger.info('Extracted wellness data before summary generation:', {
            extractedFields: Object.keys(extractedInfo).filter(key => {
              const value = (extractedInfo as any)[key];
              return value !== undefined && value !== null && value !== '';
            }),
            extractedData: extractedInfo
          });
          
          // Generate comprehensive wellness summary for each update (real-time summary)
          const wellnessSummary = await conversationService.generateWellnessSummary(conversationHistory);
          
          // Create transcription from conversation history
          const transcription = conversationHistory
            .map(msg => `${msg.role === 'user' ? 'User' : 'Anna'}: ${msg.content}`)
            .join('\n\n');
          
          // Check if wellness interview exists for this user
          const interviews = await apiService.getWellnessInterviews(user.email);
          let currentInterview = interviews.length > 0 ? interviews[0] : null;
          
          if (!currentInterview) {
            // Create new wellness interview
            currentInterview = await apiService.createWellnessInterview(user.email, {
              transcription: transcription,
              summary: wellnessSummary
            });
            
            // Notify user about auto-save (only for first save)
            if (conversationHistory.length <= 4) {
              setTimeout(() => {
                ctx.reply('💾 Интервью автоматически сохранено на сервер! Теперь диалог будет обновляться в реальном времени.');
              }, 2000);
            }
          } else {
            // Update existing interview
            await apiService.updateWellnessInterview(user.email, currentInterview.id, {
              transcription: transcription,
              summary: wellnessSummary
            });
            
            // Silent update for real-time display (no notification for frequent updates)
            logger.info('Auto-updated transcription for real-time display', {
              email: user.email,
              conversationLength: conversationHistory.length,
              transcriptionLength: transcription.length
            });
          }
        } catch (apiError: any) {
          // Don't break conversation if API fails
          logger.error('Failed to save conversation to API', {
            error: apiError,
            email: user?.email,
            conversationLength: conversationHistory.length,
            errorStatus: apiError.status,
            errorResponse: apiError.response?.data
          });
        }
      }

      await ctx.reply(response);

      logUserAction(ctx, 'natural_conversation', {
        messageLength: text.length,
        responseLength: response.length,
        extractedAge: extractedInfo.age,
        extractedLocation: extractedInfo.location
      });

    } catch (error) {
      handleError(ctx, error, 'Hmm, something made me think... 🤔 Can you repeat that?');
    }
  }

  // Handle registration flow
  static async handleRegistrationFlow(ctx: Context, text: string): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());

      if (!user?.registrationStep) return;

      switch (user.registrationStep) {
        case 'name':
          // Store name and ask for email
          userService.setUser(userInfo.id.toString(), {
            firstName: text,
            registrationStep: 'email'
          });
          
          await ctx.reply(
            `Nice to meet you, ${text}! 😊\n\n` +
            'Now I need your email for registration:'
          );
          break;

        case 'email':
          if (!text.includes('@')) {
            await ctx.reply('Hmm, that doesn\'t look like an email 🤔 Try again');
            return;
          }
          
          // Complete registration - just save name and email, no password needed
          userService.setUser(userInfo.id.toString(), {
            email: text,
            isAuthenticated: true,
            registrationStep: undefined
          });

          await ctx.reply(
            `Perfect! Now we know each other 🎉\n\n` +
            'Tell me, how are you doing? What\'s bothering you or what interests you?'
          );

          // Start natural conversation
          userService.setUser(userInfo.id.toString(), {
            conversationActive: true,
            conversationHistory: []
          });
          break;
      }

    } catch (error) {
      handleError(ctx, error, 'Something went wrong with registration 😅');
    }
  }
}
