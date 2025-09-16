import { Context } from 'telegraf';
import { config } from '../config';
import { logger } from './logger';

export function isAdmin(userId: number): boolean {
  return config.adminUserIds.includes(userId.toString());
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

export function getUserInfo(ctx: Context): { id: number; username?: string; firstName?: string; lastName?: string } {
  const from = ctx.from;
  if (!from) {
    throw new Error('Unable to get user info from context');
  }

  return {
    id: from.id,
    username: from.username,
    firstName: from.first_name,
    lastName: from.last_name,
  };
}

export function logUserAction(ctx: Context, action: string, details?: any): void {
  const userInfo = getUserInfo(ctx);
  logger.info(`User action: ${action}`, {
    userId: userInfo.id,
    username: userInfo.username,
    action,
    details,
  });
}

export function handleError(ctx: Context, error: any, userMessage: string = 'Something went wrong. Please try again later.'): void {
  const userInfo = getUserInfo(ctx);
  logger.error('Bot error', {
    userId: userInfo.id,
    username: userInfo.username,
    error: error.message || error,
    stack: error.stack,
  });

  ctx.reply(userMessage).catch((replyError) => {
    logger.error('Failed to send error message', { replyError });
  });
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters long' };
  }
  
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return { 
      valid: false, 
      message: 'Password must include at least one lowercase letter, one uppercase letter, and one number' 
    };
  }
  
  return { valid: true };
}

export function formatInterviewResult(result: any): string {
  const statusEmoji = {
    pending: '⏳',
    passed: '✅',
    failed: '❌',
  };

  const status = statusEmoji[result.result as keyof typeof statusEmoji] || '❓';
  
  return `${status} *${escapeMarkdown(result.position)}* at *${escapeMarkdown(result.company)}*
📅 Date: ${formatDate(result.interview_date)}
📊 Result: ${result.result === 'pending' ? 'Pending' : result.result === 'passed' ? 'Passed' : 'Failed'}
${result.score ? `⭐ Score: ${result.score}/10` : ''}
${result.notes ? `📝 Notes: ${escapeMarkdown(result.notes)}` : ''}`;
}
