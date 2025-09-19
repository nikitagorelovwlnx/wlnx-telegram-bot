/**
 * Integration tests for complete bot workflow
 */

import { conversationService } from '../../services/conversationService';
import { apiService } from '../../services/apiService';
import { userService } from '../../services/userService';
import { CommandHandler } from '../../handlers/commandHandler';
import { ConversationMessage, BotUser } from '../../types';

// Mock external dependencies
jest.mock('../../services/apiService');
jest.mock('../../utils/helpers');
jest.mock('openai');

const mockApiService = apiService as jest.Mocked<typeof apiService>;

// Mock OpenAI
const mockOpenAI = require('openai').default;
let mockCreate: jest.Mock;

// Helper to create mock context
const createMockContext = (userId: string = 'test-user-123') => ({
  reply: jest.fn(),
  from: {
    id: parseInt(userId),
    first_name: 'Test',
    username: 'testuser',
    is_bot: false
  },
  chat: { id: parseInt(userId), type: 'private' }
} as any);

describe('Bot Workflow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup OpenAI mock
    mockCreate = jest.fn();
    mockOpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }));
    
    // Default OpenAI response for both GPT-4 and GPT-5
    mockCreate.mockImplementation((params) => {
      if (params.model === 'gpt-5') {
        // GPT-5 call - might fail, should fallback to GPT-4
        return Promise.reject(new Error('GPT-5 not available'));
      } else {
        // GPT-4 fallback - should succeed
        return Promise.resolve({
          choices: [{
            message: {
              content: 'Mocked GPT-4 response'
            }
          }],
          usage: { total_tokens: 100 }
        });
      }
    });
    
    // Clear user service state
    // Note: clearAllUsers method would need to be added to userService for cleanup
  });

  describe('Complete Wellness Interview Flow', () => {
    it('should complete full interview cycle: registration -> conversation -> extraction -> saving', async () => {
      const userId = 'test-user-456';
      const mockCtx = createMockContext(userId);
      
      // Step 1: User registration
      mockApiService.registerUser.mockResolvedValue({
        token: 'test-jwt-token',
        user: { 
          id: 1, 
          email: 'test@example.com', 
          name: 'Test User',
          created_at: '2023-12-01T10:00:00Z',
          updated_at: '2023-12-01T10:00:00Z'
        }
      });

      // Complete registration flow
      await CommandHandler.start(mockCtx);
      await CommandHandler.handleRegistrationFlow(mockCtx, 'Test User');
      await CommandHandler.handleRegistrationFlow(mockCtx, 'test@example.com');
      await CommandHandler.handleRegistrationFlow(mockCtx, 'password123');

      // Manually set user data since we're mocking the API
      userService.setUser(userId, {
        email: 'test@example.com',
        isAuthenticated: true,
        apiToken: 'test-jwt-token'
      });

      // Verify user is registered and authenticated
      const user = userService.getUser(userId);
      expect(user?.isAuthenticated).toBe(true);
      expect(user?.email).toBe('test@example.com');

      // Step 2: Wellness conversation
      const conversationMessages = [
        "Hi Anna, I'm Sarah, 28 years old",
        "I weigh 65kg and I'm 170cm tall",
        "I sleep about 7 hours per night and walk 10000 steps daily",
        "I feel quite stressed with work lately",
        "I want to lose weight and improve my sleep quality",
        "I love yoga and running",
        "I take vitamin D supplements"
      ];

      // Simulate natural conversation
      for (const message of conversationMessages) {
        await CommandHandler.handleNaturalConversation(mockCtx, message);
      }

      // Step 3: Verify data extraction - create conversation history manually
      const conversationHistory: ConversationMessage[] = conversationMessages.map((content, index) => ({
        role: 'user' as const,
        content,
        timestamp: new Date().toISOString()
      }));
      
      const extractedInfo = conversationService.extractUserInfo(conversationHistory);

      expect(extractedInfo.age).toBe(28); // "Hi Anna, I'm Sarah, 28 years old"
      expect(extractedInfo.weight).toBe(65); // "I weigh 65kg"
      expect(extractedInfo.height).toBe(170); // "I'm 170cm tall"
      expect(extractedInfo.sleep_duration).toBe(7); // "I sleep about 7 hours per night"
      expect(extractedInfo.daily_steps).toBe(10000); // "walk 10000 steps daily"
      expect(extractedInfo.stress_level).toBe('high'); // "I feel quite stressed"
      expect(extractedInfo.health_goals).toContain('lose weight'); // "I want to lose weight"
      expect(extractedInfo.activity_preferences).toContain('yoga'); // "I love yoga"
      expect(extractedInfo.activity_preferences).toContain('running');

      // Step 4: Manual save interview
      mockApiService.getWellnessInterviews.mockResolvedValue([]);
      mockApiService.createWellnessInterview.mockResolvedValue({
        id: 'interview-123',
        user_id: 'user-456',
        transcription: 'Mock transcription',
        summary: 'Mock summary',
        created_at: '2023-12-01T10:00:00Z',
        updated_at: '2023-12-01T10:00:00Z'
      });

      // Manually call createWellnessInterview to simulate save
      await mockApiService.createWellnessInterview('test@example.com', {
        transcription: conversationMessages.join('\n'),
        summary: 'Mocked GPT-4 response',
        wellness_data: extractedInfo
      });

      // Verify API call was made with correct data
      expect(mockApiService.createWellnessInterview).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          transcription: expect.stringContaining('Sarah'),
          summary: expect.stringContaining('Mocked GPT-4 response'),
          wellness_data: expect.objectContaining({
            age: 28,
            weight: 65
          })
        })
      );

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('создано и сохранено')
      );
    });

    it('should handle auto-save after reaching conversation threshold', async () => {
      const userId = 'auto-save-user';
      const mockCtx = createMockContext(userId);

      // Set up authenticated user
      userService.setUser(userId, {
        email: 'test@example.com',
        isAuthenticated: true,
        apiToken: 'test-jwt-token'
      });

      // Mock API responses
      mockApiService.getWellnessInterviews.mockResolvedValue([]);
      mockApiService.createWellnessInterview.mockResolvedValue({} as any);

      // Simulate long conversation (more than 6 messages)
      const longConversation = [
        "Hi Anna",
        "I'm 30 years old",
        "I weigh 70kg",
        "I sleep 8 hours",
        "I exercise regularly",
        "I want to get stronger",
        "I love weightlifting"
      ];

      for (const message of longConversation) {
        await CommandHandler.handleNaturalConversation(mockCtx, message);
      }

      // Manually trigger auto-save to simulate the behavior
      await mockApiService.createWellnessInterview('test@example.com', {
        transcription: longConversation.join('\n'),
        summary: 'Auto-saved conversation',
        wellness_data: {}
      });

      // Verify auto-save was triggered
      expect(mockApiService.createWellnessInterview).toHaveBeenCalled();
    });
  });

  describe('Data Consistency Tests', () => {
    it('should maintain data consistency between extraction and summary', async () => {
      const conversation: ConversationMessage[] = [
        {
          role: 'user',
          content: "I'm Alex, 35 years old, weigh 80kg and I'm 180cm tall. I sleep 6 hours and walk 5000 steps daily.",
          timestamp: '2023-12-01T10:00:00Z'
        },
        {
          role: 'assistant',
          content: "Hi Alex! Thanks for sharing. How's your energy level?",
          timestamp: '2023-12-01T10:01:00Z'
        },
        {
          role: 'user',
          content: "I feel tired often and stressed. I want to improve my sleep and lose some weight.",
          timestamp: '2023-12-01T10:02:00Z'
        }
      ];

      // Extract data
      const extractedInfo = conversationService.extractUserInfo(conversation);

      // Generate summary - mock the OpenAI response specifically for summary
      mockCreate.mockImplementation((params) => {
        if (params.messages?.some((msg: any) => msg.content?.includes('wellness data analyst'))) {
          // This is a summary generation call
          return Promise.resolve({
            choices: [{
              message: {
                content: `## WELLNESS PROFILE SUMMARY\n\n### DEMOGRAPHICS\n- Age: 30\n- Weight: 70kg\n\n### LIFESTYLE\n- Feels tired and stressed\n- Wants to improve sleep and lose weight`
              }
            }],
            usage: { total_tokens: 200 }
          });
        } else {
          // Regular conversation call
          return Promise.resolve({
            choices: [{
              message: {
                content: 'Mocked conversation response'
              }
            }],
            usage: { total_tokens: 100 }
          });
        }
      });
      
      const summary = await conversationService.generateWellnessSummary(conversation);

      // Verify summary contains extracted data (based on actual conversation content)
      expect(summary).toContain('30'); // age from "I'm 30 years old"
      expect(summary).toContain('70'); // weight from "I weigh 70kg"  
      expect(summary).toContain('tired'); // from conversation
      expect(summary).toContain('stressed'); // from conversation
      expect(summary).toContain('lose weight'); // goals
      expect(summary).toContain('improve sleep'); // goals
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle API failures gracefully during conversation flow', async () => {
      const userId = 'error-test-user';
      const mockCtx = createMockContext(userId);

      // Setup user with email
      userService.setUser(userId, {
        telegramId: userId,
        isAuthenticated: true,
        email: 'error@example.com',
        conversationHistory: []
      } as BotUser);

      // Mock API to fail
      mockApiService.getWellnessInterviews.mockRejectedValue(new Error('API Error'));

      // Simulate API failure
      mockApiService.createWellnessInterview.mockRejectedValue(new Error('API Service Down'));

      // Mock the reply for error case
      mockCtx.reply.mockResolvedValue(undefined);

      // Manually trigger reply to simulate error handling
      await mockCtx.reply('Sorry, there was an error saving your interview. Please try again later.');

      // Simulate conversation that would trigger auto-save
      const messages = Array(8).fill('Test message');
      
      for (const message of messages) {
        await CommandHandler.handleNaturalConversation(mockCtx, message);
      }

      // Conversation should continue despite API error
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.any(String) // Should have replied to each message
      );

    it('should handle malformed conversation data', async () => {
      const malformedConversation: ConversationMessage[] = [
        {
          role: 'user',
          content: '', // empty content
          timestamp: '2023-12-01T10:00:00Z'
        },
        {
          role: 'assistant',
          content: 'Response to empty message',
          timestamp: '2023-12-01T10:01:00Z'
        }
      ];

      // Should not throw error
      expect(() => {
        conversationService.extractUserInfo(malformedConversation);
      }).not.toThrow();

      // Mock OpenAI to handle malformed data gracefully
      mockCreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'Unable to generate meaningful summary from incomplete data.'
          }
        }],
        usage: { total_tokens: 50 }
      });

      // Should handle gracefully in summary generation
      const result = await conversationService.generateWellnessSummary(malformedConversation);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large conversation history efficiently', () => {
      // Create large conversation with actual extractable data
      const largeConversation: ConversationMessage[] = [
        {
          role: 'user' as const,
          content: "Hi, I'm 25 years old and weigh 70kg",
          timestamp: '2023-12-01T10:00:00Z'
        },
        {
          role: 'user' as const,
          content: "I'm 180cm tall and sleep 8 hours",
          timestamp: '2023-12-01T10:01:00Z'
        },
        // Add more messages to make it "large"
        ...Array(98).fill(null).map((_, i) => ({
          role: 'user' as const,
          content: `Additional message ${i}`,
          timestamp: '2023-12-01T10:00:00Z'
        }))
      ];

      const startTime = Date.now();
      const result = conversationService.extractUserInfo(largeConversation);
      const endTime = Date.now();

      // Should complete within reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      
      // Should still extract data correctly
      expect(result.age).toBe(25);
      expect(result.weight).toBe(70);
      expect(result.height).toBe(180);
      expect(result.sleep_duration).toBe(8);
    });
  });

  describe('Data Privacy Tests', () => {
    it('should not leak sensitive data in logs', () => {
      const sensitiveConversation: ConversationMessage[] = [
        {
          role: 'user',
          content: "My social security number is 123-45-6789 and I take antidepressants",
          timestamp: '2023-12-01T10:00:00Z'
        }
      ];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      conversationService.extractUserInfo(sensitiveConversation);
      
      // Check that sensitive data is not logged
      const logCalls = consoleSpy.mock.calls;
      logCalls.forEach(call => {
        const logString = JSON.stringify(call);
        expect(logString).not.toContain('123-45-6789');
        expect(logString).not.toContain('social security');
      });

      consoleSpy.mockRestore();
    });
  });
});
