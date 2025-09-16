import { Context, Markup } from 'telegraf';
import { apiService } from '../services/apiService';
import { userService } from '../services/userService';
import { getUserInfo, handleError, logUserAction, formatInterviewResult, escapeMarkdown } from '../utils/helpers';
import { InterviewResult } from '../types';

export class InterviewHandler {
  // Show user's interviews
  static async showInterviews(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token) {
        await ctx.reply('❌ Вы не авторизованы. Используйте /login для входа.');
        return;
      }

      logUserAction(ctx, 'show_interviews');

      await ctx.reply('⏳ Загружаю ваши интервью...');

      const interviews = await apiService.getInterviewResults(token);

      if (interviews.length === 0) {
        await ctx.reply(
          '📝 У вас пока нет записей об интервью.\n\n' +
          'Используйте команду /add_interview для добавления нового интервью.',
          Markup.inlineKeyboard([
            [Markup.button.callback('➕ Добавить интервью', 'add_interview')]
          ])
        );
        return;
      }

      // Sort interviews by date (newest first)
      interviews.sort((a, b) => new Date(b.interview_date).getTime() - new Date(a.interview_date).getTime());

      let message = `📊 *Ваши интервью (${interviews.length})*\n\n`;

      interviews.slice(0, 10).forEach((interview, index) => {
        message += `${index + 1}. ${formatInterviewResult(interview)}\n\n`;
      });

      if (interviews.length > 10) {
        message += `... и еще ${interviews.length - 10} интервью`;
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Добавить интервью', 'add_interview')],
          [Markup.button.callback('📈 Статистика', 'interview_stats')]
        ])
      });

    } catch (error) {
      handleError(ctx, error, 'Ошибка при загрузке интервью');
    }
  }

  // Start adding new interview
  static async startAddInterview(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token) {
        await ctx.reply('❌ Вы не авторизованы. Используйте /login для входа.');
        return;
      }

      logUserAction(ctx, 'start_add_interview');

      await ctx.reply(
        '📝 *Добавление нового интервью*\n\n' +
        'Введите название позиции (например: "Frontend Developer"):',
        { parse_mode: 'Markdown' }
      );

      // Set user state for adding interview
      userService.setUser(userInfo.id.toString(), { 
        interviewData: { step: 'position' }
      });

    } catch (error) {
      handleError(ctx, error, 'Ошибка при начале добавления интервью');
    }
  }

  // Handle interview data input
  static async handleInterviewInput(ctx: Context, text: string): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token || !user?.interviewData) {
        await ctx.reply('❌ Ошибка состояния. Начните добавление интервью заново с команды /add_interview');
        return;
      }

      const { step } = user.interviewData;
      const interviewData = user.interviewData;

      switch (step) {
        case 'position':
          interviewData.position = text;
          interviewData.step = 'company';
          userService.setUser(userInfo.id.toString(), { interviewData });
          
          await ctx.reply('🏢 Теперь введите название компании:');
          break;

        case 'company':
          interviewData.company = text;
          interviewData.step = 'date';
          userService.setUser(userInfo.id.toString(), { interviewData });
          
          await ctx.reply(
            '📅 Введите дату интервью в формате ДД.ММ.ГГГГ или ДД.ММ.ГГГГ ЧЧ:ММ\n' +
            'Например: 15.12.2023 или 15.12.2023 14:30'
          );
          break;

        case 'date':
          const parsedDate = this.parseDate(text);
          if (!parsedDate) {
            await ctx.reply('❌ Неверный формат даты. Попробуйте еще раз (например: 15.12.2023 14:30):');
            return;
          }
          
          interviewData.interview_date = parsedDate;
          interviewData.step = 'result';
          userService.setUser(userInfo.id.toString(), { interviewData });
          
          await ctx.reply(
            '📊 Выберите результат интервью:',
            Markup.inlineKeyboard([
              [Markup.button.callback('⏳ Ожидание', 'result_pending')],
              [Markup.button.callback('✅ Пройдено', 'result_passed')],
              [Markup.button.callback('❌ Не пройдено', 'result_failed')]
            ])
          );
          break;

        case 'notes':
          interviewData.notes = text;
          await this.saveInterview(ctx, interviewData, token);
          break;

        default:
          await ctx.reply('❌ Неизвестное состояние. Начните заново с команды /add_interview');
      }

    } catch (error) {
      handleError(ctx, error, 'Ошибка при обработке данных интервью');
    }
  }

  // Handle interview result selection
  static async handleResultSelection(ctx: Context, result: 'pending' | 'passed' | 'failed'): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token || !user?.interviewData) {
        await ctx.reply('❌ Ошибка состояния. Начните добавление интервью заново.');
        return;
      }

      const interviewData = user.interviewData;
      interviewData.result = result;

      if (result === 'passed' || result === 'failed') {
        interviewData.step = 'score';
        userService.setUser(userInfo.id.toString(), { interviewData });
        
        await ctx.reply(
          '⭐ Введите оценку от 1 до 10 (или пропустите, отправив "-"):',
          Markup.inlineKeyboard([
            [Markup.button.callback('Пропустить', 'skip_score')]
          ])
        );
      } else {
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
      handleError(ctx, error, 'Ошибка при выборе результата');
    }
  }

  // Handle score input
  static async handleScoreInput(ctx: Context, text: string): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token || !user?.interviewData) {
        await ctx.reply('❌ Ошибка состояния. Начните добавление интервью заново.');
        return;
      }

      const interviewData = user.interviewData;

      if (text !== '-') {
        const score = parseInt(text);
        if (isNaN(score) || score < 1 || score > 10) {
          await ctx.reply('❌ Оценка должна быть числом от 1 до 10. Попробуйте еще раз:');
          return;
        }
        interviewData.score = score;
      }

      interviewData.step = 'notes';
      userService.setUser(userInfo.id.toString(), { interviewData });

      await ctx.reply(
        '📝 Добавьте заметки об интервью (или пропустите, отправив "-"):',
        Markup.inlineKeyboard([
          [Markup.button.callback('Пропустить', 'skip_notes')]
        ])
      );

    } catch (error) {
      handleError(ctx, error, 'Ошибка при обработке оценки');
    }
  }

  // Save interview to API
  private static async saveInterview(ctx: Context, interviewData: any, token: string): Promise<void> {
    try {
      await ctx.reply('⏳ Сохраняю интервью...');

      const interview: Omit<InterviewResult, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
        position: interviewData.position,
        company: interviewData.company,
        interview_date: interviewData.interview_date,
        result: interviewData.result,
        notes: interviewData.notes === '-' ? undefined : interviewData.notes,
        score: interviewData.score,
      };

      const savedInterview = await apiService.createInterviewResult(token, interview);

      // Clear interview data
      const userInfo = getUserInfo(ctx);
      userService.setUser(userInfo.id.toString(), { interviewData: undefined });

      logUserAction(ctx, 'interview_saved', { interviewId: savedInterview.id });

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

    } catch (error) {
      handleError(ctx, error, 'Ошибка при сохранении интервью');
    }
  }

  // Show interview statistics
  static async showStatistics(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token) {
        await ctx.reply('❌ Вы не авторизованы. Используйте /login для входа.');
        return;
      }

      const interviews = await apiService.getInterviewResults(token);

      if (interviews.length === 0) {
        await ctx.reply('📊 Нет данных для статистики. Добавьте интервью с помощью /add_interview');
        return;
      }

      const total = interviews.length;
      const passed = interviews.filter(i => i.result === 'passed').length;
      const failed = interviews.filter(i => i.result === 'failed').length;
      const pending = interviews.filter(i => i.result === 'pending').length;

      const passRate = total > 0 ? Math.round((passed / (passed + failed)) * 100) : 0;
      
      const averageScore = interviews
        .filter(i => i.score)
        .reduce((sum, i) => sum + (i.score || 0), 0) / interviews.filter(i => i.score).length;

      const companies = [...new Set(interviews.map(i => i.company))];
      const positions = [...new Set(interviews.map(i => i.position))];

      let message = `📈 *Статистика интервью*\n\n`;
      message += `📊 Всего интервью: ${total}\n`;
      message += `✅ Пройдено: ${passed}\n`;
      message += `❌ Не пройдено: ${failed}\n`;
      message += `⏳ Ожидание: ${pending}\n\n`;
      
      if (passed + failed > 0) {
        message += `🎯 Процент успеха: ${passRate}%\n`;
      }
      
      if (averageScore) {
        message += `⭐ Средняя оценка: ${averageScore.toFixed(1)}/10\n`;
      }
      
      message += `\n🏢 Компаний: ${companies.length}\n`;
      message += `💼 Позиций: ${positions.length}`;

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      handleError(ctx, error, 'Ошибка при загрузке статистики');
    }
  }

  // Parse date from various formats
  private static parseDate(dateStr: string): string | null {
    const formats = [
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // JavaScript months are 0-indexed
        const year = parseInt(match[3]);
        const hour = match[4] ? parseInt(match[4]) : 12;
        const minute = match[5] ? parseInt(match[5]) : 0;

        const date = new Date(year, month, day, hour, minute);
        
        if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
          return date.toISOString();
        }
      }
    }

    return null;
  }
}
