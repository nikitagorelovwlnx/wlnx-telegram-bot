/**
 * Simplified integration tests for bot workflow
 */

import { conversationService } from '../../services/conversationService';
import { ConversationMessage } from '../../types';

// Mock OpenAI
jest.mock('openai');
const mockOpenAI = require('openai').default;
let mockCreate: jest.Mock;

describe('Bot Workflow - Simple Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup OpenAI mock with fallback system
    mockCreate = jest.fn();
    mockOpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }));
    
    // Mock GPT-5 to GPT-4 fallback - always return valid response
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: 'Test response from GPT-4'
        }
      }],
      usage: { total_tokens: 100 }
    });
  });

  describe('Data Extraction Tests', () => {
    it('should extract user data from conversation', () => {
      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: "Hi, I'm Alex, 30 years old",
          timestamp: '2023-12-01T10:00:00Z'
        },
        {
          role: 'user',
          content: "I weigh 70kg and I'm 180cm tall",
          timestamp: '2023-12-01T10:01:00Z'
        },
        {
          role: 'user',
          content: "I sleep 6 hours and walk 5000 steps daily",
          timestamp: '2023-12-01T10:02:00Z'
        }
      ];

      const result = conversationService.extractUserInfo(conversation);

      expect(result.age).toBe(30);
      expect(result.weight).toBe(70);
      expect(result.height).toBe(180);
      expect(result.sleep_duration).toBe(6);
      expect(result.daily_steps).toBe(5000);
    });
  });

  // OpenAI integration is already tested in other test files

  describe('Performance Tests', () => {
    it('should handle large conversation efficiently', () => {
      const largeConversation: ConversationMessage[] = [
        {
          role: 'user',
          content: "I'm 28 years old and weigh 75kg",
          timestamp: '2023-12-01T10:00:00Z'
        },
        // Add many messages
        ...Array(98).fill(null).map((_, i) => ({
          role: 'user' as const,
          content: `Message ${i}`,
          timestamp: '2023-12-01T10:00:00Z'
        }))
      ];

      const startTime = Date.now();
      const result = conversationService.extractUserInfo(largeConversation);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.age).toBe(28);
      expect(result.weight).toBe(75);
    });
  });
});
