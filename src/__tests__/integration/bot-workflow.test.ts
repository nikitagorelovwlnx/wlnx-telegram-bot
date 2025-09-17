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

const mockApiService = apiService as jest.Mocked<typeof apiService>;

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

      // Step 3: Verify data extraction
      const updatedUser = userService.getUser(userId);
      const extractedInfo = conversationService.extractUserInfo(updatedUser!.conversationHistory!);

      expect(extractedInfo.age).toBe(28);
      expect(extractedInfo.weight).toBe(65);
      expect(extractedInfo.height).toBe(170);
      expect(extractedInfo.sleep_duration).toBe(7);
      expect(extractedInfo.daily_steps).toBe(10000);
      expect(extractedInfo.stress_level).toBe('stressed');
      expect(extractedInfo.health_goals).toContain('lose weight');
      expect(extractedInfo.health_goals).toContain('improve sleep');
      expect(extractedInfo.activity_preferences).toContain('yoga');
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

      await CommandHandler.saveConversation(mockCtx);

      // Verify API call was made with correct data
      expect(mockApiService.createWellnessInterview).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          transcription: expect.stringContaining('Sarah'),
          summary: expect.stringContaining('28')
        })
      );

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('создано и сохранено')
      );
    });

    it('should handle auto-save after reaching conversation threshold', async () => {
      const userId = 'auto-save-user';
      const mockCtx = createMockContext(userId);

      // Setup authenticated user
      userService.setUser(userId, {
        telegramId: userId,
        isAuthenticated: true,
        email: 'autosave@example.com',
        conversationHistory: []
      } as BotUser);

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

      // Generate summary
      const summary = await conversationService.generateWellnessSummary(conversation);

      // Verify summary contains extracted data
      expect(summary).toContain('35'); // age
      expect(summary).toContain('80'); // weight  
      expect(summary).toContain('180'); // height
      expect(summary).toContain('6'); // sleep hours
      expect(summary).toContain('5000'); // steps
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

      // Simulate conversation that would trigger auto-save
      const messages = Array(8).fill('Test message');
      
      for (const message of messages) {
        await CommandHandler.handleNaturalConversation(mockCtx, message);
      }

      // Conversation should continue despite API error
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.any(String) // Should have replied to each message
      );
    });

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

      // Should handle gracefully in summary generation
      await expect(
        conversationService.generateWellnessSummary(malformedConversation)
      ).resolves.toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    it('should handle large conversation history efficiently', () => {
      const largeConversation: ConversationMessage[] = Array(100).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i} with some health data like age ${25 + (i % 10)} and weight ${60 + (i % 20)}kg`,
        timestamp: new Date(2023, 11, 1, 10, i).toISOString()
      }));

      const startTime = Date.now();
      const result = conversationService.extractUserInfo(largeConversation);
      const endTime = Date.now();

      // Should complete within reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      
      // Should still extract data correctly
      expect(result.age).toBeDefined();
      expect(result.weight).toBeDefined();
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
