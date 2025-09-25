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
            conversationHistory: [],
            currentInterviewId: undefined  // Reset interview session for new conversation
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
        'Just text me whatever you want to discuss - health, nutrition, fitness, how you\'re feeling. I\'m always ready to chat and give advice!\n\n' +
        'When we first chat, I\'ll naturally learn about you to give better recommendations. No forms or commands needed - just talk to me! 😊\n\n' +
        '**Available commands:**\n' +
        '💾 /save_interview - Save our conversation to server\n' +
        '🔄 /new_interview - Start a new conversation\n' +
        '⚙️ /settings - Profile settings'
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

      // Main conversation flow - wellness data collection or natural chat
      if (user?.isAuthenticated) {
        // If user has active wellness progress - continue wellness collection
        if (user.wellnessProgress && user.wellnessProgress.currentStage !== 'completed') {
          await CommandHandler.handleWellnessStageInput(ctx, text);
          return;
        }
        
        // If user completed wellness - normal conversation
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

  // Start new interview session (reset current session)
  static async startNewInterview(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());

      if (!user?.isAuthenticated) {
        await ctx.reply('❌ You are not authenticated. Use /start to login.');
        return;
      }

      // Reset current interview session
      userService.setUser(userInfo.id.toString(), {
        currentInterviewId: undefined,
        conversationHistory: [],
        conversationActive: true
      });

      await ctx.reply('🔄 New interview session started! Previous session completed.\n\nTell me about yourself and your health and fitness goals.');

      logUserAction(ctx, 'new_interview_session');

    } catch (error) {
      handleError(ctx, error, 'Error creating new interview session');
    }
  }

  // Save current conversation to server
  static async saveConversation(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());
      const { conversationService } = await import('../services/conversationService');

      if (!user?.isAuthenticated) {
        await ctx.reply('❌ You are not authenticated. Use /start to login.');
        return;
      }

      const conversationHistory = user?.conversationHistory || [];
      
      if (conversationHistory.length === 0) {
        await ctx.reply('💬 No conversation to save yet. Start chatting!');
        return;
      }

      if (!user.email) {
        await ctx.reply('❌ Email not found. Please register again using /start.');
        return;
      }

      await ctx.reply('⏳ Saving interview results to server...');

      try {
        const { apiService } = await import('../services/apiService');
        
        // Extract structured wellness data
        const wellnessData = conversationService.extractUserInfo(conversationHistory);
        logger.info('Manual save - Extracted wellness data:', {
          extractedFields: Object.keys(wellnessData).filter(key => {
            const value = (wellnessData as any)[key];
            return value !== undefined && value !== null && value !== '';
          }),
          wellnessData: wellnessData
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
            summary: wellnessSummary,
            wellness_data: wellnessData
          });
          await ctx.reply('✅ New interview created and saved to server!');
        } else {
          // Update existing interview
          await apiService.updateWellnessInterview(user.email, currentInterview.id, {
            transcription: transcription,
            summary: wellnessSummary,
            wellness_data: wellnessData
          });
          await ctx.reply('✅ Interview updated on server!');
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
        
        let errorMessage = '❌ Error saving to server:\n';
        
        if (apiError.status === 400) {
          errorMessage += 'Invalid data format.\n';
          if (apiError.response?.data?.error) {
            errorMessage += `Details: ${apiError.response.data.error}\n`;
          }
        } else if (apiError.code === 'ECONNREFUSED') {
          errorMessage += 'API server unavailable. Check that server is running on http://localhost:3000\n';
        } else {
          errorMessage += `${apiError.message || 'Unknown error'}\n`;
        }
        
        errorMessage += '\nTry again later or check server connection.';
        
        await ctx.reply(errorMessage);
      }

    } catch (error) {
      handleError(ctx, error, 'Error saving conversation');
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

      // ⏰ Показываем, что бот "печатает"
      await ctx.sendChatAction('typing');

      // Generate AI response
      const response = await conversationService.generateResponse(conversationHistory);

      // ⚡ БЫСТРЫЙ ОТВЕТ - сразу отвечаем пользователю!
      await ctx.reply(response);

      // Add AI response to history
      const aiMessage = {
        role: 'assistant' as const,
        content: response,
        timestamp: new Date().toISOString()
      };
      conversationHistory.push(aiMessage);

      // Extract user info from conversation (single call)
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
          
          // Use the same extracted data for wellness_data
          const wellnessData = extractedInfo;
          logger.info('Extracted wellness data before summary generation:', {
            extractedFields: Object.keys(wellnessData).filter(key => {
              const value = (wellnessData as any)[key];
              return value !== undefined && value !== null && value !== '';
            }),
            wellnessData: wellnessData
          });
          
          // ⚡ ОПТИМИЗАЦИЯ: генерируем summary только для длинных разговоров
          let wellnessSummary = 'Ongoing conversation - summary will be generated after more exchanges';
          if (conversationHistory.length >= 10) { // Генерируем summary только после 10+ сообщений
            wellnessSummary = await conversationService.generateWellnessSummary(conversationHistory);
          }
          
          // Create transcription from conversation history
          const transcription = conversationHistory
            .map(msg => `${msg.role === 'user' ? 'User' : 'Anna'}: ${msg.content}`)
            .join('\n\n');
          
          // Use existing session or create new one only if none exists
          let currentInterview = null;
          
          logger.info('🔍 Session check:', { 
            email: user.email,
            hasCurrentInterviewId: !!user.currentInterviewId,
            currentInterviewId: user.currentInterviewId,
            conversationLength: conversationHistory.length
          });
          
          // Check if user already has a current session ID stored
          if (user.currentInterviewId) {
            try {
              logger.info('📝 Attempting to fetch existing interview:', { interviewId: user.currentInterviewId });
              // Try to get the existing interview by ID
              currentInterview = await apiService.getWellnessInterview(user.email, user.currentInterviewId);
              logger.info('✅ Found existing interview:', { 
                interviewId: currentInterview.id,
                email: user.email
              });
            } catch (error: any) {
              // If interview not found, clear the stored ID
              logger.error('❌ Failed to fetch existing interview:', {
                interviewId: user.currentInterviewId,
                error: error.message,
                status: error.response?.status
              });
              if (error.response?.status === 404) {
                logger.warn('🗑️ Stored interview ID not found, will create new', { interviewId: user.currentInterviewId });
                userService.setUser(userInfo.id.toString(), { currentInterviewId: undefined });
              }
            }
          } else {
            logger.info('🆕 No current interview ID stored, will create new session');
          }
          
          if (!currentInterview) {
            // Create new wellness interview only if no current session exists
            logger.info('🆕 About to CREATE new interview session (POST request):', {
              email: user.email,
              method: 'POST',
              endpoint: '/interviews'
            });
            
            currentInterview = await apiService.createWellnessInterview(user.email, {
              transcription: transcription,
              summary: wellnessSummary,
              wellness_data: wellnessData
            });
            
            logger.info('📝 Storing interview ID for future updates:', {
              userId: userInfo.id.toString(),
              interviewId: currentInterview.id
            });
            
            // Store the interview ID for future updates
            userService.setUser(userInfo.id.toString(), { 
              currentInterviewId: currentInterview.id 
            });
            
            // Verify storage worked
            const updatedUser = userService.getUser(userInfo.id.toString());
            logger.info('✅ Verified stored interview ID:', {
              storedInterviewId: updatedUser?.currentInterviewId,
              matches: updatedUser?.currentInterviewId === currentInterview.id
            });
            
            // Notify user about auto-save (only for first save)
            setTimeout(() => {
              ctx.reply('💾 Interview automatically saved to server! Dialog will now update in real-time.');
            }, 2000);
            
            logger.info('✅ Successfully CREATED new interview session', {
              email: user.email,
              interviewId: currentInterview.id,
              conversationLength: conversationHistory.length
            });
          } else {
            // Update existing interview session
            logger.info('🔄 About to UPDATE existing interview session (PUT request):', {
              email: user.email,
              interviewId: currentInterview.id,
              method: 'PUT',
              endpoint: `/interviews/${currentInterview.id}`
            });
            
            await apiService.updateWellnessInterview(user.email, currentInterview.id, {
              transcription: transcription,
              summary: wellnessSummary,
              wellness_data: wellnessData
            });
            
            // Silent update for real-time display
            logger.info('✅ Successfully UPDATED existing interview session', {
              email: user.email,
              interviewId: currentInterview.id,
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
          
          // Complete registration and start wellness data collection
          const { wellnessStageService } = await import('../services/wellnessStageService');
          
          // Check if wellness service is available
          if (!wellnessStageService.isAvailable()) {
            // Fallback - complete registration without wellness collection
            userService.setUser(userInfo.id.toString(), {
              email: text,
              isAuthenticated: true,
              registrationStep: undefined,
              conversationActive: true,
              conversationHistory: []
            });

            await ctx.reply(
              `Perfect! Now we know each other 🎉\n\n` +
              'Tell me, how are you doing? What\'s bothering you or what interests you?'
            );
            return;
          }

          // Initialize wellness data collection process
          const wellnessProgress = wellnessStageService.initializeWellnessProcess();
          
          userService.setUser(userInfo.id.toString(), {
            email: text,
            isAuthenticated: true,
            registrationStep: undefined,
            wellnessProgress,
            conversationActive: false // Disable normal conversation during wellness collection
          });

          try {
            // Generate first wellness question using ChatGPT
            const firstQuestion = await wellnessStageService.generateQuestion(
              wellnessProgress.currentStage, 
              [] // No previous context for first question
            );
            
            await ctx.reply(
              `Perfect! Now we know each other 🎉\n\n` +
              `I'd like to learn more about you to provide better wellness advice. This will take just a few minutes.\n\n` +
              `**Stage 1/5: Demographics & Baseline**\n\n${firstQuestion}`
            );
          } catch (wellnessError) {
            logger.error('Failed to start wellness collection:', wellnessError);
            
            // Fallback to normal conversation if wellness system fails
            userService.setUser(userInfo.id.toString(), {
              email: text,
              isAuthenticated: true,
              registrationStep: undefined,
              conversationActive: true,
              conversationHistory: []
            });

            await ctx.reply(
              `Perfect! Now we know each other 🎉\n\n` +
              `I'd like to learn more about you, but our wellness assessment system is temporarily unavailable.\n\n` +
              `Feel free to tell me about yourself - your health goals, lifestyle, or any questions you have!`
            );
          }
          break;
      }

    } catch (error) {
      handleError(ctx, error, 'Something went wrong with registration 😅');
    }
  }



  /**
   * Обрабатывает ввод пользователя в рамках wellness формы по этапам
   */
  static async handleWellnessStageInput(ctx: Context, text: string): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());

      if (!user?.wellnessProgress) {
        await ctx.reply('❌ Ошибка состояния формы. Используйте /wellness_form чтобы начать.');
        return;
      }

      const { wellnessStageService } = await import('../services/wellnessStageService');

      // Показываем что бот обрабатывает ответ
      await ctx.sendChatAction('typing');

      // Обрабатываем ответ пользователя через ChatGPT
      let result;
      try {
        result = await wellnessStageService.processUserResponse(text, user.wellnessProgress);
      } catch (error) {
        logger.error('Wellness stage processing error:', error);
        
        if (error instanceof Error && error.message.includes('OpenAI API key')) {
          await ctx.reply(
            '❌ Система поэтапного заполнения недоступна (нет доступа к ChatGPT).\n\n' +
            'Используйте обычное общение - просто расскажите о себе.'
          );
          
          // Переключаемся обратно на обычный разговор
          userService.setUser(userInfo.id.toString(), { 
            wellnessProgress: undefined,
            conversationActive: true 
          });
          return;
        }
        
        await ctx.reply(
          '❌ Произошла ошибка при обработке ответа. Попробуйте еще раз или используйте /wellness_restart для перезапуска формы.'
        );
        return;
      }
      
      // Обновляем данные пользователя
      userService.setUser(userInfo.id.toString(), { 
        wellnessProgress: result.updatedProgress 
      });

      // Отправляем ответ бота
      await ctx.reply(result.botResponse);

      // Если форма завершена, возвращаемся к обычному разговору
      if (result.updatedProgress.currentStage === 'completed') {
        const finalData = wellnessStageService.getFinalWellnessData(result.updatedProgress);
        
        // Сохраняем финальные данные
        userService.setUser(userInfo.id.toString(), { 
          extractedUserInfo: finalData,
          conversationActive: true // Возвращаем обычный разговор
        });

        setTimeout(async () => {
          await ctx.reply(
            '🎉 Отлично! Теперь у меня есть вся необходимая информация для персональных рекомендаций.\n\n' +
            'Можете продолжить обычное общение или использовать /save_interview для сохранения данных на сервер.'
          );
        }, 1000);
      }

      logUserAction(ctx, 'wellness_stage_input', { 
        stage: user.wellnessProgress.currentStage,
        extractionMethod: result.extractionResult.extractionMethod,
        confidence: result.extractionResult.confidence
      });

    } catch (error) {
      handleError(ctx, error, 'Ошибка при обработке ответа формы');
    }
  }
}
