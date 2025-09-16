import dotenv from 'dotenv';
import { BotConfig } from '../types';

dotenv.config();

const requiredEnvVars = ['BOT_TOKEN', 'BOT_USERNAME', 'API_BASE_URL'];

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const config: BotConfig = {
  token: process.env.BOT_TOKEN!,
  username: process.env.BOT_USERNAME!,
  apiBaseUrl: process.env.API_BASE_URL!,
  apiTimeout: parseInt(process.env.API_TIMEOUT || '10000'),
  jwtSecret: process.env.JWT_SECRET || 'default-secret',
  webhookUrl: process.env.WEBHOOK_URL,
  webhookPort: parseInt(process.env.WEBHOOK_PORT || '8080'),
  adminUserIds: process.env.ADMIN_USER_IDS?.split(',').map(id => id.trim()) || [],
  logLevel: process.env.LOG_LEVEL || 'info',
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4'
};

export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';
