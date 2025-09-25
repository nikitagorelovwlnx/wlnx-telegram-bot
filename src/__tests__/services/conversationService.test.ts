/**
 * Tests for ConversationService
 */

// Create mock function first
const mockCreate = jest.fn();

// Mock OpenAI properly - MUST be before any imports
jest.mock('openai', () => {
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

import OpenAI from 'openai';
import { conversationService } from '../../services/conversationService';
import { ConversationMessage } from '../../types';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ConversationService', () => {
  const mockConversation: ConversationMessage[] = [
    {
      role: 'user',
      content: 'Hi, I\'m 28 years old, weigh 65kg and I\'m 170cm tall',
      timestamp: '2023-12-01T10:00:00Z'
    },
    {
      role: 'assistant', 
      content: 'Hi! Nice to meet you! How has your health been lately?',
      timestamp: '2023-12-01T10:01:00Z'
    },
    {
      role: 'user',
      content: 'I sleep about 7 hours per night and walk 8000 steps daily. I feel stressed lately.',
      timestamp: '2023-12-01T10:02:00Z'
    }
  ];

  describe('generateResponse', () => {
    it('should generate a response using OpenAI', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'That sounds great! Tell me more about your sleep quality.'
          }
        }],
        usage: { total_tokens: 150 }
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await conversationService.generateResponse(mockConversation);

      expect(result).toBe('That sounds great! Tell me more about your sleep quality.');
      // Should use GPT-5 or fallback to GPT-4
      const calls = mockCreate.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      
      // Check that at least one call has the right parameters
      const validCall = calls.find(call => 
        call[0].model === 'gpt-5' || call[0].model === 'gpt-4'
      );
      expect(validCall).toBeDefined();
      expect(validCall[0].messages).toEqual(expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('wellness consultant')
        }),
        expect.objectContaining({
          role: 'assistant', 
          content: expect.stringContaining('You are Anna')
        })
      ]));
      expect(validCall[0].temperature).toBe(0.7);
      
      if (validCall[0].model === 'gpt-5') {
        expect(validCall[0].max_completion_tokens).toBe(1500);
      } else {
        expect(validCall[0].max_tokens).toBe(1500);
      }
    });

    it('should add first message context for new conversations', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Hi there! I\'m Anna, nice to meet you!'
          }
        }],
        usage: { total_tokens: 100 }
      };

      mockCreate.mockResolvedValue(mockResponse);

      await conversationService.generateResponse([mockConversation[0]]);

      // Should use GPT-5 or fallback to GPT-4
      const calls = mockCreate.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      
      // Check that at least one call has the right parameters
      const validCall = calls.find(call => 
        call[0].model === 'gpt-5' || call[0].model === 'gpt-4'
      );
      expect(validCall).toBeDefined();
      expect(validCall[0].messages).toEqual(expect.arrayContaining([
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('beginning of your conversation')
        })
      ]));
      expect(validCall[0].temperature).toBe(0.7);
      
      if (validCall[0].model === 'gpt-5') {
        expect(validCall[0].max_completion_tokens).toBe(1500);
      } else {
        expect(validCall[0].max_tokens).toBe(1500);
      }
    });

    it('should handle OpenAI errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('OpenAI API Error'));

      const result = await conversationService.generateResponse(mockConversation);

      expect(result).toBe('Sorry, something went wrong 😅 Can you try again?');
    });

    it('should handle empty response from OpenAI', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: null // Simulate empty content
          }
        }],
        usage: { total_tokens: 0 }
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await conversationService.generateResponse(mockConversation);

      expect(result).toBe('Sorry, something went wrong 😅 Can you try again?');
    });
  });

  describe('extractUserInfo', () => {
    it('should extract demographic information correctly', () => {
      const result = conversationService.extractUserInfo(mockConversation);

      expect(result.age).toBe(28);
      expect(result.weight).toBe(65);
      expect(result.height).toBe(170);
      expect(result.sleep_duration).toBe(7);
      expect(result.daily_steps).toBe(8000);
      expect(result.stress_level).toBe('high');
    });

    it('should calculate BMI when weight and height are available', () => {
      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: 'I weigh 70kg and I\'m 175cm tall',
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = conversationService.extractUserInfo(conversation);

      expect(result.weight).toBe(70);
      expect(result.height).toBe(175);
      expect(result.bmi).toBeCloseTo(22.9, 1);
    });

    it('should extract health goals and preferences', () => {
      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: 'I want to lose weight and improve sleep. I love yoga and running.',
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = conversationService.extractUserInfo(conversation);

      expect(result.health_goals).toContain('lose weight');
      expect(result.health_goals).toContain('improve sleep');
      expect(result.activity_preferences).toContain('yoga');
      expect(result.activity_preferences).toContain('running');
    });

    it('should initialize empty arrays for health goals and preferences', () => {
      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: 'I take vitamin D supplements and have back pain from an old injury.',
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = conversationService.extractUserInfo(conversation);

      expect(result.health_goals).toEqual([]);
      expect(result.activity_preferences).toEqual([]);
    });

    it('should handle empty conversation', () => {
      const result = conversationService.extractUserInfo([]);

      expect(result.age).toBeUndefined();
      expect(result.weight).toBeUndefined();
      expect(result.health_goals).toEqual([]);
    });
  });

  describe('generateWellnessSummary', () => {
    it('should generate wellness summary using extracted data', async () => {
      const mockSummary = `## WELLNESS PROFILE SUMMARY

### DEMOGRAPHICS & BASELINE
- Age: 28
- Gender: Not specified
- Weight: 65
- Height: 170
- BMI: 22.5

### BIOMETRICS & DAILY HABITS
- Daily Steps: 8000
- Sleep Duration: 7 hours
- Stress Level: stressed

### KEY INSIGHTS & OPPORTUNITIES
- User shows good activity levels with 8000 daily steps
- Sleep duration is adequate at 7 hours
- Stress management may need attention`;

      const mockResponse = {
        choices: [{
          message: {
            content: mockSummary
          }
        }],
        usage: { total_tokens: 500 }
      };

      // Ensure mock is properly set up for this test
      mockCreate.mockClear();
      mockCreate.mockResolvedValue(mockResponse);

      const result = await conversationService.generateWellnessSummary(mockConversation);

      expect(result).toBe(mockSummary);
      
      // Check that OpenAI was called with either GPT-5 or GPT-4
      const calls = mockCreate.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      
      // At least one call should be with a valid model
      const hasValidModel = calls.some(call => 
        call[0].model === 'gpt-5' || call[0].model === 'gpt-4'
      );
      expect(hasValidModel).toBe(true);
    });

    it('should handle summary generation errors', async () => {
      // Clear and set up mock for error case
      mockCreate.mockClear();
      mockCreate.mockRejectedValue(new Error('Summary generation failed'));

      await expect(conversationService.generateWellnessSummary(mockConversation))
        .rejects.toThrow('Summary generation failed');
    });
  });

  describe('isAvailable', () => {
    it('should return true when OpenAI is configured', () => {
      expect(conversationService.isAvailable()).toBe(true);
    });
  });
});
