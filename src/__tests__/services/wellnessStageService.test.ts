/**
 * Тесты для wellnessStageService
 */

import { wellnessStageService } from '../../services/wellnessStageService';
import { WellnessStage } from '../../types';
import { config } from '../../config';

// Mock promptConfigService
jest.mock('../../services/promptConfigService', () => ({
  promptConfigService: {
    getExtractionPrompt: jest.fn().mockResolvedValue('Extract demographic data from user response in JSON format.'),
    getQuestionPrompt: jest.fn().mockResolvedValue('Ask about user demographics like age, gender, weight, height.'),
    getStageIntroduction: jest.fn().mockResolvedValue('Tell me about yourself - age, gender, and basic info.'),
    getRequiredFields: jest.fn().mockResolvedValue(['age', 'gender']),
    getConversationPersonaPrompt: jest.fn().mockResolvedValue('You are Anna, a warm and empathetic wellness consultant.')
  }
}));

// Mock OpenAI для тестов
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                extractedData: { age: 25, gender: 'male' },
                confidence: 85,
                reasoning: 'Test extraction',
                suggestedNextQuestion: 'What is your weight?',
                stageComplete: false
              })
            }
          }]
        })
      }
    }
  }));
});

// Mock config для OpenAI ключа и логгера
jest.mock('../../config', () => ({
  config: {
    logLevel: 'info',
    openaiApiKey: 'test-key-123'
  }
}));

describe('WellnessStageService', () => {
  beforeEach(() => {
    // Мокаем конфиг для тестов
    (config as any).openaiApiKey = 'test-key';
    jest.clearAllMocks();
  });

  describe('initializeWellnessProcess', () => {
    it('should initialize wellness process with correct defaults', () => {
      const progress = wellnessStageService.initializeWellnessProcess();
      
      expect(progress.currentStage).toBe('demographics_baseline');
      expect(progress.completedStages).toEqual([]);
      expect(progress.stageData).toEqual({});
      expect(progress.messageHistory).toEqual({});
      expect(progress.usedGPTForExtraction).toBe(false);
      expect(progress.startedAt).toBeDefined();
      expect(progress.lastActiveAt).toBeDefined();
    });
  });

  describe('getStageIntroduction', () => {
    it('should return correct introduction for each stage', async () => {
      const stages: WellnessStage[] = [
        'demographics_baseline',
        'biometrics_habits', 
        'lifestyle_context',
        'medical_history',
        'goals_preferences'
      ];

      for (const stage of stages) {
        const intro = await wellnessStageService.getStageIntroduction(stage);
        expect(intro).toBeDefined();
        expect(intro.length).toBeGreaterThan(0);
        expect(typeof intro).toBe('string');
      }
    });
  });

  describe('processUserResponse with ChatGPT', () => {
    it('should always send user response to ChatGPT for data extraction', async () => {
      const progress = wellnessStageService.initializeWellnessProcess();
      
      const result = await wellnessStageService.processUserResponse(
        'I am 25 years old male',
        progress
      );

      // Проверяем что данные извлечены через GPT
      expect(result.extractionResult.extractedData.age).toBe(25);
      expect(result.extractionResult.extractedData.gender).toBe('male');
      expect(result.extractionResult.extractionMethod).toBe('gpt_extraction');
      expect(result.extractionResult.confidence).toBe(85);
    });

    it('should handle any language through ChatGPT', async () => {
      const progress = wellnessStageService.initializeWellnessProcess();
      progress.currentStage = 'biometrics_habits';
      
      const result = await wellnessStageService.processUserResponse(
        'Je dors 7 heures par nuit', // French
        progress
      );

      expect(result.extractionResult.extractionMethod).toBe('gpt_extraction');
      expect(result.updatedProgress.usedGPTForExtraction).toBe(true);
    });
  });

  describe('getFinalWellnessData', () => {
    it('should combine data from all stages', () => {
      const progress = wellnessStageService.initializeWellnessProcess();
      
      // Добавляем данные в разные этапы
      progress.stageData.demographics_baseline = {
        age: 30,
        weight: 75,
        height: 180
      };
      
      progress.stageData.biometrics_habits = {
        sleep_duration: 8,
        daily_steps: 10000
      };

      const finalData = wellnessStageService.getFinalWellnessData(progress);
      
      expect(finalData.age).toBe(30);
      expect(finalData.weight).toBe(75);
      expect(finalData.height).toBe(180);
      expect(finalData.sleep_duration).toBe(8);
      expect(finalData.daily_steps).toBe(10000);
      // BMI должен рассчитаться автоматически
      expect(finalData.bmi).toBeCloseTo(23.1, 1);
    });
  });

  // Note: isAvailable method was removed - service is always available when OpenAI key is configured
});
