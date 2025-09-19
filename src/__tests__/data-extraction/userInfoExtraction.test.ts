/**
 * Realistic user info extraction tests - only test implemented features
 */

import { conversationService } from '../../services/conversationService';
import { ConversationMessage } from '../../types';

// Helper function to create conversation
const createConversation = (messages: string[]): ConversationMessage[] => {
  return messages.map(content => ({
    role: 'user' as const,
    content,
    timestamp: '2023-12-01T10:00:00Z'
  }));
};

describe('User Info Extraction - Realistic Tests', () => {
  describe('Demographics Extraction', () => {
    it('should extract age correctly', () => {
      const testCases = [
        { message: "I'm 25 years old", expected: 25 },
        { message: "I am 30", expected: 30 },
        { message: "My age is 35", expected: 35 }
      ];

      testCases.forEach(({ message, expected }) => {
        const conversation = createConversation([message]);
        const result = conversationService.extractUserInfo(conversation);
        expect(result.age).toBe(expected);
      });
    });

    it('should extract weight and height', () => {
      const conversation = createConversation([
        "I weigh 70kg and I'm 175cm tall"
      ]);
      
      const result = conversationService.extractUserInfo(conversation);
      
      expect(result.weight).toBe(70);
      expect(result.height).toBe(175);
    });

    it('should calculate BMI when both weight and height are available', () => {
      const conversation = createConversation([
        "I weigh 80kg and I'm 180cm tall"
      ]);
      
      const result = conversationService.extractUserInfo(conversation);
      
      expect(result.bmi).toBeCloseTo(24.7, 1);
    });
  });

  describe('Biometrics Extraction', () => {
    it('should extract sleep duration', () => {
      const testCases = [
        { message: "I sleep 8 hours per night", expected: 8 },
        { message: "I get about 7 hours of sleep", expected: 7 },
        { message: "I sleep around 6 hours", expected: 6 }
      ];

      testCases.forEach(({ message, expected }) => {
        const conversation = createConversation([message]);
        const result = conversationService.extractUserInfo(conversation);
        expect(result.sleep_duration).toBe(expected);
      });
    });

    it('should extract daily steps', () => {
      const testCases = [
        { message: "I walk 10000 steps daily", expected: 10000 },
        { message: "I take about 8000 steps per day", expected: 8000 },
        { message: "I walk 12000 steps daily", expected: 12000 }
      ];

      testCases.forEach(({ message, expected }) => {
        const conversation = createConversation([message]);
        const result = conversationService.extractUserInfo(conversation);
        expect(result.daily_steps).toBe(expected);
      });
    });

    it('should extract stress level with standardized values', () => {
      const testCases = [
        { message: "I feel very stressed", expected: "high" },
        { message: "I'm quite relaxed", expected: "low" },
        { message: "I'm feeling overwhelmed", expected: "high" }
      ];

      testCases.forEach(({ message, expected }) => {
        const conversation = createConversation([message]);
        const result = conversationService.extractUserInfo(conversation);
        expect(result.stress_level).toBe(expected);
      });
    });
  });

  describe('Goals and Preferences', () => {
    it('should extract health goals', () => {
      const conversation = createConversation([
        "I want to lose weight and get fit"
      ]);
      
      const result = conversationService.extractUserInfo(conversation);
      
      expect(result.health_goals).toContain('lose weight');
      expect(result.health_goals).toContain('get fit');
    });

    it('should extract activity preferences', () => {
      const conversation = createConversation([
        "I love yoga and running"
      ]);
      
      const result = conversationService.extractUserInfo(conversation);
      
      expect(result.activity_preferences).toContain('yoga');
      expect(result.activity_preferences).toContain('running');
    });
  });

  describe('Unimplemented Features', () => {
    it('should return undefined for unimplemented fields', () => {
      const conversation = createConversation([
        "I take vitamin D and have back pain"
      ]);
      
      const result = conversationService.extractUserInfo(conversation);
      
      // These fields are not implemented yet
      expect(result.medications).toBeUndefined();
      expect(result.injuries).toBeUndefined();
      expect(result.contraindications).toBeUndefined();
      expect(result.resting_heart_rate).toBeUndefined();
      expect(result.nutrition_habits).toBeUndefined();
      expect(result.caffeine_intake).toBeUndefined();
      expect(result.alcohol_intake).toBeUndefined();
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle comprehensive conversation', () => {
      const conversation = createConversation([
        "Hi, I'm Sarah, 28 years old",
        "I weigh 65kg and I'm 170cm tall", 
        "I sleep about 7 hours and walk 8000 steps daily",
        "I feel quite stressed lately",
        "I want to lose weight and improve my sleep"
      ]);
      
      const result = conversationService.extractUserInfo(conversation);
      
      // Check what's actually implemented
      expect(result.age).toBe(28);
      expect(result.weight).toBe(65);
      expect(result.height).toBe(170);
      expect(result.sleep_duration).toBe(7);
      expect(result.daily_steps).toBe(8000);
      expect(result.stress_level).toBe('high');
      expect(result.health_goals).toContain('lose weight');
      expect(result.bmi).toBeCloseTo(22.5, 1);
    });
  });
});
