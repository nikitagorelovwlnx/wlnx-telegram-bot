/**
 * Tests for PromptConfigService
 */

import { promptConfigService } from '../../services/promptConfigService';
import { config } from '../../config';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock config
jest.mock('../../config', () => ({
  config: {
    apiBaseUrl: 'http://localhost:3000/api',
    logLevel: 'info'
  }
}));

describe('PromptConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear cache
    (promptConfigService as any).cache = null;
    (promptConfigService as any).lastFetch = 0;
  });

  const mockPromptData = {
    demographics_baseline: {
      system_prompt: 'You are Anna, a wellness consultant.',
      persona_prompt: 'Be warm and empathetic.',
      question_prompt: 'Ask about demographics.',
      extraction_prompt: 'Extract demographic data.',
      stage_introduction: 'Tell me about yourself.',
      required_fields: ['age', 'gender']
    },
    biometrics_habits: {
      system_prompt: 'Focus on health metrics.',
      persona_prompt: 'Be encouraging.',
      question_prompt: 'Ask about health habits.',
      extraction_prompt: 'Extract health data.',
      stage_introduction: 'Let\'s talk about your health.',
      required_fields: ['sleep_duration', 'daily_steps']
    }
  };

  describe('getSystemPrompt', () => {
    it('should return fallback system prompt', async () => {
      const result = await promptConfigService.getSystemPrompt();

      expect(result).toContain('wellness data analyst');
    });
  });

  describe('getStageIntroduction', () => {
    it('should return fallback stage introduction', async () => {
      const result = await promptConfigService.getStageIntroduction('demographics_baseline');

      expect(result).toContain('get to know each other');
      expect(result).toContain('age, location, basic physical info');
    });
  });

  describe('getRequiredFields', () => {
    it('should return fallback required fields', async () => {
      const result = await promptConfigService.getRequiredFields('demographics_baseline');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain('age');
      expect(result).toContain('gender');
    });

    it('should return empty array for invalid stage', async () => {
      const result = await promptConfigService.getRequiredFields('invalid_stage' as any);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('getConversationSystemPrompt', () => {
    it('should return hardcoded conversation system prompt', async () => {
      const result = await promptConfigService.getConversationSystemPrompt();

      expect(result).toContain('You are Anna, a professional wellness consultant');
      expect(result).toContain('warm, empathetic, and supportive');
    });
  });

  describe('getConversationPersonaPrompt', () => {
    it('should return hardcoded conversation persona prompt', async () => {
      const result = await promptConfigService.getConversationPersonaPrompt();

      expect(result).toContain('You are Anna, a warm and empathetic wellness consultant');
      expect(result).toContain('caring friend');
    });
  });

  describe('getWellnessSummarySystemPrompt', () => {
    it('should return hardcoded wellness summary system prompt', async () => {
      const result = await promptConfigService.getWellnessSummarySystemPrompt();

      expect(result).toContain('You are Anna, a wellness data analyst');
      expect(result).toContain('comprehensive wellness summary');
    });
  });

  describe('service availability', () => {
    it('should provide hardcoded prompts that always work', async () => {
      // Test methods that have hardcoded fallbacks
      const systemPrompt = await promptConfigService.getSystemPrompt();
      const conversationPrompt = await promptConfigService.getConversationSystemPrompt();
      const personaPrompt = await promptConfigService.getConversationPersonaPrompt();
      const summaryPrompt = await promptConfigService.getWellnessSummarySystemPrompt();

      expect(systemPrompt).toBeTruthy();
      expect(conversationPrompt).toBeTruthy();
      expect(personaPrompt).toBeTruthy();
      expect(summaryPrompt).toBeTruthy();
    });
  });
});
