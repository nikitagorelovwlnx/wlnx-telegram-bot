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
            [Markup.button.callback('🔄 Refresh Prompts', 'admin_refresh_prompts')],
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

  // Reset wellness progress (for testing)
  static async resetWellness(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      
      // Reset wellness progress
      userService.setUser(userInfo.id.toString(), {
        wellnessProgress: undefined,
        conversationHistory: [],
        conversationActive: false
      });

      await ctx.reply('🔄 Wellness progress reset! You can now start the wellness form again.\n\nJust start talking to me and I\'ll guide you through the wellness questions! 😊');

      logUserAction(ctx, 'reset_wellness');

    } catch (error) {
      handleError(ctx, error, 'Error resetting wellness progress');
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
        
        // Get wellness data from user's extracted info (if available)
        const wellnessData = user.extractedUserInfo || {};
        logger.info('Manual save - Using wellness data:', {
          extractedFields: Object.keys(wellnessData).filter(key => {
            const value = (wellnessData as any)[key];
            return value !== undefined && value !== null && value !== '';
          }),
          wellnessData: wellnessData
        });
        
        // Generate comprehensive wellness summary
        const wellnessSummary = await conversationService.generateWellnessSummary(conversationHistory, wellnessData);
        
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

      // conversationService is always available now (no fallbacks)

      // Get conversation history
      let conversationHistory = user?.conversationHistory || [];

      // Add user message to history
      const userMessage = {
        role: 'user' as const,
        content: text,
        timestamp: new Date().toISOString()
      };
      conversationHistory.push(userMessage);

      // Show bot is typing
      await ctx.sendChatAction('typing');

      // Generate AI response
      const response = await conversationService.generateResponse(conversationHistory);

      // Send response immediately
      await ctx.reply(response);

      // Add AI response to history
      const aiMessage = {
        role: 'assistant' as const,
        content: response,
        timestamp: new Date().toISOString()
      };
      conversationHistory.push(aiMessage);

      // Extract user info from conversation (single call)
      // Update user with new conversation history (extraction happens in wellness stages)
      userService.setUser(userInfo.id.toString(), {
        conversationHistory: conversationHistory
      });

      // Auto-save/update transcription after every exchange for real-time client display
      if (user?.email && conversationHistory.length >= 2) { // Start saving from first exchange
        try {
          const { apiService } = await import('../services/apiService');
          
          // Use wellness data from user's extracted info (if available)
          const wellnessData = user?.extractedUserInfo || {};
          logger.info('Using wellness data for auto-save:', {
            extractedFields: Object.keys(wellnessData).filter(key => {
              const value = (wellnessData as any)[key];
              return value !== undefined && value !== null && value !== '';
            }),
            wellnessData: wellnessData
          });
          
          // OPTIMIZATION: generate summary only for long conversations
          let wellnessSummary = 'Ongoing conversation - summary will be generated after more exchanges';
          if (conversationHistory.length >= 10) { // Generate summary only after 10+ messages
            wellnessSummary = await conversationService.generateWellnessSummary(conversationHistory, wellnessData);
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
        hasWellnessData: !!(user?.extractedUserInfo && Object.keys(user.extractedUserInfo).length > 0)
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
          const { apiService } = await import('../services/apiService');
          
          // Initialize wellness data collection process
          const wellnessProgress = wellnessStageService.initializeWellnessProcess();
          
          userService.setUser(userInfo.id.toString(), {
            email: text,
            isAuthenticated: true,
            registrationStep: undefined,
            wellnessProgress,
            conversationActive: false // Disable normal conversation during wellness collection
          });

          // 🆕 CREATE WELLNESS SESSION IMMEDIATELY after registration
          try {
            logger.info('🆕 Creating wellness interview session for user:', { email: text });
            
            const initialTranscription = `[SYSTEM] User registered: ${userInfo.firstName || 'Unknown'} (${text})`;
            
            const newInterview = await apiService.createWellnessInterview(text, {
              transcription: initialTranscription,
              summary: 'Wellness interview session started',
              wellness_data: {}
            });
            
            logger.info('✅ Wellness session created successfully:', { 
              interviewId: newInterview.id,
              email: text 
            });
            
          } catch (sessionError) {
            logger.error('❌ Failed to create wellness session:', sessionError);
            // Continue anyway - session will be created on first save attempt
          }

          // Generate first wellness question using ChatGPT
          logger.info('🚀 About to call generateQuestion for first wellness question', {
            stage: wellnessProgress.currentStage,
            email: text
          });
          const firstQuestion = await wellnessStageService.generateQuestion(
            wellnessProgress.currentStage, 
            [] // No previous context for first question
          );
          logger.info('✅ Generated first wellness question', {
            questionLength: firstQuestion.length,
            questionPreview: firstQuestion.substring(0, 100)
          });
          
          // Send only the generated question from server prompts - no hardcoded text
          await ctx.reply(firstQuestion);
          break;
      }

    } catch (error) {
      handleError(ctx, error, 'Something went wrong with registration 😅');
    }
  }



  /**
   * Handle user input within wellness form stages
   */
  static async handleWellnessStageInput(ctx: Context, text: string): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());

      if (!user?.wellnessProgress) {
        await ctx.reply('❌ Form state error. Please start over.');
        return;
      }

      const { wellnessStageService } = await import('../services/wellnessStageService');

      // Show bot is processing response
      await ctx.sendChatAction('typing');

      // Process user response through ChatGPT
      const result = await wellnessStageService.processUserResponse(text, user.wellnessProgress);
      
      // Update user data
      userService.setUser(userInfo.id.toString(), { 
        wellnessProgress: result.updatedProgress 
      });

      // Send bot response
      await ctx.reply(result.botResponse);

      // 🔄 UPDATE TRANSCRIPTION after each wellness exchange
      if (user?.email) {
        try {
          const { apiService } = await import('../services/apiService');
          
          // Build FULL transcription - reconstruct complete conversation chronologically
          const conversationFlow: Array<{role: string, content: string}> = [];
          
          // 1. Registration flow (reconstruct from user data)
          conversationFlow.push({
            role: 'system',
            content: `User registered: ${userInfo.firstName || 'Unknown'} (${user.email})`
          });
          
          conversationFlow.push({ role: 'user', content: '/start' });
          conversationFlow.push({ 
            role: 'assistant', 
            content: "Hey! 😊 I'm Anna\n\nI'm a wellness consultant, work with people online. I help with nutrition, fitness, health in general\n\nWhat's your name?" 
          });
          
          if (userInfo.firstName) {
            conversationFlow.push({ role: 'user', content: userInfo.firstName });
            conversationFlow.push({ 
              role: 'assistant', 
              content: `Nice to meet you, ${userInfo.firstName}! 😊\n\nNow I need your email for registration:` 
            });
          }
          
          if (user.email) {
            conversationFlow.push({ role: 'user', content: user.email });
            // No hardcoded assistant message - only actual generated responses
          }
          
          // 2. Add wellness stage messages in chronological order
          const currentStageMessages = result.updatedProgress.messageHistory[result.updatedProgress.currentStage] || [];
          conversationFlow.push(...currentStageMessages);
          
          // 3. Add current exchange (user input + bot response)
          conversationFlow.push({
            role: 'user',
            content: text
          });
          
          conversationFlow.push({
            role: 'assistant', 
            content: result.botResponse
          });
          
          // Create full conversation transcript with clear sender markers
          const fullTranscription = conversationFlow
            .map((msg: {role: string, content: string}) => {
              if (msg.role === 'system') return `[SYSTEM] ${msg.content}`;
              if (msg.role === 'user') return `[USER] ${msg.content}`;
              return `[ASSISTANT] ${msg.content}`;
            })
            .join('\n\n');
          
          // Get current wellness data
          const currentWellnessData = wellnessStageService.getFinalWellnessData(result.updatedProgress);
          
          logger.info('🔄 Updating wellness session transcription:', { 
            email: user.email,
            stage: result.updatedProgress.currentStage,
            totalMessages: conversationFlow.length,
            transcriptionLength: fullTranscription.length
          });
          
          // Update existing session
          const interviews = await apiService.getWellnessInterviews(user.email);
          logger.info('📋 Found interviews for update:', { 
            email: user.email, 
            interviewCount: interviews.length,
            interviewIds: interviews.map(i => i.id)
          });
          
          if (interviews.length > 0) {
            logger.info('🔄 Attempting to update interview:', { 
              interviewId: interviews[0].id,
              transcriptionLength: fullTranscription.length,
              wellnessDataKeys: Object.keys(currentWellnessData)
            });
            
            await apiService.updateWellnessInterview(user.email, interviews[0].id, {
              transcription: fullTranscription,
              summary: `Wellness interview in progress - Stage: ${result.updatedProgress.currentStage}`,
              wellness_data: currentWellnessData
            });
            
            logger.info('✅ Wellness session updated successfully');
          } else {
            logger.warn('⚠️ No interviews found to update for email:', user.email);
          }
          
        } catch (updateError) {
          logger.error('❌ Failed to update wellness session:', {
            error: updateError instanceof Error ? updateError.message : String(updateError),
            stack: updateError instanceof Error ? updateError.stack : undefined,
            email: user?.email,
            stage: result.updatedProgress.currentStage
          });
        }
      }

      // If form completed, return to normal conversation
      if (result.updatedProgress.currentStage === 'completed') {
        const finalData = wellnessStageService.getFinalWellnessData(result.updatedProgress);
        
        // Save final data
        userService.setUser(userInfo.id.toString(), { 
          extractedUserInfo: finalData,
          conversationActive: true // Return to normal conversation
        });

        // Completion message is now generated by wellnessStageService using server prompts
        // No hardcoded messages allowed
      }

      logUserAction(ctx, 'wellness_stage_input', { 
        stage: user.wellnessProgress.currentStage,
        extractionMethod: result.extractionResult.extractionMethod,
        confidence: result.extractionResult.confidence
      });

    } catch (error) {
      handleError(ctx, error, 'Error processing form response');
    }
  }
}
