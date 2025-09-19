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
        await ctx.reply('❌ You are not authorized. Use /login to sign in.');
        return;
      }

      logUserAction(ctx, 'show_interviews');

      await ctx.reply('⏳ Loading your interviews...');

      const interviews = await apiService.getInterviewResults(token);

      if (interviews.length === 0) {
        await ctx.reply(
          '📝 You don\'t have any interview records yet.\n\n' +
          'Use the /add_interview command to add a new interview.',
          Markup.inlineKeyboard([
            [Markup.button.callback('➕ Add Interview', 'add_interview')]
          ])
        );
        return;
      }

      // Sort interviews by date (newest first)
      interviews.sort((a, b) => new Date(b.interview_date).getTime() - new Date(a.interview_date).getTime());

      let message = `📊 *Your Interviews (${interviews.length})*\n\n`;

      interviews.slice(0, 10).forEach((interview, index) => {
        message += `${index + 1}. ${formatInterviewResult(interview)}\n\n`;
      });

      if (interviews.length > 10) {
        message += `... and ${interviews.length - 10} more interviews`;
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Add Interview', 'add_interview')],
          [Markup.button.callback('📈 Statistics', 'interview_stats')]
        ])
      });

    } catch (error) {
      handleError(ctx, error, 'Error loading interviews');
    }
  }

  // Start adding new interview
  static async startAddInterview(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token) {
        await ctx.reply('❌ You are not authorized. Use /login to sign in.');
        return;
      }

      logUserAction(ctx, 'start_add_interview');

      await ctx.reply(
        '📝 *Adding New Interview*\n\n' +
        'Enter the position title (e.g., "Frontend Developer"):',
        { parse_mode: 'Markdown' }
      );

      // Set user state for adding interview
      userService.setUser(userInfo.id.toString(), { 
        interviewData: { step: 'position' }
      });

    } catch (error) {
      handleError(ctx, error, 'Error starting interview addition');
    }
  }

  // Handle interview data input
  static async handleInterviewInput(ctx: Context, text: string): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token || !user?.interviewData) {
        await ctx.reply('❌ State error. Start adding interview again with /add_interview command');
        return;
      }

      const { step } = user.interviewData;
      const interviewData = user.interviewData;

      switch (step) {
        case 'position':
          interviewData.position = text;
          interviewData.step = 'company';
          userService.setUser(userInfo.id.toString(), { interviewData });
          
          await ctx.reply('🏢 Now enter the company name:');
          break;

        case 'company':
          interviewData.company = text;
          interviewData.step = 'date';
          userService.setUser(userInfo.id.toString(), { interviewData });
          
          await ctx.reply(
            '📅 Enter the interview date in DD.MM.YYYY or DD.MM.YYYY HH:MM format\n' +
            'For example: 15.12.2023 or 15.12.2023 14:30'
          );
          break;

        case 'date':
          const parsedDate = this.parseDate(text);
          if (!parsedDate) {
            await ctx.reply('❌ Invalid date format. Try again (e.g., 15.12.2023 14:30):');
            return;
          }
          
          interviewData.interview_date = parsedDate;
          interviewData.step = 'result';
          userService.setUser(userInfo.id.toString(), { interviewData });
          
          await ctx.reply(
            '📊 Select interview result:',
            Markup.inlineKeyboard([
              [Markup.button.callback('⏳ Pending', 'result_pending')],
              [Markup.button.callback('✅ Passed', 'result_passed')],
              [Markup.button.callback('❌ Failed', 'result_failed')]
            ])
          );
          break;

        case 'notes':
          interviewData.notes = text;
          await this.saveInterview(ctx, interviewData, token);
          break;

        default:
          await ctx.reply('❌ Unknown state. Start over with /add_interview command');
      }

    } catch (error) {
      handleError(ctx, error, 'Error processing interview data');
    }
  }

  // Handle interview result selection
  static async handleResultSelection(ctx: Context, result: 'pending' | 'passed' | 'failed'): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token || !user?.interviewData) {
        await ctx.reply('❌ State error. Start adding interview again.');
        return;
      }

      const interviewData = user.interviewData;
      interviewData.result = result;

      if (result === 'passed' || result === 'failed') {
        interviewData.step = 'score';
        userService.setUser(userInfo.id.toString(), { interviewData });
        
        await ctx.reply(
          '⭐ Enter a score from 1 to 10 (or skip by sending "-"):',
          Markup.inlineKeyboard([
            [Markup.button.callback('Skip', 'skip_score')]
          ])
        );
      } else {
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
      handleError(ctx, error, 'Error selecting result');
    }
  }

  // Handle score input
  static async handleScoreInput(ctx: Context, text: string): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const user = userService.getUser(userInfo.id.toString());
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token || !user?.interviewData) {
        await ctx.reply('❌ State error. Start adding interview again with /add_interview command');
        return;
      }

      const interviewData = user.interviewData;

      if (text !== '-') {
        const score = parseInt(text);
        if (isNaN(score) || score < 1 || score > 10) {
          await ctx.reply('❌ Score must be a number from 1 to 10. Try again:');
          return;
        }
        interviewData.score = score;
      }

      interviewData.step = 'notes';
      userService.setUser(userInfo.id.toString(), { interviewData });

      await ctx.reply(
        '📝 Add interview notes (or skip by sending "-"):',
        Markup.inlineKeyboard([
          [Markup.button.callback('Skip', 'skip_notes')]
        ])
      );

    } catch (error) {
      handleError(ctx, error, 'Error processing score');
    }
  }

  // Save interview to API
  private static async saveInterview(ctx: Context, interviewData: any, token: string): Promise<void> {
    try {
      await ctx.reply('⏳ Saving interview...');

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

    } catch (error) {
      handleError(ctx, error, 'Error saving interview');
    }
  }

  // Show interview statistics
  static async showStatistics(ctx: Context): Promise<void> {
    try {
      const userInfo = getUserInfo(ctx);
      const token = userService.getApiToken(userInfo.id.toString());

      if (!token) {
        await ctx.reply('❌ You are not authenticated. Use /login to access.');
        return;
      }

      const interviews = await apiService.getInterviewResults(token);

      if (interviews.length === 0) {
        await ctx.reply('📊 No data for statistics. Add interviews using /add_interview');
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

      let message = `📈 *Interview Statistics*\n\n`;
      message += `📊 Total interviews: ${total}\n`;
      message += `✅ Passed: ${passed}\n`;
      message += `❌ Failed: ${failed}\n`;
      message += `⏳ Pending: ${pending}\n\n`;
      
      if (passed + failed > 0) {
        message += `🎯 Success rate: ${passRate}%\n`;
      }
      
      if (averageScore) {
        message += `⭐ Average score: ${averageScore.toFixed(1)}/10\n`;
      }
      
      message += `\n🏢 Companies: ${companies.length}\n`;
      message += `💼 Positions: ${positions.length}`;

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      handleError(ctx, error, 'Error loading statistics');
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
