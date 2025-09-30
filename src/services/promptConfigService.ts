/**
 * Service for loading prompt configurations from server
 */

import { config } from '../config';
import { logger } from '../utils/logger';
import { WellnessStage } from '../types';

export interface StagePrompts {
  question_prompt: string;  // Prompt for generating questions at this stage
  extraction_prompt: string; // Prompt for extracting data from user response
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


class PromptConfigService {
  private cache: Map<string, any> = new Map();
  private cacheExpiry: number = process.env.NODE_ENV === 'development' ? 30 * 1000 : 2 * 60 * 1000; // 30 seconds in dev, 2 minutes in prod
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
   * Clear cache and force reload from server
   */
  clearCache(): void {
    this.cache.clear();
    this.lastFetchTime = 0;
    this.lastSchemaFetchTime = 0;
    logger.info('Prompt cache cleared - next request will fetch fresh data from server');
  }

  /**
   * Validate prompt content to ensure it meets quality standards
   */
  private validatePromptContent(prompt: string): boolean {
    // Check for inappropriate content
    const inappropriatePatterns = [
      /putin/i,
      /russian president/i,
      /russia/i,
      /kremlin/i,
      // Add more patterns as needed
    ];
    
    for (const pattern of inappropriatePatterns) {
      if (pattern.test(prompt)) {
        logger.warn(`Prompt contains inappropriate content: ${pattern}`);
        return false;
      }
    }
    
    // Check minimum length
    if (prompt.length < 50) {
      logger.warn('Prompt too short');
      return false;
    }
    
    return true;
  }

  /**
   * Load prompt configuration from server with retry logic
   */
  async loadPromptConfig(forceRefresh: boolean = false): Promise<PromptsResponse | null> {
    try {
      // Check cache first (unless force refresh requested)
      const now = Date.now();
      if (!forceRefresh && now - this.lastFetchTime < this.cacheExpiry) {
        const cached = this.cache.get('wellness_prompts');
        if (cached) {
          logger.info(`Using cached prompt configuration (expires in ${Math.round((this.cacheExpiry - (now - this.lastFetchTime)) / 1000)}s)`);
          return cached;
        }
      }

      logger.info(`🔄 Fetching prompt configuration from server... ${forceRefresh ? '(forced refresh)' : '(cache expired)'}`);
      
      const data = await this.retryWithBackoff(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        let response: Response;
        try {
          response = await fetch(`${config.apiBaseUrl}/prompts`, {
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
        
        // Validate all required stages are present and content is appropriate
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
          
          // Validate prompt content
          if (!this.validatePromptContent(stageData.question_prompt)) {
            logger.error(`Invalid question prompt content for stage ${stage}, rejecting server prompts`);
            throw new Error(`Server prompts contain inappropriate content for stage: ${stage}`);
          }
          
          if (!this.validatePromptContent(stageData.extraction_prompt)) {
            logger.error(`Invalid extraction prompt content for stage ${stage}, rejecting server prompts`);
            throw new Error(`Server prompts contain inappropriate content for stage: ${stage}`);
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
   * Get wellness form schema from server - ONLY from server
   */
  async getFormSchema(): Promise<any> {
    const schemaResponse = await this.loadFormSchema();
    if (schemaResponse?.data.schema) {
      return schemaResponse.data.schema;
    }

    throw new Error('No form schema found on server');
  }


  /**
   * Get conversation system prompt - hardcoded Anna's character
   */
  async getConversationSystemPrompt(): Promise<string> {
    return `You are Anna, a professional wellness consultant. You are warm, empathetic, and supportive. 
    You help people with nutrition, fitness, and health in general. Always respond in a friendly, caring manner 
    as if you're a real person having a conversation. Keep responses natural and conversational.
    
    You speak naturally and personally, like a caring friend who happens to be a health professional. 
    You remember context from the conversation and build on previous topics. You're encouraging but realistic in your advice.`;
  }

  /**
   * Get first message context - hardcoded
   */
  async getFirstMessageContext(): Promise<string> {
    return `This is the beginning of your conversation with a new user. Be warm and welcoming as Anna.`;
  }

  /**
   * Get wellness summary system prompt - ONLY from server
   */
  async getWellnessSummarySystemPrompt(): Promise<string> {
    // Always force refresh to get latest prompts from server
    const config = await this.loadPromptConfig(true);
    if (config?.data && (config.data as any).wellness_summary?.system_prompt) {
      return (config.data as any).wellness_summary.system_prompt;
    }
    
    throw new Error('No wellness summary system prompt found on server');
  }

  /**
   * Get system prompt for wellness extraction - ONLY from server
   */
  async getSystemPrompt(): Promise<string> {
    // Always force refresh to get latest prompts from server
    const config = await this.loadPromptConfig(true);
    if (config?.data && (config.data as any).system_prompt) {
      return (config.data as any).system_prompt;
    }
    
    throw new Error('No system prompt found on server');
  }

  /**
   * Get extraction prompt for stage (for ChatGPT data extraction)
   * Always fetches fresh data from server to ensure latest prompts
   */
  async getExtractionPrompt(stage: WellnessStage): Promise<string> {
    if (stage === 'completed') {
      throw new Error(`Stage 'completed' does not have prompts`);
    }
    
    // Always force refresh to get latest prompts from server
    logger.info(`🎯 Getting extraction prompt for stage: ${stage}`);
    const config = await this.loadPromptConfig(true);
    if (config?.data && config.data[stage as keyof typeof config.data]) {
      const prompt = config.data[stage as keyof typeof config.data].extraction_prompt;
      logger.info(`✅ Loaded extraction prompt for ${stage}: ${prompt.substring(0, 100)}...`);
      return prompt;
    }

    throw new Error(`No extraction prompt found for stage: ${stage}`);
  }

  /**
   * Get question prompt for stage (for generating questions)
   * Always fetches fresh data from server to ensure latest prompts
   */
  async getQuestionPrompt(stage: WellnessStage): Promise<string> {
    if (stage === 'completed') {
      throw new Error(`Stage 'completed' does not have prompts`);
    }
    
    // Always force refresh to get latest prompts from server
    logger.info(`🎯 Getting question prompt for stage: ${stage}`);
    logger.info(`🔄 About to force refresh prompts from server for stage: ${stage}`);
    const config = await this.loadPromptConfig(true);
    if (config?.data && config.data[stage as keyof typeof config.data]) {
      const prompt = config.data[stage as keyof typeof config.data].question_prompt;
      logger.info(`✅ Loaded question prompt for ${stage}: ${prompt.substring(0, 100)}...`);
      return prompt;
    }

    throw new Error(`No question prompt found for stage: ${stage}`);
  }

  /**
   * Get stage introduction message - ONLY from server
   */
  async getStageIntroduction(stage: WellnessStage): Promise<string> {
    // Always force refresh to get latest prompts from server
    const config = await this.loadPromptConfig(true);
    if (config?.data && config.data[stage as keyof typeof config.data]) {
      const stageData = config.data[stage as keyof typeof config.data] as any;
      if (stageData.introduction_message) {
        return stageData.introduction_message;
      }
    }
    
    throw new Error(`No introduction message found for stage: ${stage}`);
  }



}

export const promptConfigService = new PromptConfigService();
