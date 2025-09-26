import dotenv from 'dotenv';
import { BotConfig } from '../types';

dotenv.config();

// Support both BOT_TOKEN and TELEGRAM_BOT_TOKEN for flexibility
const botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const botUsername = process.env.BOT_USERNAME || 'wlnx_prod_bot';
const apiBaseUrl = process.env.API_BASE_URL;

const requiredEnvVars = [
  { name: 'BOT_TOKEN or TELEGRAM_BOT_TOKEN', value: botToken },
  { name: 'API_BASE_URL', value: apiBaseUrl }
];

// Validate required environment variables
for (const envVar of requiredEnvVars) {
  if (!envVar.value) {
    throw new Error(`Missing required environment variable: ${envVar.name}`);
  }
}

export const config: BotConfig = {
  token: botToken!,
  username: botUsername!,
  apiBaseUrl: apiBaseUrl!,
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
