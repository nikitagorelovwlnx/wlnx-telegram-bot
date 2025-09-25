/**
 * Tests for native wellness data collection flow (no commands)
 */

import { CommandHandler } from '../../handlers/commandHandler';
import { userService } from '../../services/userService';

// Mock all dependencies
jest.mock('../../services/userService');
jest.mock('../../services/wellnessStageService');
jest.mock('../../config', () => ({
  config: {
    openaiApiKey: 'test-key',
    logLevel: 'info'
  }
}));

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                extractedData: { age: 25, gender: 'male' },
                confidence: 85,
                reasoning: 'Test extraction',
                stageComplete: false
              })
            }
          }]
        })
      }
    }
  }));
});

describe('Native Wellness Flow (No Commands)', () => {
  const mockCtx = {
    from: { id: 123, first_name: 'John' },
    reply: jest.fn(),
    sendChatAction: jest.fn()
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (userService.getUser as jest.Mock).mockReturnValue({
      id: '123',
      isAuthenticated: true,
      firstName: 'John',
      extractedUserInfo: null, // No data yet - should trigger wellness collection
      wellnessProgress: null
    });
  });

  describe('Registration Flow with Wellness Start', () => {
    it('should start wellness collection after registration completion', async () => {
      // Mock registration completion flow
      (userService.getUser as jest.Mock).mockReturnValue({
        id: '123',
        isAuthenticated: false,
        registrationStep: 'email',
        firstName: 'John'
      });

      (mockCtx as any).message = { text: 'john@example.com' };
      await CommandHandler.handleRegistrationFlow(mockCtx, 'john@example.com');

      // Should call reply and set user data
      expect(mockCtx.reply).toHaveBeenCalled();
      expect(userService.setUser).toHaveBeenCalled();
    });

    it('should fallback to normal conversation if OpenAI not available during registration', async () => {
      // Mock wellnessStageService as unavailable
      jest.doMock('../../services/wellnessStageService', () => ({
        wellnessStageService: {
          initializeWellnessProcess: jest.fn(),
          generateQuestion: jest.fn(),
          isAvailable: jest.fn().mockReturnValue(false)
        }
      }));

      (userService.getUser as jest.Mock).mockReturnValue({
        id: '123',
        isAuthenticated: false,
        registrationStep: 'email',
        firstName: 'John'
      });

      (mockCtx as any).message = { text: 'john@example.com' };
      await CommandHandler.handleRegistrationFlow(mockCtx, 'john@example.com');

      expect(mockCtx.reply).toHaveBeenCalled();
    });
  });

  describe('User Flow Integration', () => {
    it('should continue wellness collection for users with active progress', async () => {
      // User has active wellness progress
      (userService.getUser as jest.Mock).mockReturnValue({
        id: '123',
        isAuthenticated: true,
        firstName: 'John',
        wellnessProgress: {
          currentStage: 'demographics_baseline',
          completedStages: [],
          stageData: {},
          messageHistory: {},
          usedGPTForExtraction: false,
          startedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString()
        }
      });

      const handleWellnessStageInputSpy = jest.spyOn(CommandHandler, 'handleWellnessStageInput')
        .mockImplementation(() => Promise.resolve());

      (mockCtx as any).message = { text: 'Hello there!' };
      await CommandHandler.handleText(mockCtx);

      expect(handleWellnessStageInputSpy).toHaveBeenCalledWith(mockCtx, 'Hello there!');
    });

    it('should use normal conversation for users with completed wellness', async () => {
      // User completed wellness collection
      (userService.getUser as jest.Mock).mockReturnValue({
        id: '123',
        isAuthenticated: true,
        firstName: 'John',
        wellnessProgress: {
          currentStage: 'completed',
          completedStages: ['demographics_baseline', 'biometrics_habits', 'lifestyle_context', 'medical_history', 'goals_preferences'],
          stageData: { age: 25, gender: 'male' },
          messageHistory: {},
          usedGPTForExtraction: true,
          startedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString()
        }
      });

      const handleNaturalConversationSpy = jest.spyOn(CommandHandler, 'handleNaturalConversation')
        .mockImplementation(() => Promise.resolve());

      (mockCtx as any).message = { text: 'Hello' };
      await CommandHandler.handleText(mockCtx);

      expect(handleNaturalConversationSpy).toHaveBeenCalled();
    });
  });
});
