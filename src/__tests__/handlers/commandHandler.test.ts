/**
 * Tests for CommandHandler
 */

import { CommandHandler } from '../../handlers/commandHandler';
import { userService } from '../../services/userService';
import { conversationService } from '../../services/conversationService';
import { apiService } from '../../services/apiService';
import { Context } from 'telegraf';

// Mock dependencies
jest.mock('../../services/userService');
jest.mock('../../services/conversationService');
jest.mock('../../services/apiService');
jest.mock('../../utils/helpers');

const mockUserService = userService as jest.Mocked<typeof userService>;
const mockConversationService = conversationService as jest.Mocked<typeof conversationService>;
const mockApiService = apiService as jest.Mocked<typeof apiService>;

// Mock context
const createMockContext = (override: Partial<Context> = {}): Context => ({
  reply: jest.fn(),
  from: {
    id: 123456789,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    is_bot: false
  },
  chat: {
    id: 123456789,
    type: 'private'
  },
  message: {
    message_id: 1,
    from: {
      id: 123456789,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      is_bot: false
    },
    chat: {
      id: 123456789,
      type: 'private'
    },
    date: Date.now() / 1000,
    text: 'test message'
  },
  ...override
} as Context);

// Mock getUserInfo helper
jest.mock('../../utils/helpers', () => ({
  getUserInfo: jest.fn((ctx) => ({
    id: ctx.from?.id || 123456789,
    username: ctx.from?.username || 'testuser',
    firstName: ctx.from?.first_name || 'Test',
    lastName: ctx.from?.last_name || 'User'
  })),
  handleError: jest.fn(),
  logUserAction: jest.fn()
}));

describe('CommandHandler', () => {
  let mockCtx: Context;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = createMockContext();
  });

  describe('start', () => {
    it('should start registration flow for new users', async () => {
      mockUserService.getUser.mockReturnValue(null);

      await CommandHandler.start(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Hey! 😊 I\'m Anna')
      );
      expect(mockUserService.setUser).toHaveBeenCalledWith(
        '123456789',
        expect.objectContaining({ registrationStep: 'name' })
      );
    });

    it('should show main menu for existing authenticated users', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        isAuthenticated: true,
        email: 'test@example.com'
      } as any);

      await CommandHandler.start(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Hey there! 😊')
      );
    });

    it('should continue registration for users in registration flow', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        isAuthenticated: false,
        registrationStep: 'email'
      } as any);

      await CommandHandler.start(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Hey! 😊 I\'m Anna')
      );
    });
  });

  describe('handleNaturalConversation', () => {
    const mockConversationHistory = [
      {
        role: 'user' as const,
        content: 'Hi Anna, I\'m 30 years old and weigh 70kg',
        timestamp: '2023-12-01T10:00:00Z'
      }
    ];

    beforeEach(() => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        email: 'test@example.com',
        conversationHistory: []
      } as any);
      
      mockConversationService.isAvailable.mockReturnValue(true);
      mockConversationService.generateResponse.mockResolvedValue('Hi! Nice to meet you!');
      mockConversationService.extractUserInfo.mockReturnValue({
        age: 30,
        weight: 70,
        health_goals: [],
        activity_preferences: []
      } as any);
    });

    it('should handle natural conversation flow', async () => {
      await CommandHandler.handleNaturalConversation(mockCtx, 'Hi Anna!');

      expect(mockConversationService.generateResponse).toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith('Hi! Nice to meet you!');
      expect(mockUserService.setUser).toHaveBeenCalledWith(
        '123456789',
        expect.objectContaining({
          conversationHistory: expect.arrayContaining([
            expect.objectContaining({ content: 'Hi Anna!' })
          ])
        })
      );
    });

    it('should auto-save after meaningful conversation', async () => {
      const longConversationHistory = Array(7).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant' as const,
        content: `Message ${i}`,
        timestamp: new Date().toISOString()
      }));

      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        email: 'test@example.com',
        conversationHistory: longConversationHistory
      } as any);

      mockConversationService.generateWellnessSummary.mockResolvedValue('Wellness summary');
      mockApiService.getWellnessInterviews.mockResolvedValue([]);
      mockApiService.createWellnessInterview.mockResolvedValue({} as any);

      await CommandHandler.handleNaturalConversation(mockCtx, 'More conversation');

      expect(mockApiService.createWellnessInterview).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          transcription: expect.stringContaining('Message'),
          summary: 'Wellness summary'
        })
      );
    });

    it('should handle conversation service unavailable', async () => {
      mockConversationService.isAvailable.mockReturnValue(false);

      await CommandHandler.handleNaturalConversation(mockCtx, 'Hi Anna!');

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('connection issues')
      );
    });
  });

  describe('saveConversation', () => {
    const mockConversationHistory = [
      {
        role: 'user' as const,
        content: 'Test message',
        timestamp: '2023-12-01T10:00:00Z'
      }
    ];

    beforeEach(() => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        email: 'test@example.com',
        conversationHistory: mockConversationHistory
      } as any);
    });

    it('should save conversation manually', async () => {
      // Mock authenticated user with conversation history
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        isAuthenticated: true,
        email: 'test@example.com',
        conversationHistory: mockConversationHistory
      } as any);

      mockConversationService.extractUserInfo.mockReturnValue({
        age: 25,
        weight: 65
      } as any);
      mockConversationService.generateWellnessSummary.mockResolvedValue('Wellness summary');
      mockApiService.getWellnessInterviews.mockResolvedValue([]);
      mockApiService.createWellnessInterview.mockResolvedValue({} as any);

      await CommandHandler.saveConversation(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Saving interview results')
      );
      expect(mockApiService.createWellnessInterview).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          summary: 'Wellness summary',
          wellness_data: expect.objectContaining({
            age: 25,
            weight: 65
          })
        })
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('New interview created')
      );
    });

    it('should update existing interview', async () => {
      // Mock authenticated user
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        isAuthenticated: true,
        email: 'test@example.com',
        conversationHistory: mockConversationHistory
      } as any);

      const existingInterview = {
        id: 'existing-id',
        user_id: 'user-123',
        transcription: 'old transcript',
        summary: 'old summary',
        created_at: '2023-12-01T09:00:00Z',
        updated_at: '2023-12-01T09:00:00Z'
      };

      mockConversationService.extractUserInfo.mockReturnValue({} as any);
      mockConversationService.generateWellnessSummary.mockResolvedValue('Updated summary');
      mockApiService.getWellnessInterviews.mockResolvedValue([existingInterview]);
      mockApiService.updateWellnessInterview.mockResolvedValue({} as any);

      await CommandHandler.saveConversation(mockCtx);

      expect(mockApiService.updateWellnessInterview).toHaveBeenCalledWith(
        'test@example.com',
        'existing-id',
        expect.objectContaining({
          summary: 'Updated summary',
          wellness_data: {}
        })
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('обновлено')
      );
    });

    it('should handle save errors gracefully', async () => {
      mockConversationService.extractUserInfo.mockReturnValue({} as any);
      mockConversationService.generateWellnessSummary.mockResolvedValue('Summary');
      mockApiService.getWellnessInterviews.mockRejectedValue({
        status: 400,
        response: { data: { error: 'Invalid data' } }
      });

      await CommandHandler.saveConversation(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Error saving')
      );
    });

    it('should handle missing email', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        conversationHistory: mockConversationHistory
      } as any);

      await CommandHandler.saveConversation(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Email not found')
      );
    });

    it('should handle empty conversation', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        email: 'test@example.com',
        conversationHistory: []
      } as any);

      await CommandHandler.saveConversation(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('No conversation to save')
      );
    });
  });

  describe('handleRegistrationFlow', () => {
    it('should handle name registration step', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        registrationStep: 'name'
      } as any);

      await CommandHandler.handleRegistrationFlow(mockCtx, 'John Doe');

      expect(mockUserService.setUser).toHaveBeenCalledWith(
        '123456789',
        expect.objectContaining({
          firstName: 'John Doe',
          registrationStep: 'email'
        })
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Nice to meet you, John Doe!')
      );
    });

    it('should handle email registration step', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        firstName: 'John',
        registrationStep: 'email'
      } as any);

      await CommandHandler.handleRegistrationFlow(mockCtx, 'john@example.com');

      expect(mockUserService.setUser).toHaveBeenCalledWith(
        '123456789',
        expect.objectContaining({
          email: 'john@example.com',
          registrationStep: 'password'
        })
      );
    });

    it('should complete registration with password', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        firstName: 'John',
        email: 'john@example.com',
        registrationStep: 'password'
      } as any);

      mockApiService.registerUser.mockResolvedValue({
        token: 'jwt-token',
        user: { 
          id: 1, 
          email: 'john@example.com', 
          name: 'John',
          created_at: '2023-12-01T10:00:00Z',
          updated_at: '2023-12-01T10:00:00Z'
        }
      });

      await CommandHandler.handleRegistrationFlow(mockCtx, 'password123');

      expect(mockApiService.registerUser).toHaveBeenCalledWith(
        'john@example.com',
        'password123',
        'John'
      );
      expect(mockUserService.setUser).toHaveBeenCalledWith(
        '123456789',
        expect.objectContaining({
          isAuthenticated: true,
          registrationStep: undefined
        })
      );
    });
  });
});
