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
  // Note: Wellness interview now handled through natural conversation
  conversationHistory?: ConversationMessage[];
  conversationActive?: boolean;
  currentInterviewId?: string;  // Track current interview session ID for updates
  registrationStep?: 'name' | 'email' | 'password';
  extractedUserInfo?: {
    // Demographics and Baseline
    age?: number;
    gender?: string;
    weight?: number;
    height?: number;
    bmi?: number;
    waist_circumference?: number;
    location?: string;
    timezone?: string;
    
    // Biometrics and Habits
    daily_steps?: number;
    sleep_duration?: number;
    sleep_quality?: string;
    sleep_regularity?: string;
    hrv?: number;
    resting_heart_rate?: number;
    stress_level?: string;
    hydration_level?: string;
    nutrition_habits?: string[];
    caffeine_intake?: string;
    alcohol_intake?: string;
    
    // Lifestyle Context
    work_schedule?: string;
    workload?: string;
    business_travel?: boolean;
    night_shifts?: boolean;
    cognitive_load?: string;
    family_obligations?: string[];
    recovery_resources?: string[];
    
    // Medical History
    chronic_conditions?: string[];
    injuries?: string[];
    contraindications?: string[];
    medications?: string[];
    supplements?: string[];
    
    // Personal Goals and Preferences
    health_goals?: string[];
    motivation_level?: string;
    morning_evening_type?: string;
    activity_preferences?: string[];
    coaching_style_preference?: string;
    lifestyle_factors?: string[];
    interests?: string[];
  };
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

// Structured wellness data extracted from conversation
export interface WellnessData {
  // Demographics and Baseline
  age?: number;
  gender?: string;
  weight?: number;
  height?: number;
  bmi?: number;
  waist_circumference?: number;
  location?: string;
  timezone?: string;
  
  // Biometrics and Habits
  daily_steps?: number;
  sleep_duration?: number;
  sleep_quality?: string;
  sleep_regularity?: string;
  hrv?: number;
  resting_heart_rate?: number;
  stress_level?: string;
  hydration_level?: string;
  nutrition_habits?: string[];
  caffeine_intake?: string;
  alcohol_intake?: string;
  
  // Lifestyle Context
  work_schedule?: string;
  workload?: string;
  business_travel?: boolean;
  night_shifts?: boolean;
  cognitive_load?: string;
  family_obligations?: string[];
  recovery_resources?: string[];
  
  // Medical History
  chronic_conditions?: string[];
  injuries?: string[];
  contraindications?: string[];
  medications?: string[];
  supplements?: string[];
  
  // Personal Goals and Preferences
  health_goals?: string[];
  motivation_level?: string;
  morning_evening_type?: string;
  activity_preferences?: string[];
  coaching_style_preference?: string;
  lifestyle_factors?: string[];
  interests?: string[];
}

export interface WellnessInterview {
  id: string;
  user_id: string;
  transcription: string;
  summary: string;
  wellness_data?: WellnessData;  // New field for structured wellness data
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
