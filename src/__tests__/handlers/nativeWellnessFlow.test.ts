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

  describe('handleWellnessDataCollection', () => {
    it('should automatically start wellness collection for new authenticated users', async () => {
      await CommandHandler.handleWellnessDataCollection(mockCtx, 'Hi there!');

      // Should call reply at least once - the exact message depends on server response
      expect(mockCtx.reply).toHaveBeenCalled();
      
      // Check that user service was called to update progress
      expect(userService.setUser).toHaveBeenCalled();
    });

    it('should fallback to normal conversation if OpenAI not available', async () => {
      // Mock service as unavailable
      const { wellnessStageService } = require('../../services/wellnessStageService');
      wellnessStageService.isAvailable = jest.fn().mockReturnValue(false);

      const handleNaturalConversationSpy = jest.spyOn(CommandHandler, 'handleNaturalConversation')
        .mockImplementation(() => Promise.resolve());

      await CommandHandler.handleWellnessDataCollection(mockCtx, 'Hello');

      expect(handleNaturalConversationSpy).toHaveBeenCalled();
    });
  });

  describe('User Flow Integration', () => {
    it('should automatically trigger wellness collection for users without data', async () => {
      const handleWellnessDataCollectionSpy = jest.spyOn(CommandHandler, 'handleWellnessDataCollection')
        .mockImplementation(() => Promise.resolve());

      (mockCtx as any).message = { text: 'Hello there!' };
      await CommandHandler.handleText(mockCtx);

      expect(handleWellnessDataCollectionSpy).toHaveBeenCalledWith(mockCtx, 'Hello there!');
    });

    it('should use normal conversation for users with existing data', async () => {
      // User already has extracted data
      (userService.getUser as jest.Mock).mockReturnValue({
        id: '123',
        isAuthenticated: true,
        firstName: 'John',
        extractedUserInfo: { age: 25, gender: 'male' }, // Has data
        wellnessProgress: null
      });

      const handleNaturalConversationSpy = jest.spyOn(CommandHandler, 'handleNaturalConversation')
        .mockImplementation(() => Promise.resolve());

      (mockCtx as any).message = { text: 'Hello' };
      await CommandHandler.handleText(mockCtx);

      expect(handleNaturalConversationSpy).toHaveBeenCalled();
    });
  });
});
