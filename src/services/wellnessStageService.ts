/**
 * Сервис для управления поэтапным сбором данных wellness формы
 * Использует ChatGPT для извлечения данных + загружает промпты с сервера
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
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey,
      });
    } else {
      logger.warn('OpenAI API key not found. GPT extraction will be unavailable.');
    }
  }

  /**
   * Инициализирует новый процесс сбора данных wellness формы
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
   * Получает приветственное сообщение для текущего этапа (из сервера)
   */
  async getStageIntroduction(stage: WellnessStage): Promise<string> {
    return await promptConfigService.getStageIntroduction(stage);
  }

  /**
   * Обрабатывает ответ пользователя для текущего этапа
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
    
    // Добавляем сообщение в историю этапа
    if (!progress.messageHistory[stage]) {
      progress.messageHistory[stage] = [];
    }
    progress.messageHistory[stage]!.push({
      role: 'user',
      content: userResponse,
      timestamp: new Date().toISOString()
    });

    // Всегда отправляем каждый ответ пользователя в ChatGPT для извлечения данных
    if (!this.openai) {
      throw new Error('OpenAI API key required for wellness form data extraction.');
    }

    // Отправляем в ChatGPT для извлечения данных
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
      missingFields: await this.findMissingFields(gptResult.extractedData, stage),
      extractionLog: gptResult.reasoning
    };
    
    progress.usedGPTForExtraction = true;

    // Обновляем данные этапа
    progress.stageData[stage] = {
      ...progress.stageData[stage],
      ...extractionResult.extractedData
    };
    
    progress.lastActiveAt = new Date().toISOString();

    // Проверяем, завершен ли этап
    const shouldAdvanceStage = await this.isStageComplete(stage, progress.stageData[stage] || {});
    
    let botResponse: string;
    
    if (shouldAdvanceStage) {
      // Этап завершен - переходим к следующему
      progress.completedStages.push(stage);
      const nextStage = STAGE_PROGRESSION[stage];
      
      if (nextStage === 'completed') {
        progress.currentStage = 'completed';
        botResponse = 'Great! I have all the information I need. Now I can give you personalized wellness recommendations! 🎉';
      } else {
        progress.currentStage = nextStage;
        
        // Генерируем динамический вопрос для следующего этапа с учетом всего контекста
        const conversationContext = this.buildConversationContext(progress);
        const nextQuestion = await this.generateQuestion(nextStage, conversationContext);
        
        botResponse = `Perfect! ⚅ Moving to the next section.\n\n${nextQuestion}`;
      }
    } else {
      // Этап не завершен - генерируем дополнительный вопрос с контекстом
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
   * Строит контекст всей беседы из прогресса wellness формы
   */
  private buildConversationContext(progress: WellnessStageProgress): ConversationMessage[] {
    const context: ConversationMessage[] = [];
    
    // Собираем сообщения из всех этапов в хронологическом порядке
    for (const stage of progress.completedStages) {
      const stageMessages = progress.messageHistory[stage] || [];
      context.push(...stageMessages);
    }
    
    // Добавляем сообщения из текущего этапа
    const currentStageMessages = progress.messageHistory[progress.currentStage] || [];
    context.push(...currentStageMessages);
    
    return context;
  }

  /**
   * Генерация натурального вопроса для этапа с учетом контекста
   */
  async generateQuestion(stage: WellnessStage, conversationContext: ConversationMessage[]): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI service not available');
    }

    // Получаем question промпт с сервера для генерации вопроса
    const questionPrompt = await promptConfigService.getQuestionPrompt(stage);
    
    const messages = [
      { 
        role: 'system', 
        content: questionPrompt
      },
      // Добавляем весь предыдущий контекст беседы
      ...conversationContext.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      {
        role: 'user',
        content: 'Generate next natural question for this wellness stage based on our conversation context.'
      }
    ];

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: messages as any,
        max_tokens: 300,
        temperature: 0.7
      });

      return response.choices[0]?.message?.content || 'Tell me more about yourself.';
    } catch (error) {
      logger.error('Error generating question:', error);
      throw error;
    }
  }

  /**
   * Извлечение данных с помощью ChatGPT (использует удаленные промпты)
   */
  private async extractDataWithGPT(request: GPTExtractionRequest): Promise<GPTExtractionResponse> {
    if (!this.openai) {
      throw new Error('OpenAI service not available');
    }

    // Получаем extraction промпт с сервера для извлечения данных
    const extractionPrompt = await promptConfigService.getExtractionPrompt(request.stage);
    
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
        temperature: 0.1 // Низкая температура для точности извлечения
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      // Парсим JSON ответ
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in GPT response');
      }

      const gptResponse: GPTExtractionResponse = JSON.parse(jsonMatch[0]);
      
      // Валидируем ответ
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
   * Проверяет, завершен ли этап на основе собранных данных
   */
  private async isStageComplete(stage: WellnessStage, stageData: Partial<WellnessData>): Promise<boolean> {
    const requiredFields = await promptConfigService.getRequiredFields(stage);
    
    // Если нет обязательных полей, этап считается завершенным
    if (requiredFields.length === 0) {
      return Object.keys(stageData).length > 0; // Хотя бы что-то есть
    }

    // Проверяем наличие всех обязательных полей
    return requiredFields.every(field => {
      const value = (stageData as any)[field];
      return value !== undefined && value !== null && value !== '';
    });
  }

  /**
   * Находит недостающие поля для этапа
   */
  private async findMissingFields(data: Partial<WellnessData>, stage: WellnessStage): Promise<string[]> {
    const requiredFields = await promptConfigService.getRequiredFields(stage);
    
    return requiredFields.filter(field => {
      const value = (data as any)[field];
      return value === undefined || value === null || value === '';
    });
  }

  /**
   * Генерирует дополнительный вопрос для неполного этапа
   */
  private async generateFollowUpQuestion(
    stage: WellnessStage, 
    stageData: Partial<WellnessData>,
    extractionResult: StageExtractionResult
  ): Promise<string> {
    const missingFields = extractionResult.missingFields;
    
    // Если есть информация - подтверждаем и спрашиваем недостающее
    const extractedFields = Object.keys(extractionResult.extractedData);
    let response = '';
    
    if (extractedFields.length > 0) {
      response += 'Got it! ';
      // Показываем что поняли
      extractedFields.forEach(field => {
        const value = (extractionResult.extractedData as any)[field];
        response += this.formatFieldValue(field, value) + ' ';
      });
      response += '\n\n';
    }

    // Спрашиваем недостающие важные поля
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
   * Проверяет доступность сервиса
   */
  isAvailable(): boolean {
    return this.openai !== null; // Требует OpenAI для интернационального извлечения
  }

  /**
   * Собирает финальные данные из всех этапов
   */
  getFinalWellnessData(progress: WellnessStageProgress): WellnessData {
    const finalData: WellnessData = {};
    
    // Объединяем данные из всех этапов
    Object.values(progress.stageData).forEach(stageData => {
      Object.assign(finalData, stageData);
    });

    // Рассчитываем BMI если есть вес и рост
    if (finalData.weight && finalData.height) {
      const heightM = finalData.height / 100;
      finalData.bmi = Math.round((finalData.weight / (heightM * heightM)) * 10) / 10;
    }

    return finalData;
  }
}

export const wellnessStageService = new WellnessStageService();
