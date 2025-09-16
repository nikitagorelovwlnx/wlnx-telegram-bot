export interface User {
  id: number;
  email: string;
  password?: string;
  name?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface CalendarIntegration {
  id: number;
  user_id: number;
  provider: string;
  access_token: string;
  refresh_token?: string;
  calendar_id?: string;
  settings?: any;
  created_at: string;
  updated_at: string;
}

export interface TelegramIntegration {
  id: number;
  user_id: number;
  telegram_user_id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  settings?: any;
  created_at: string;
  updated_at: string;
}

export interface InterviewResult {
  id: number;
  user_id: number;
  position: string;
  company: string;
  interview_date: string;
  result: 'pending' | 'passed' | 'failed';
  notes?: string;
  score?: number;
  feedback?: string;
  created_at: string;
  updated_at: string;
}

export interface BotUser {
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  apiToken?: string;
  userId?: number;
  isAuthenticated: boolean;
  email?: string;
  interviewData?: {
    step: string;
    position?: string;
    company?: string;
    interview_date?: string;
    result?: 'pending' | 'passed' | 'failed';
    score?: number;
    notes?: string;
  };
  wellnessInterviewId?: number;
  wellnessInterviewActive?: boolean;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

export interface WellnessInterview {
  id: number;
  user_id: number;
  status: 'pending' | 'in_progress' | 'completed';
  age?: number;
  location?: string;
  contraindications?: string[];
  conversation_history?: ConversationMessage[];
  statistics?: {
    age?: number;
    location?: string;
    contraindications?: string[];
    health_goals?: string[];
    lifestyle_factors?: string[];
  };
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface BotConfig {
  token: string;
  username: string;
  apiBaseUrl: string;
  apiTimeout: number;
  jwtSecret: string;
  webhookUrl?: string;
  webhookPort?: number;
  adminUserIds: string[];
  logLevel: string;
  openaiApiKey?: string;
  openaiModel: string;
}
