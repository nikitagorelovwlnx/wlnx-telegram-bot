/**
 * Service for managing step-by-step wellness form data collection
 * Uses ChatGPT for data extraction + loads prompts from server
 */

import OpenAI from 'openai';
import { config } from '../config';
import { logger } from '../utils/logger';
import { 
  WellnessStage, 
  WellnessData, 
  WellnessStageProgress,
  StageExtractionResult,
  GPTExtractionRequest,
  GPTExtractionResponse,
  ConversationMessage
} from '../types';
import { promptConfigService } from './promptConfigService';

// Stage progression from server schema (fallback if not provided)
const STAGE_PROGRESSION: Record<WellnessStage, WellnessStage> = {
  'demographics_baseline': 'biometrics_habits',
  'biometrics_habits': 'lifestyle_context',
  'lifestyle_context': 'medical_history',
  'medical_history': 'goals_preferences',
  'goals_preferences': 'completed',
  'completed': 'completed'
};

class WellnessStageService {
  private openai: OpenAI;

  constructor() {
    if (!config.openaiApiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  /**
   * Initialize new wellness form data collection process
   */
  initializeWellnessProcess(): WellnessStageProgress {
    const now = new Date().toISOString();
    
    return {
      currentStage: 'demographics_baseline',
      completedStages: [],
      stageData: {},
      messageHistory: {},
      usedGPTForExtraction: false,
      startedAt: now,
      lastActiveAt: now
    };
  }

  /**
   * Get welcome message for current stage (from server)
   */
  async getStageIntroduction(stage: WellnessStage): Promise<string> {
    return await promptConfigService.getStageIntroduction(stage);
  }

  /**
   * Process user response for current stage
   */
  async processUserResponse(
    userResponse: string,
    progress: WellnessStageProgress
  ): Promise<{
    extractionResult: StageExtractionResult;
    updatedProgress: WellnessStageProgress;
    botResponse: string;
    shouldAdvanceStage: boolean;
  }> {
    const stage = progress.currentStage;
    
    // Add message to stage history
    if (!progress.messageHistory[stage]) {
      progress.messageHistory[stage] = [];
    }
    progress.messageHistory[stage]!.push({
      role: 'user',
      content: userResponse,
      timestamp: new Date().toISOString()
    });

    // Always send each user response to ChatGPT for data extraction

    // Send to ChatGPT for data extraction
    const gptResult = await this.extractDataWithGPT({
      stage,
      userResponse,
      conversationContext: progress.messageHistory[stage] || [],
      previousData: progress.stageData[stage] || {}
    });

    const extractionResult: StageExtractionResult = {
      stage,
      extractedData: gptResult.extractedData,
      extractionMethod: 'gpt_extraction',
      confidence: gptResult.confidence,
      missingFields: [], // No required fields logic needed
      extractionLog: gptResult.reasoning
    };
    
    progress.usedGPTForExtraction = true;

    // Update stage data
    progress.stageData[stage] = {
      ...progress.stageData[stage],
      ...extractionResult.extractedData
    };
    
    progress.lastActiveAt = new Date().toISOString();

    // Check if stage is complete
    const shouldAdvanceStage = await this.isStageComplete(stage, progress.stageData[stage] || {}, progress);
    
    let botResponse: string;
    
    if (shouldAdvanceStage) {
      // Stage completed - move to next
      progress.completedStages.push(stage);
      const nextStage = STAGE_PROGRESSION[stage];
      
      if (nextStage === 'completed') {
        progress.currentStage = 'completed';
        // Generate completion message using ChatGPT with server prompts
        const conversationContext = this.buildConversationContext(progress);
        botResponse = await this.generateCompletionMessage(conversationContext);
      } else {
        progress.currentStage = nextStage;
        
        // Generate dynamic question for next stage with full context
        const conversationContext = this.buildConversationContext(progress);
        botResponse = await this.generateQuestion(nextStage, conversationContext);
      }
    } else {
      // Stage not complete - generate additional question with context
      const conversationContext = this.buildConversationContext(progress);
      botResponse = await this.generateQuestion(stage, conversationContext);
    }

    return {
      extractionResult,
      updatedProgress: progress,
      botResponse,
      shouldAdvanceStage
    };
  }

  /**
   * Build conversation context from wellness form progress
   */
  private buildConversationContext(progress: WellnessStageProgress): ConversationMessage[] {
    const context: ConversationMessage[] = [];
    
    // Collect messages from all stages in chronological order
    for (const stage of progress.completedStages) {
      const stageMessages = progress.messageHistory[stage] || [];
      context.push(...stageMessages);
    }
    
    // Add messages from current stage
    const currentStageMessages = progress.messageHistory[progress.currentStage] || [];
    context.push(...currentStageMessages);
    
    return context;
  }

  /**
   * Generate completion message when all stages are done
   */
  async generateCompletionMessage(conversationContext: ConversationMessage[]): Promise<string> {
    logger.info('🎯 Generating completion message');

    // Use conversation system prompt for completion message
    const systemPrompt = await promptConfigService.getConversationSystemPrompt();

    const messages = [
      { 
        role: 'system', 
        content: `${systemPrompt}\n\nThe user has completed all wellness form stages. Generate a warm, congratulatory message that thanks them and explains what happens next. Be encouraging and mention that you now have enough information to provide personalized wellness recommendations.`
      },
      // Add all conversation context
      ...conversationContext.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      {
        role: 'user',
        content: 'I have completed all the wellness form stages. What happens next?'
      }
    ];

    try {
      logger.info('🤖 Sending to ChatGPT for completion message generation');
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: messages as any,
        max_tokens: 300,
        temperature: 0.7
      });

      const completionMessage = response.choices[0]?.message?.content || 'Thank you for completing the wellness form!';
      
      logger.info('✅ ChatGPT generated completion message:', {
        messageLength: completionMessage.length,
        messagePreview: completionMessage.substring(0, 100) + '...'
      });

      return completionMessage;
    } catch (error) {
      logger.error('Error generating completion message:', error);
      throw error;
    }
  }

  /**
   * Generate natural question for stage with context
   */
  async generateQuestion(stage: WellnessStage, conversationContext: ConversationMessage[]): Promise<string> {
    logger.info(`🎯 Generating question for stage: ${stage}`);
    logger.info(`📝 About to load question prompt from server for stage: ${stage}`);

    let questionPrompt: string;
    try {
      // Get question prompt from server for question generation
      questionPrompt = await promptConfigService.getQuestionPrompt(stage);
    } catch (serverError) {
      logger.error(`Failed to load question prompt for stage ${stage}:`, serverError);
      throw new Error(
        `Unable to generate question for wellness stage "${stage}". ` +
        `Server configuration unavailable. Please try again later or contact support.`
      );
    }
    
    // Get Anna's persona first, then override with server prompt
    // This way server prompt (Putin) overrides Anna's personality
    const personaPrompt = await promptConfigService.getConversationSystemPrompt();
    
    // Put Anna first, then server prompt to override
    const fullSystemPrompt = `${personaPrompt}\n\n${questionPrompt}`;

    const messages = [
      { 
        role: 'system', 
        content: fullSystemPrompt
      },
      // Add all previous conversation context
      ...conversationContext.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      {
        role: 'user',
        content: 'Generate next natural question for this wellness stage based on our conversation context.'
      }
    ];
    ];

    try {
      logger.info('🤖 Sending to ChatGPT for question generation:', {
        stage,
        systemPromptLength: fullSystemPrompt.length,
        conversationContextLength: conversationContext.length,
        messagesCount: messages.length,
        fullSystemPrompt: fullSystemPrompt // DEBUG: show full prompt
      });

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: messages as any,
        max_tokens: 300,
        temperature: 0.7
      });

      const generatedQuestion = response.choices[0]?.message?.content || 'Tell me more about yourself.';
      
      logger.info('✅ ChatGPT generated question:', {
        stage,
        questionLength: generatedQuestion.length,
        questionPreview: generatedQuestion.substring(0, 100) + '...'
      });

      return generatedQuestion;
    } catch (error) {
      logger.error('Error generating question:', error);
      throw error;
    }
  }

  /**
   * Extract data using ChatGPT (uses remote prompts)
   */
  private async extractDataWithGPT(request: GPTExtractionRequest): Promise<GPTExtractionResponse> {

    let extractionPrompt: string;
    try {
      // Get extraction prompt from server for data extraction
      extractionPrompt = await promptConfigService.getExtractionPrompt(request.stage);
    } catch (serverError) {
      logger.error(`Failed to load extraction prompt for stage ${request.stage}:`, serverError);
      throw new Error(
        `Unable to process wellness data for stage "${request.stage}". ` +
        `Server configuration unavailable. Please try again later.`
      );
    }
    
    const messages = [
      { 
        role: 'system', 
        content: extractionPrompt
      },
      {
        role: 'user',
        content: `User response: "${request.userResponse}"\n\nExtract data in JSON format according to instructions.`
      }
    ];

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: messages as any,
        max_tokens: 1000,
        temperature: 0.1 // Low temperature for extraction accuracy
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in GPT response');
      }

      const gptResponse: GPTExtractionResponse = JSON.parse(jsonMatch[0]);
      
      // Validate response
      if (!gptResponse.extractedData || typeof gptResponse.confidence !== 'number') {
        throw new Error('Invalid GPT response format');
      }

      logger.info('GPT extraction successful', {
        stage: request.stage,
        extractedFields: Object.keys(gptResponse.extractedData),
        confidence: gptResponse.confidence
      });

      return gptResponse;

    } catch (error) {
      logger.error('GPT extraction error', { error, stage: request.stage });
      throw error;
    }
  }

  /**
   * Check if stage is complete based on collected data
   * LIMITATION: Maximum 2 questions per stage
   */
  private async isStageComplete(stage: WellnessStage, stageData: Partial<WellnessData>, progress: WellnessStageProgress): Promise<boolean> {
    // Count questions in current stage
    const currentStageMessages = progress.messageHistory[stage] || [];
    const userMessagesCount = currentStageMessages.filter(msg => msg.role === 'user').length;
    
    // HARD LIMIT: Maximum 2 questions per stage
    if (userMessagesCount >= 2) {
      logger.info(`🔄 Stage ${stage} completed: reached maximum 2 questions limit`, {
        userMessagesCount,
        stageDataKeys: Object.keys(stageData)
      });
      return true;
    }
    
    // If there's any data after first question, can complete stage
    if (userMessagesCount >= 1 && Object.keys(stageData).length > 0) {
      logger.info(`Stage ${stage} completed: has data after 1 question`, {
        userMessagesCount,
        stageDataKeys: Object.keys(stageData)
      });
      return true;
    }
    
    return false;
  }

  /**
   * Generate follow-up question for incomplete stage
   */
  private async generateFollowUpQuestion(
    stage: WellnessStage, 
    stageData: Partial<WellnessData>,
    extractionResult: StageExtractionResult
  ): Promise<string> {
    const missingFields = extractionResult.missingFields;
    // If there's information - confirm and ask for missing
    const extractedFields = Object.keys(extractionResult.extractedData);
    let response = '';
    
    if (extractedFields.length > 0) {
      response += 'Got it! ';
      // Show what we understood
      extractedFields.forEach(field => {
        const value = (extractionResult.extractedData as any)[field];
        response += this.formatFieldValue(field, value) + ' ';
      });
      response += '\n\n';
    }

    // Ask for missing important fields
    if (missingFields.length > 0) {
      response += this.getMissingFieldQuestion(stage, missingFields[0]);
    } else {
      response += 'Tell me more about this topic, or say "next" to move to the next section.';
    }

    return response;
  }

  /**
   * Форматирует значение поля для отображения пользователю
   */
  private formatFieldValue(field: string, value: any): string {
    switch (field) {
      case 'age': return `Age ${value}.`;
      case 'gender': return value === 'male' ? 'Male.' : value === 'female' ? 'Female.' : `Gender ${value}.`;
      case 'weight': return `Weight ${value} kg.`;
      case 'height': return `Height ${value} cm.`;
      case 'sleep_duration': return `Sleep ${value} hours.`;
      case 'daily_steps': return `${value} steps per day.`;
      default: return `${field}: ${value}.`;
    }
  }

  /**
   * Генерирует вопрос для недостающего поля
   */
  private getMissingFieldQuestion(stage: WellnessStage, missingField: string): string {
    const questionMap: Record<string, string> = {
      // Demographics
      'age': 'How old are you?',
      'gender': 'What is your gender?',
      'weight': 'What is your weight?',
      'height': 'How tall are you?',
      'location': 'What city do you live in?',
      
      // Biometrics  
      'sleep_duration': 'How many hours do you usually sleep?',
      'daily_steps': 'How many steps do you walk per day?',
      'resting_heart_rate': 'What is your resting heart rate?',
      'stress_level': 'How would you rate your stress level?',
      
      // Lifestyle
      'work_schedule': 'Tell me about your work and schedule.',
      
      // Goals
      'health_goals': 'What are your health and fitness goals?',
    };

    return questionMap[missingField] || `Tell me more about ${missingField}.`;
  }


  /**
   * Собирает финальные данные из всех этапов
   */
  getFinalWellnessData(progress: WellnessStageProgress): WellnessData {
    const finalData: WellnessData = {};
    
    logger.info('🔍 Building final wellness data:', {
      stageDataKeys: Object.keys(progress.stageData),
      stageDataValues: progress.stageData,
      currentStage: progress.currentStage
    });
    
    // Combine data from all stages
    Object.values(progress.stageData).forEach(stageData => {
      Object.assign(finalData, stageData);
    });

    // Calculate BMI if weight and height available
    if (finalData.weight && finalData.height) {
      const heightM = finalData.height / 100;
      finalData.bmi = Math.round((finalData.weight / (heightM * heightM)) * 10) / 10;
    }

    logger.info('✅ Final wellness data assembled:', {
      finalDataKeys: Object.keys(finalData),
      finalData: finalData
    });

    return finalData;
  }
}

export const wellnessStageService = new WellnessStageService();
