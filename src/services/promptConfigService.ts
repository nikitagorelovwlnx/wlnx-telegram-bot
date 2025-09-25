/**
 * Service for loading prompt configurations from server
 */

import { config } from '../config';
import { logger } from '../utils/logger';
import { WellnessStage } from '../types';

export interface StagePrompts {
  question_prompt: string;  // Промпт для генерации вопросов на этом этапе
  extraction_prompt: string; // Промпт для извлечения данных из ответа пользователя
}

export interface PromptsResponse {
  success: boolean;
  data: {
    demographics_baseline: StagePrompts;
    biometrics_habits: StagePrompts;
    lifestyle_context: StagePrompts;
    medical_history: StagePrompts;
    goals_preferences: StagePrompts;
  };
}

export interface FormSchemaResponse {
  success: boolean;
  data: {
    schema: any; // Wellness form schema
    version?: string;
    description?: string;
  };
  lastUpdated?: string;
}

export interface ConversationPromptsResponse {
  success: boolean;
  data: {
    conversationSystemPrompt: string;
    conversationPersonaPrompt: string;
    firstMessageContext: string;
    wellnessSummarySystemPrompt: string;
  };
  version?: string;
  lastUpdated?: string;
}

class PromptConfigService {
  private cache: Map<string, any> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastFetchTime: number = 0;
  private lastSchemaFetchTime: number = 0;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  /**
   * Retry helper with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>, 
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.maxRetries) {
          logger.error(`${operationName} failed after ${this.maxRetries} attempts:`, lastError);
          throw lastError;
        }
        
        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        logger.warn(`${operationName} attempt ${attempt} failed, retrying in ${delay}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Load prompt configuration from server with retry logic
   */
  async loadPromptConfig(): Promise<PromptsResponse | null> {
    try {
      // Check cache first
      const now = Date.now();
      if (now - this.lastFetchTime < this.cacheExpiry) {
        const cached = this.cache.get('wellness_prompts');
        if (cached) {
          logger.info('Using cached prompt configuration');
          return cached;
        }
      }

      logger.info('Fetching prompt configuration from server...');
      
      const data = await this.retryWithBackoff(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        let response: Response;
        try {
          response = await fetch(`${config.apiBaseUrl}/api/prompts`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'WLNX-Telegram-Bot/1.0'
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as PromptsResponse;
        
        if (!data.success || !data.data) {
          throw new Error('Invalid prompts response format from server');
        }
        
        // Validate all required stages are present
        const requiredStages: WellnessStage[] = [
          'demographics_baseline',
          'biometrics_habits', 
          'lifestyle_context',
          'medical_history',
          'goals_preferences'
        ];
        
        for (const stage of requiredStages) {
          const stageData = (data.data as any)[stage];
          if (!stageData || !stageData.question_prompt || !stageData.extraction_prompt) {
            throw new Error(`Missing or invalid prompts for stage: ${stage}`);
          }
        }
        
        return data;
      }, 'Load prompts from server');
      
      // Cache the result
      this.cache.set('wellness_prompts', data);
      this.lastFetchTime = now;

      logger.info(`Loaded wellness prompts from server with ${Object.keys(data.data).length} stages`);
      return data;

    } catch (error) {
      logger.error('Failed to load prompt configuration from server:', error);
      return null;
    }
  }

  /**
   * Load form schema from server
   */
  async loadFormSchema(): Promise<FormSchemaResponse | null> {
    try {
      // Check cache first
      const now = Date.now();
      if (now - this.lastSchemaFetchTime < this.cacheExpiry) {
        const cached = this.cache.get('form_schema');
        if (cached) {
          logger.info('Using cached form schema');
          return cached;
        }
      }

      logger.info('Fetching form schema from server...');
      
      const response = await fetch(`${config.apiBaseUrl}/api/form-schemas`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WLNX-Telegram-Bot/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as FormSchemaResponse;
      
      if (!data.success || !data.data || !data.data.schema) {
        throw new Error('Invalid form schema response format from server');
      }

      // Cache the result
      this.cache.set('form_schema', data);
      this.lastSchemaFetchTime = now;

      logger.info(`Loaded form schema from server (version: ${data.data.version || 'unknown'})`);
      return data;

    } catch (error) {
      logger.error('Failed to load form schema from server:', error);
      return null;
    }
  }

  /**
   * Get wellness form schema from server
   */
  async getFormSchema(): Promise<any> {
    const schemaResponse = await this.loadFormSchema();
    if (schemaResponse?.data.schema) {
      return schemaResponse.data.schema;
    }

    // Fallback to default schema structure
    logger.warn('Using fallback form schema');
    return {
      stages: [
        'demographics_baseline',
        'biometrics_habits', 
        'lifestyle_context',
        'medical_history',
        'goals_preferences'
      ],
      fields: {
        demographics_baseline: ['age', 'gender', 'weight', 'height', 'location'],
        biometrics_habits: ['sleep_duration', 'daily_steps', 'stress_level'],
        lifestyle_context: ['work_schedule', 'workload'],
        medical_history: ['chronic_conditions', 'medications'],
        goals_preferences: ['health_goals', 'activity_preferences']
      }
    };
  }

  /**
   * Load conversation prompts from server  
   */
  async loadConversationPrompts(): Promise<ConversationPromptsResponse | null> {
    try {
      // Check cache first
      const now = Date.now();
      if (now - this.lastFetchTime < this.cacheExpiry) {
        const cached = this.cache.get('conversation_prompts');
        if (cached) {
          logger.info('Using cached conversation prompts');
          return cached;
        }
      }

      logger.info('Fetching conversation prompts from server...');
      
      const response = await fetch(`${config.apiBaseUrl}/api/conversation-prompts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WLNX-Telegram-Bot/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as ConversationPromptsResponse;
      
      if (!data.success || !data.data) {
        throw new Error('Invalid conversation prompts response format from server');
      }

      // Cache the result
      this.cache.set('conversation_prompts', data);
      this.lastFetchTime = now;

      logger.info(`Loaded conversation prompts from server (version: ${data.version || 'unknown'})`);
      return data;

    } catch (error) {
      logger.error('Failed to load conversation prompts from server:', error);
      return null;
    }
  }

  /**
   * Get conversation system prompt
   */
  async getConversationSystemPrompt(): Promise<string> {
    const prompts = await this.loadConversationPrompts();
    return prompts?.data.conversationSystemPrompt || 
      `You are Anna, a professional wellness consultant. Provide personalized health and wellness advice.`;
  }

  /**
   * Get conversation persona prompt  
   */
  async getConversationPersonaPrompt(): Promise<string> {
    const prompts = await this.loadConversationPrompts();
    return prompts?.data.conversationPersonaPrompt ||
      `You are Anna, a warm and empathetic wellness consultant.`;
  }

  /**
   * Get first message context
   */
  async getFirstMessageContext(): Promise<string> {
    const prompts = await this.loadConversationPrompts();
    return prompts?.data.firstMessageContext ||
      `This is the beginning of your conversation with a new user.`;
  }

  /**
   * Get wellness summary system prompt
   */
  async getWellnessSummarySystemPrompt(): Promise<string> {
    const prompts = await this.loadConversationPrompts();
    return prompts?.data.wellnessSummarySystemPrompt ||
      `You are a wellness data analyst. Generate a comprehensive wellness summary.`;
  }

  /**
   * Get system prompt for wellness extraction (not available in new API format)
   */
  async getSystemPrompt(): Promise<string> {
    // New API format doesn't have systemPrompt, use fallback
    logger.warn('Using fallback system prompt - not available in new API format');
    return this.getFallbackSystemPrompt();
  }

  /**
   * Get extraction prompt for stage (for ChatGPT data extraction)
   */
  async getExtractionPrompt(stage: WellnessStage): Promise<string> {
    if (stage === 'completed') {
      throw new Error(`Stage 'completed' does not have prompts`);
    }
    
    const config = await this.loadPromptConfig();
    if (config?.data && config.data[stage as keyof typeof config.data]) {
      return config.data[stage as keyof typeof config.data].extraction_prompt;
    }

    throw new Error(`No extraction prompt found for stage: ${stage}`);
  }

  /**
   * Get question prompt for stage (for generating questions)
   */
  async getQuestionPrompt(stage: WellnessStage): Promise<string> {
    if (stage === 'completed') {
      throw new Error(`Stage 'completed' does not have prompts`);
    }
    
    const config = await this.loadPromptConfig();
    if (config?.data && config.data[stage as keyof typeof config.data]) {
      return config.data[stage as keyof typeof config.data].question_prompt;
    }

    throw new Error(`No question prompt found for stage: ${stage}`);
  }

  /**
   * Get stage introduction message (not available in new API format)
   */
  async getStageIntroduction(stage: WellnessStage): Promise<string> {
    // New API format doesn't have introductionMessage, use fallback
    logger.warn(`Using fallback introduction for stage: ${stage} - not available in new API format`);
    return this.getFallbackIntroduction(stage);
  }

  /**
   * Get required fields for stage completion (not available in new API format)
   */
  async getRequiredFields(stage: WellnessStage): Promise<string[]> {
    // New API format doesn't have requiredFields, use fallback
    logger.warn(`Using fallback required fields for stage: ${stage} - not available in new API format`);
    return this.getFallbackRequiredFields(stage);
  }

  /**
   * Clear cache (for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear();
    this.lastFetchTime = 0;
    this.lastSchemaFetchTime = 0;
    logger.info('Prompt configuration and form schema cache cleared');
  }

  // Fallback methods (use local prompts if server unavailable)
  
  private getFallbackSystemPrompt(): string {
    return `You are a wellness data analyst. Analyze conversation transcripts and user responses to extract structured health and wellness data.

TASK:
- Extract specific data from user response
- Return result in exact JSON format  
- Be conservative: if unsure about data - don't add it
- Distinguish explicit data from assumptions

RULES:
1. Extract only data that user EXPLICITLY mentioned
2. Don't invent or assume data
3. Convert units to metric system (kg, cm, hours)
4. For array lists - add only clearly named elements
5. Return confidence from 0 to 100 based on data clarity

RESPONSE FORMAT ALWAYS:
{
  "extractedData": { /* only WellnessData fields */ },
  "confidence": 85,
  "reasoning": "Explanation of what was extracted and from where",
  "suggestedNextQuestion": "Logical next question",
  "stageComplete": false
}`;
  }

  private getFallbackStagePrompt(stage: WellnessStage): string {
    const prompts: Record<WellnessStage, string> = {
      'demographics_baseline': `STAGE 1: DEMOGRAPHICS AND BASELINE DATA

Extract from user response the following fields:
- age (number): age in years
- gender (string): "male", "female", "non-binary"  
- weight (number): weight in kilograms
- height (number): height in centimeters
- location (string): location/city
- timezone (string): timezone

Stage complete if has age, gender, and (weight OR height).`,

      'biometrics_habits': `STAGE 2: BIOMETRICS AND HABITS

Extract from user response:
- sleep_duration (number): hours of sleep per night  
- daily_steps (number): steps per day
- resting_heart_rate (number): resting heart rate (bpm)
- stress_level (string): "low", "moderate", "high"
- nutrition_habits (array): eating habits
- caffeine_intake (string): caffeine consumption

Stage complete if has sleep_duration and 2 other fields.`,

      'lifestyle_context': `STAGE 3: LIFESTYLE CONTEXT

Extract from user response:
- work_schedule (string): work schedule/type
- workload (string): work load
- business_travel (boolean): business travel
- night_shifts (boolean): night shifts
- family_obligations (array): family obligations
- recovery_resources (array): recovery resources

Stage complete if has work_schedule and 2 other fields.`,

      'medical_history': `STAGE 4: MEDICAL HISTORY

Extract from user response:
- chronic_conditions (array): chronic conditions
- injuries (array): injuries
- medications (array): medications
- supplements (array): supplements/vitamins
- contraindications (array): contraindications

IMPORTANT: Be especially careful with medical data.
Stage complete if user provided medical info OR explicitly said no problems.`,

      'goals_preferences': `STAGE 5: GOALS AND PREFERENCES

Extract from user response:
- health_goals (array): health goals
- motivation_level (string): motivation level
- morning_evening_type (string): "morning", "evening", "flexible"
- activity_preferences (array): activity preferences
- coaching_style_preference (string): coaching style
- interests (array): interests

Stage complete if has health_goals and activity_preferences.`,

      'completed': '' // Not used but required for type completeness
    };

    return prompts[stage] || '';
  }

  private getFallbackIntroduction(stage: WellnessStage): string {
    const intros: Record<WellnessStage, string> = {
      'demographics_baseline': 'Let\'s get to know each other! 😊 Tell me about yourself - age, location, basic physical info (height, weight). This helps me understand you better.',
      'biometrics_habits': 'Great! Now let\'s talk about your daily habits 📊 How much do you sleep? Physical activity, steps? Nutrition and general well-being?',
      'lifestyle_context': 'Perfect! Now about your lifestyle 🏢 Tell me about work, schedule, family matters. What affects your day and how do you recover?',
      'medical_history': 'Important topic - health 🏥 Any health issues, injuries, medications or limitations? If everything\'s fine - just say no problems.',
      'goals_preferences': 'Final step - your goals! 🎯 What do you want to achieve? What activities do you like? Morning or evening person? What approach works for you?',
      'completed': 'All done! 🎉'
    };

    return intros[stage] || 'Tell me more about yourself 😊';
  }

  private getFallbackRequiredFields(stage: WellnessStage): string[] {
    const fields: Record<WellnessStage, string[]> = {
      'demographics_baseline': ['age', 'gender'],
      'biometrics_habits': ['sleep_duration'],  
      'lifestyle_context': ['work_schedule'],
      'medical_history': [],
      'goals_preferences': ['health_goals'],
      'completed': []
    };

    return fields[stage] || [];
  }
}

export const promptConfigService = new PromptConfigService();
