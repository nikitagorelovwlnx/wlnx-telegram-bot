/**
 * Tests for CommandHandler - Fixed version
 */

import { CommandHandler } from '../../handlers/commandHandler';
import { userService } from '../../services/userService';
import { conversationService } from '../../services/conversationService';
import { apiService } from '../../services/apiService';
import { wellnessStageService } from '../../services/wellnessStageService';
import { Context } from 'telegraf';

// Mock dependencies
jest.mock('../../services/userService');
jest.mock('../../services/conversationService');
jest.mock('../../services/apiService');
jest.mock('../../utils/helpers');
jest.mock('../../services/wellnessStageService');

const mockUserService = userService as jest.Mocked<typeof userService>;
const mockConversationService = conversationService as jest.Mocked<typeof conversationService>;
const mockApiService = apiService as jest.Mocked<typeof apiService>;
const mockWellnessStageService = wellnessStageService as jest.Mocked<typeof wellnessStageService>;

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

      // Should be called twice - first to create user, then to set registration step
      expect(mockUserService.setUser).toHaveBeenCalledTimes(2);
      
      // Second call should set registration step
      expect(mockUserService.setUser).toHaveBeenLastCalledWith(
        '123456789',
        expect.objectContaining({
          registrationStep: 'name'
        })
      );
      
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('What\'s your name?')
      );
    });

    it('should greet existing authenticated users', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        firstName: 'John',
        isAuthenticated: true
      } as any);

      await CommandHandler.start(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Hey John!')
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
      (userService.getUser as jest.Mock).mockReturnValue({
        id: '123456789',
        isAuthenticated: false,
        registrationStep: 'email',
        firstName: 'John'
      });

      // Mock wellnessStageService methods
      const mockWellnessStageService = {
        initializeWellnessProcess: jest.fn().mockReturnValue({
          currentStage: 'demographics_baseline',
          completedStages: [],
          stageData: {},
          messageHistory: {},
          usedGPTForExtraction: false,
          startedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString()
        }),
        generateQuestion: jest.fn().mockResolvedValue('What is your age and gender?'),
        isAvailable: jest.fn().mockReturnValue(true)
      };

      jest.doMock('../../services/wellnessStageService', () => ({
        wellnessStageService: mockWellnessStageService
      }));

      const mockCtx = createMockContext();

      await CommandHandler.handleRegistrationFlow(
        mockCtx as any,
        'john@example.com'
      );

      expect(userService.setUser).toHaveBeenCalledWith(
        '123456789',
        expect.objectContaining({
          email: 'john@example.com',
          isAuthenticated: true,
          registrationStep: undefined,
          conversationActive: false
        })
      );
      
      // Should call reply (content will be dynamic based on server response)
      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('should handle invalid email format', async () => {
      (userService.getUser as jest.Mock).mockReturnValue({
        id: '123',
        isAuthenticated: false,
        registrationStep: 'email',
        firstName: 'John'
      });

      const mockCtx = createMockContext();

      await CommandHandler.handleRegistrationFlow(mockCtx as any, 'invalid-email');

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('doesn\'t look like an email')
      );
      // Email validation failed, setUser should not be called for completion
      expect(userService.setUser).not.toHaveBeenCalled();
    });

    it('should handle no registration step', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        firstName: 'John',
        email: 'john@example.com',
        // No registrationStep - already registered
      } as any);

      await CommandHandler.handleRegistrationFlow(mockCtx, 'any-text');

      // Should return early when no registration step
      expect(mockUserService.setUser).not.toHaveBeenCalled();
    });

    it('should return early when no user found', async () => {
      mockUserService.getUser.mockReturnValue(null);

      await CommandHandler.handleRegistrationFlow(mockCtx, 'any-text');

      // Should not do anything when no user
      expect(mockUserService.setUser).not.toHaveBeenCalled();
    });
  });

  describe('handleWellnessStageInput', () => {
    beforeEach(() => {
      // Setup wellnessStageService mocks
      mockWellnessStageService.processUserResponse.mockResolvedValue({
        extractionResult: {
          stage: 'demographics_baseline',
          extractedData: { age: 25 },
          extractionMethod: 'gpt_extraction',
          confidence: 85
        },
        updatedProgress: {
          currentStage: 'demographics_baseline',
          completedStages: [],
          stageData: { demographics_baseline: { age: 25 } },
          messageHistory: {}
        },
        botResponse: 'Thanks! What is your weight?',
        shouldAdvanceStage: false
      } as any);
      
      mockWellnessStageService.getFinalWellnessData.mockReturnValue({ age: 25, weight: null } as any);
    });

    it('should process wellness stage input successfully', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        firstName: 'John',
        email: 'john@example.com',
        isAuthenticated: true,
        wellnessProgress: {
          currentStage: 'demographics_baseline',
          completedStages: [],
          stageData: {},
          messageHistory: {}
        }
      } as any);

      mockApiService.getWellnessInterviews.mockResolvedValue([{
        id: 'interview-123',
        user_id: 'john@example.com',
        transcription: 'existing transcription',
        summary: 'existing summary',
        wellness_data: {}
      }] as any);

      mockApiService.updateWellnessInterview.mockResolvedValue({} as any);

      await CommandHandler.handleWellnessStageInput(mockCtx, 'I am 25 years old');

      expect(mockCtx.reply).toHaveBeenCalledWith('Thanks! What is your weight?');
      expect(mockApiService.updateWellnessInterview).toHaveBeenCalled();
    });

    it('should handle user without wellness progress', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        firstName: 'John',
        email: 'john@example.com',
        isAuthenticated: true
        // No wellnessProgress
      } as any);

      await CommandHandler.handleWellnessStageInput(mockCtx, 'test input');

      // Should show error message when no wellness progress
      expect(mockCtx.reply).toHaveBeenCalledWith(
        '❌ Ошибка состояния формы. Используйте /wellness_form чтобы начать.'
      );
    });

    it('should handle API errors gracefully', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        firstName: 'John',
        email: 'john@example.com',
        isAuthenticated: true,
        wellnessProgress: {
          currentStage: 'demographics_baseline',
          completedStages: [],
          stageData: {},
          messageHistory: {}
        }
      } as any);

      mockApiService.getWellnessInterviews.mockRejectedValue(new Error('API Error'));

      await CommandHandler.handleWellnessStageInput(mockCtx, 'test input');

      // Should still send bot response even if API fails
      expect(mockCtx.reply).toHaveBeenCalled();
    });
  });

  describe('handleNaturalConversation', () => {
    it('should handle natural conversation for authenticated users', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        firstName: 'John',
        email: 'john@example.com',
        isAuthenticated: true,
        conversationHistory: []
      } as any);

      mockConversationService.generateResponse.mockResolvedValue('Hello! How can I help you?');

      await CommandHandler.handleNaturalConversation(mockCtx, 'Hello');

      expect(mockConversationService.generateResponse).toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalledWith('Hello! How can I help you?');
    });

    it('should handle conversation service errors', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        firstName: 'John',
        email: 'john@example.com',
        isAuthenticated: true,
        conversationHistory: []
      } as any);

      mockConversationService.generateResponse.mockRejectedValue(new Error('OpenAI Error'));

      await CommandHandler.handleNaturalConversation(mockCtx, 'Hello');

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('having some technical difficulties')
      );
    });

    it('should return early for unauthenticated users', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        firstName: 'John',
        isAuthenticated: false
      } as any);

      await CommandHandler.handleNaturalConversation(mockCtx, 'Hello');

      expect(mockConversationService.generateResponse).not.toHaveBeenCalled();
      expect(mockCtx.reply).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle errors in start command', async () => {
      mockUserService.setUser.mockImplementation(() => {
        throw new Error('Database error');
      });

      // Should not throw
      await expect(CommandHandler.start(mockCtx)).resolves.not.toThrow();
    });

    it('should handle errors in registration flow', async () => {
      mockUserService.getUser.mockImplementation(() => {
        throw new Error('Service error');
      });

      // Should not throw
      await expect(CommandHandler.handleRegistrationFlow(mockCtx, 'test')).resolves.not.toThrow();
    });
  });
});
