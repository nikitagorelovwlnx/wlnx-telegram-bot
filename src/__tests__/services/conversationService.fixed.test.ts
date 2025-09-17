/**
 * Fixed tests for ConversationService based on actual implementation
 */

import { conversationService } from '../../services/conversationService';
import { ConversationMessage } from '../../types';

// Mock OpenAI properly
jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))
  };
});

describe('ConversationService - Fixed Tests', () => {
  
  describe('extractUserInfo - Real behavior', () => {
    it('should extract age from "I\'m X years old" pattern', () => {
      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: "I'm 25 years old",
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = conversationService.extractUserInfo(conversation);
      expect(result.age).toBe(25);
    });

    it('should extract weight and height correctly', () => {
      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: "I weigh 70kg and I'm 175cm tall",
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = conversationService.extractUserInfo(conversation);
      expect(result.weight).toBe(70);
      expect(result.height).toBe(175);
    });

    it('should calculate BMI correctly with metric units', () => {
      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: "I weigh 70kg and I'm 175cm tall",
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = conversationService.extractUserInfo(conversation);
      // 70kg, 175cm -> 1.75m
      // BMI = 70 / (1.75^2) = 22.9
      expect(result.bmi).toBeCloseTo(22.9, 1);
    });

    it('should extract sleep duration with "sleep X hours" pattern', () => {
      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: "I sleep 8 hours per night",
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = conversationService.extractUserInfo(conversation);
      expect(result.sleep_duration).toBe(8);
    });

    it('should extract daily steps', () => {
      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: "I walk 10000 steps daily",
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = conversationService.extractUserInfo(conversation);
      expect(result.daily_steps).toBe(10000);
    });

    it('should extract stress level keywords', () => {
      const testCases = [
        { message: "I feel very stressed", expected: "stressed" },
        { message: "I'm quite relaxed", expected: "relaxed" },
        { message: "feeling overwhelmed", expected: "overwhelmed" }
      ];

      testCases.forEach(({ message, expected }) => {
        const conversation: ConversationMessage[] = [
          {
            role: 'user',
            content: message,
            timestamp: '2023-12-01T10:00:00Z'
          }
        ];

        const result = conversationService.extractUserInfo(conversation);
        expect(result.stress_level).toContain(expected);
      });
    });

    it('should extract health goals', () => {
      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: "I want to lose weight and get fit",
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = conversationService.extractUserInfo(conversation);
      expect(result.health_goals).toContain('lose weight');
      expect(result.health_goals).toContain('get fit');
    });

    it('should extract activity preferences', () => {
      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: "I love yoga and running",
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = conversationService.extractUserInfo(conversation);
      expect(result.activity_preferences).toContain('yoga');
      expect(result.activity_preferences).toContain('running');
    });

    it('should extract medical information', () => {
      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: "I take vitamin d supplements and have back pain",
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = conversationService.extractUserInfo(conversation);
      expect(result.medications).toEqual(
        expect.arrayContaining([
          expect.stringContaining('vitamin d')
        ])
      );
      expect(result.injuries).toEqual(
        expect.arrayContaining([
          expect.stringContaining('back pain')
        ])
      );
    });

    it('should handle empty conversation gracefully', () => {
      const result = conversationService.extractUserInfo([]);
      
      expect(result.age).toBeUndefined();
      expect(result.weight).toBeUndefined();
      expect(result.health_goals).toEqual([]);
      expect(result.activity_preferences).toEqual([]);
    });
  });

  describe('generateResponse', () => {
    const mockOpenAI = require('openai').default;
    let mockCreate: jest.Mock;

    beforeEach(() => {
      mockCreate = mockOpenAI().chat.completions.create;
    });

    it('should generate response with proper OpenAI call', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Hello! How are you today?'
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: 'Hi Anna!',
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = await conversationService.generateResponse(conversation);

      expect(result).toBe('Hello! How are you today?');
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('You are Anna')
          }),
          expect.objectContaining({
            role: 'user',
            content: 'Hi Anna!'
          })
        ]),
        max_tokens: 300,
        temperature: 0.8,
        presence_penalty: 0.2,
        frequency_penalty: 0.1
      });
    });

    it('should handle OpenAI API errors', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: 'Hi Anna!',
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = await conversationService.generateResponse(conversation);

      expect(result).toBe('Sorry, something went wrong 😅 Can you try again?');
    });

    it('should handle empty response from OpenAI', async () => {
      const mockResponse = {
        choices: []
      };

      mockCreate.mockResolvedValue(mockResponse);

      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: 'Hi Anna!',
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = await conversationService.generateResponse(conversation);

      expect(result).toBe('Hmm, I paused for a moment... 🤔 Could you repeat that?');
    });
  });

  describe('generateWellnessSummary', () => {
    const mockOpenAI = require('openai').default;
    let mockCreate: jest.Mock;

    beforeEach(() => {
      mockCreate = mockOpenAI().chat.completions.create;
    });

    it('should generate wellness summary with extracted data', async () => {
      const mockSummary = '## WELLNESS PROFILE SUMMARY\n\n### DEMOGRAPHICS\n- Age: 30\n- Weight: 70kg';
      
      const mockResponse = {
        choices: [{
          message: {
            content: mockSummary
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: "I'm 30 years old and weigh 70kg",
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = await conversationService.generateWellnessSummary(conversation);

      expect(result).toBe(mockSummary);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('wellness data analyst')
          }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Age: 30')
          })
        ]),
        temperature: 0.3,
        max_tokens: 2500
      });
    });

    it('should handle summary generation errors', async () => {
      mockCreate.mockRejectedValue(new Error('Summary generation failed'));

      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: 'Test message',
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      await expect(conversationService.generateWellnessSummary(conversation))
        .rejects.toThrow('Summary generation failed');
    });
  });

  describe('isAvailable', () => {
    it('should return true when OpenAI is configured', () => {
      expect(conversationService.isAvailable()).toBe(true);
    });
  });
});
