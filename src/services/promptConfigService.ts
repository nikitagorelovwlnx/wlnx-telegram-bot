/**
 * Service for loading prompt configurations from server
 */

import { config } from '../config';
import { logger } from '../utils/logger';
import { WellnessStage } from '../types';

export interface StagePromptConfig {
  stage: WellnessStage;
  systemPrompt: string;
  stagePrompt: string;
  introductionMessage: string;
  requiredFields: string[];
  completionCriteria: string;
}

export interface PromptsResponse {
  success: boolean;
  data: {
    systemPrompt: string;
    stages: StagePromptConfig[];
  };
  version?: string;
  lastUpdated?: string;
}

class PromptConfigService {
  private cache: Map<string, PromptsResponse> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastFetchTime: number = 0;

  /**
   * Load prompt configuration from server
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
      
      const response = await fetch(`${config.apiBaseUrl}/api/prompts/wellness-stages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WLNX-Telegram-Bot/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as PromptsResponse;
      
      if (!data.success || !data.data || !data.data.stages) {
        throw new Error('Invalid response format from server');
      }

      // Validate stages
      const expectedStages: WellnessStage[] = [
        'demographics_baseline',
        'biometrics_habits', 
        'lifestyle_context',
        'medical_history',
        'goals_preferences'
      ];

      const receivedStages = data.data.stages.map(s => s.stage);
      const missingStages = expectedStages.filter(stage => !receivedStages.includes(stage));
      
      if (missingStages.length > 0) {
        throw new Error(`Missing stages in server response: ${missingStages.join(', ')}`);
      }

      // Cache the result
      this.cache.set('wellness_prompts', data);
      this.lastFetchTime = now;

      logger.info(`Loaded ${data.data.stages.length} stage prompts from server (version: ${data.version || 'unknown'})`);
      return data;

    } catch (error) {
      logger.error('Failed to load prompt configuration from server:', error);
      return null;
    }
  }

  /**
   * Get system prompt for wellness extraction
   */
  async getSystemPrompt(): Promise<string> {
    const config = await this.loadPromptConfig();
    if (config?.data.systemPrompt) {
      return config.data.systemPrompt;
    }

    // Fallback to hardcoded system prompt
    logger.warn('Using fallback system prompt');
    return this.getFallbackSystemPrompt();
  }

  /**
   * Get stage-specific prompt
   */
  async getStagePrompt(stage: WellnessStage): Promise<string> {
    const config = await this.loadPromptConfig();
    if (config?.data.stages) {
      const stageConfig = config.data.stages.find(s => s.stage === stage);
      if (stageConfig?.stagePrompt) {
        return stageConfig.stagePrompt;
      }
    }

    // Fallback to hardcoded prompts
    logger.warn(`Using fallback prompt for stage: ${stage}`);
    return this.getFallbackStagePrompt(stage);
  }

  /**
   * Get stage introduction message
   */
  async getStageIntroduction(stage: WellnessStage): Promise<string> {
    const config = await this.loadPromptConfig();
    if (config?.data.stages) {
      const stageConfig = config.data.stages.find(s => s.stage === stage);
      if (stageConfig?.introductionMessage) {
        return stageConfig.introductionMessage;
      }
    }

    // Fallback to hardcoded messages
    logger.warn(`Using fallback introduction for stage: ${stage}`);
    return this.getFallbackIntroduction(stage);
  }

  /**
   * Get required fields for stage completion
   */
  async getRequiredFields(stage: WellnessStage): Promise<string[]> {
    const config = await this.loadPromptConfig();
    if (config?.data.stages) {
      const stageConfig = config.data.stages.find(s => s.stage === stage);
      if (stageConfig?.requiredFields) {
        return stageConfig.requiredFields;
      }
    }

    // Fallback to hardcoded requirements
    return this.getFallbackRequiredFields(stage);
  }

  /**
   * Clear cache (for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear();
    this.lastFetchTime = 0;
    logger.info('Prompt configuration cache cleared');
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
