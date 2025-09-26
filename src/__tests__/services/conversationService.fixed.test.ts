/**
 * Tests for ConversationService - only test implemented features
 */

import { conversationService } from '../../services/conversationService';
import { ConversationMessage, WellnessData } from '../../types';

// Mock OpenAI
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

// Mock promptConfigService
jest.mock('../../services/promptConfigService', () => ({
  promptConfigService: {
    getConversationSystemPrompt: jest.fn().mockResolvedValue('You are Anna, a wellness consultant.'),
    getConversationPersonaPrompt: jest.fn().mockResolvedValue('You are warm and empathetic.'),
    getWellnessSummarySystemPrompt: jest.fn().mockResolvedValue('Generate a wellness summary.')
  }
}));

describe('ConversationService', () => {
  const mockOpenAI = require('openai').default;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate = mockOpenAI().chat.completions.create;
  });

  describe('generateResponse', () => {
    it('should generate response using ChatGPT', async () => {
      const mockResponse = 'Hello! How can I help you today?';
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: mockResponse
          }
        }]
      });

      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: 'Hello',
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const result = await conversationService.generateResponse(conversation);

      expect(result).toBe(mockResponse);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: expect.arrayContaining([
          { role: 'system', content: expect.stringContaining('Anna') },
          { role: 'user', content: 'Hello' }
        ]),
        max_tokens: 1500,
        temperature: 0.7
      });
    });

    it('should handle OpenAI errors', async () => {
      mockCreate.mockRejectedValue(new Error('OpenAI API error'));

      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: 'Hello',
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      await expect(conversationService.generateResponse(conversation))
        .rejects.toThrow('OpenAI API error');
    });
  });

  describe('generateWellnessSummary', () => {
    it('should generate wellness summary with conversation and extracted data', async () => {
      const mockSummary = 'Wellness Summary: User is 30 years old, weighs 70kg...';
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: mockSummary
          }
        }]
      });

      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: "I'm 30 years old and weigh 70kg",
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const extractedData: WellnessData = {
        age: 30,
        weight: 70
      };

      const result = await conversationService.generateWellnessSummary(conversation, extractedData);

      expect(result).toBe(mockSummary);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: expect.arrayContaining([
          { role: 'system', content: expect.stringContaining('wellness summary') },
          { role: 'user', content: expect.stringContaining('EXTRACTED DATA') }
        ]),
        max_tokens: 2500,
        temperature: 0.3
      });
    });

    it('should handle errors in wellness summary generation', async () => {
      mockCreate.mockRejectedValue(new Error('Summary generation failed'));

      const conversation: ConversationMessage[] = [];
      const extractedData: WellnessData = {};

      await expect(conversationService.generateWellnessSummary(conversation, extractedData))
        .rejects.toThrow('Summary generation failed');
    });
  });
});
