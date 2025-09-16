import { Context, Markup } from 'telegraf';
import { apiService } from '../services/apiService';
import { userService } from '../services/userService';
import { openaiService } from '../services/openaiService';
import { getUserInfo, handleError, logUserAction, escapeMarkdown } from '../utils/helpers';
import { WellnessInterview, ConversationMessage } from '../types';
import { logger } from '../utils/logger';

export class WellnessHandler {
  // Check if user has completed wellness interview
  static async checkWellnessInterview(ctx: Context): Promise<boolean> {
    try {
      const userInfo = getUserInfo(ctx);
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token) {
        return false;
      }

      const interviews = await apiService.getWellnessInterviews(token);
      const completedInterview = interviews.find(interview => interview.status === 'completed');

      return !!completedInterview;

    } catch (error) {
      logger.error('Error checking wellness interview', error);
      return false;
    }
  }

  // Start wellness interview process
  static async startWellnessInterview(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token) {
        await ctx.reply('❌ Вы не авторизованы. Используйте /login для входа.');
        return;
      }

      if (!openaiService.isAvailable()) {
        await ctx.reply('❌ Wellness-коучинг временно недоступен. Обратитесь к администратору.');
        return;
      }

      logUserAction(ctx, 'start_wellness_interview');

      // Check if user already has an interview
      const interviews = await apiService.getWellnessInterviews(token);
      let currentInterview = interviews.find(interview => 
        interview.status === 'in_progress' || interview.status === 'pending'
      );

      if (!currentInterview) {
        // Create new wellness interview
        currentInterview = await apiService.createWellnessInterview(token, {
          status: 'in_progress',
          conversation_history: []
        });
      }

      // Set user state for wellness interview
      userService.setUser(userInfo.id.toString(), {
        wellnessInterviewId: currentInterview.id,
        wellnessInterviewActive: true
      });

      await ctx.reply(
        '🌿 *Добро пожаловать на wellness-интервью!*\n\n' +
        'Я подключу вас к нашему профессиональному wellness-коучу, который поможет ' +
        'собрать информацию о вашем здоровье и образе жизни.\n\n' +
        '⏳ Подключаюсь к коучу...',
        { parse_mode: 'Markdown' }
      );

      // Start conversation with wellness coach
      await this.continueWellnessConversation(ctx, 'Привет! Готов начать интервью.');

    } catch (error) {
      handleError(ctx, error, 'Ошибка при запуске wellness-интервью');
    }
  }

  // Continue wellness conversation
  static async continueWellnessConversation(ctx: Context, userMessage: string): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const token = userService.getApiToken(userInfo.id.toString());
      const user = userService.getUser(userInfo.id.toString());

      if (!token || !user?.wellnessInterviewId) {
        await ctx.reply('❌ Ошибка состояния wellness-интервью. Начните заново с команды /wellness');
        return;
      }

      await ctx.reply('⏳ Коуч обдумывает ответ...');

      // Get current interview
      const interview = await apiService.getWellnessInterview(token, user.wellnessInterviewId);
      
      // Add user message to conversation history
      const userMsg: ConversationMessage = {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      };

      const conversationHistory = interview.conversation_history || [];
      conversationHistory.push(userMsg);

      // Generate response from wellness coach
      const coachResponse = await openaiService.generateResponse(conversationHistory);

      // Add coach response to conversation history
      const coachMsg: ConversationMessage = {
        role: 'assistant',
        content: coachResponse,
        timestamp: new Date().toISOString()
      };

      conversationHistory.push(coachMsg);

      // Extract statistics from conversation
      const statistics = openaiService.extractStatistics(conversationHistory);

      // Update interview with new conversation and statistics
      await apiService.updateWellnessInterview(token, user.wellnessInterviewId, {
        conversation_history: conversationHistory,
        statistics: statistics,
        age: statistics.age,
        location: statistics.location,
        contraindications: statistics.contraindications
      });

      // Send coach response to user
      await ctx.reply(
        `🌿 *Wellness-коуч:*\n\n${escapeMarkdown(coachResponse)}`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Завершить интервью', 'complete_wellness')],
            [Markup.button.callback('📊 Моя статистика', 'wellness_stats')]
          ])
        }
      );

      logUserAction(ctx, 'wellness_conversation_turn', {
        interviewId: user.wellnessInterviewId,
        messageLength: userMessage.length,
        responseLength: coachResponse.length
      });

    } catch (error) {
      handleError(ctx, error, 'Ошибка в wellness-разговоре');
    }
  }

  // Complete wellness interview
  static async completeWellnessInterview(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const token = userService.getApiToken(userInfo.id.toString());
      const user = userService.getUser(userInfo.id.toString());

      if (!token || !user?.wellnessInterviewId) {
        await ctx.reply('❌ Ошибка состояния wellness-интервью.');
        return;
      }

      // Update interview status to completed
      const completedInterview = await apiService.updateWellnessInterview(token, user.wellnessInterviewId, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });

      // Clear user wellness interview state
      userService.setUser(userInfo.id.toString(), {
        wellnessInterviewId: undefined,
        wellnessInterviewActive: false
      });

      logUserAction(ctx, 'wellness_interview_completed', {
        interviewId: user.wellnessInterviewId,
        conversationLength: completedInterview.conversation_history?.length || 0
      });

      await ctx.reply(
        '✅ *Wellness-интервью завершено!*\n\n' +
        'Спасибо за участие в интервью. Ваши данные сохранены и будут использованы ' +
        'для персонализации wellness-рекомендаций.\n\n' +
        'Вы можете посмотреть собранную статистику или начать новое интервью в любое время.',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📊 Посмотреть статистику', 'wellness_stats')],
            [Markup.button.callback('🏠 Главное меню', 'main_menu')]
          ])
        }
      );

    } catch (error) {
      handleError(ctx, error, 'Ошибка при завершении wellness-интервью');
    }
  }

  // Show wellness statistics
  static async showWellnessStatistics(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token) {
        await ctx.reply('❌ Вы не авторизованы. Используйте /login для входа.');
        return;
      }

      const interviews = await apiService.getWellnessInterviews(token);
      const completedInterview = interviews.find(interview => interview.status === 'completed');

      if (!completedInterview || !completedInterview.statistics) {
        await ctx.reply(
          '📊 У вас пока нет завершенного wellness-интервью.\n\n' +
          'Пройдите интервью, чтобы получить персональную статистику.',
          Markup.inlineKeyboard([
            [Markup.button.callback('🌿 Начать интервью', 'start_wellness')]
          ])
        );
        return;
      }

      const stats = completedInterview.statistics;
      let message = '📊 *Ваша wellness-статистика:*\n\n';

      if (stats.age) {
        message += `👤 Возраст: ${stats.age} лет\n`;
      }

      if (stats.location) {
        message += `📍 Местоположение: ${escapeMarkdown(stats.location)}\n`;
      }

      if (stats.contraindications && stats.contraindications.length > 0) {
        message += `\n⚠️ *Противопоказания:*\n`;
        stats.contraindications.slice(0, 3).forEach((item, index) => {
          message += `${index + 1}. ${escapeMarkdown(item)}\n`;
        });
        if (stats.contraindications.length > 3) {
          message += `... и еще ${stats.contraindications.length - 3}\n`;
        }
      }

      if (stats.health_goals && stats.health_goals.length > 0) {
        message += `\n🎯 *Цели здоровья:*\n`;
        stats.health_goals.slice(0, 3).forEach((goal, index) => {
          message += `${index + 1}. ${escapeMarkdown(goal)}\n`;
        });
        if (stats.health_goals.length > 3) {
          message += `... и еще ${stats.health_goals.length - 3}\n`;
        }
      }

      if (stats.lifestyle_factors && stats.lifestyle_factors.length > 0) {
        message += `\n🏃‍♂️ *Факторы образа жизни:*\n`;
        stats.lifestyle_factors.slice(0, 3).forEach((factor, index) => {
          message += `${index + 1}. ${escapeMarkdown(factor)}\n`;
        });
        if (stats.lifestyle_factors.length > 3) {
          message += `... и еще ${stats.lifestyle_factors.length - 3}\n`;
        }
      }

      message += `\n📅 Интервью завершено: ${new Date(completedInterview.completed_at!).toLocaleDateString('ru-RU')}`;

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Пройти заново', 'restart_wellness')],
          [Markup.button.callback('🏠 Главное меню', 'main_menu')]
        ])
      });

    } catch (error) {
      handleError(ctx, error, 'Ошибка при загрузке wellness-статистики');
    }
  }

  // Restart wellness interview
  static async restartWellnessInterview(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token) {
        await ctx.reply('❌ Вы не авторизованы. Используйте /login для входа.');
        return;
      }

      await ctx.reply(
        '🔄 *Перезапуск wellness-интервью*\n\n' +
        'Вы уверены, что хотите начать новое интервью? ' +
        'Предыдущие данные будут сохранены, но будет создано новое интервью.',
        Markup.inlineKeyboard([
          [Markup.button.callback('✅ Да, начать заново', 'confirm_restart_wellness')],
          [Markup.button.callback('❌ Отмена', 'cancel_restart_wellness')]
        ])
      );

    } catch (error) {
      handleError(ctx, error, 'Ошибка при перезапуске wellness-интервью');
    }
  }

  // Handle text messages during wellness interview
  static async handleWellnessMessage(ctx: Context, message: string): Promise<void> {
    const userInfo = getUserInfo(ctx);
    const user = userService.getUser(userInfo.id.toString());

    if (user?.wellnessInterviewActive) {
      await this.continueWellnessConversation(ctx, message);
    }
  }
}
