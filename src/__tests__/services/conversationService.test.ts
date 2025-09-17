/**
 * Tests for ConversationService
 */

import OpenAI from 'openai';
import { conversationService } from '../../services/conversationService';
import { ConversationMessage } from '../../types';

// Mock OpenAI
jest.mock('openai');
const mockCreate = jest.fn();

// Mock the OpenAI constructor
const MockedOpenAI = jest.mocked(require('openai').default);

beforeEach(() => {
  jest.clearAllMocks();
  
  // Setup OpenAI mock to return the mockCreate function
  MockedOpenAI.mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate
      }
    }
  } as any));
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
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('You are Anna')
          })
        ]),
        max_tokens: 300,
        temperature: 0.8,
        presence_penalty: 0.2,
        frequency_penalty: 0.1
      });
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

      await conversationService.generateResponse([mockConversation[0]], true);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('first time')
          })
        ]),
        max_tokens: 300,
        temperature: 0.8,
        presence_penalty: 0.2,
        frequency_penalty: 0.1
      });
    });

    it('should handle OpenAI errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('OpenAI API Error'));

      const result = await conversationService.generateResponse(mockConversation);

      expect(result).toBe('Sorry, something went wrong 😅 Can you try again?');
    });

    it('should handle empty response from OpenAI', async () => {
      const mockResponse = {
        choices: [],
        usage: { total_tokens: 0 }
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await conversationService.generateResponse(mockConversation);

      expect(result).toBe('Hmm, I paused for a moment... 🤔 Could you repeat that?');
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
      expect(result.stress_level).toContain('stressed');
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

    it('should extract medical information', () => {
      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: 'I take vitamin D supplements and have back pain from an old injury.',
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = conversationService.extractUserInfo(conversation);

      expect(result.medications).toEqual(expect.arrayContaining([
        expect.stringContaining('vitamin d')
      ]));
      expect(result.injuries).toEqual(expect.arrayContaining([
        expect.stringContaining('back pain')
      ]));
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
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await conversationService.generateWellnessSummary(mockConversation);

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
            content: expect.stringContaining('Age: 28')
          })
        ]),
        temperature: 0.3,
        max_tokens: 2500
      });
    });

    it('should handle summary generation errors', async () => {
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
