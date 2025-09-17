/**
 * Tests for User Info Extraction
 */

import { conversationService } from '../../services/conversationService';
import { ConversationMessage } from '../../types';

describe('User Info Extraction', () => {
  const createConversation = (messages: string[]): ConversationMessage[] => {
    return messages.map((content, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content,
      timestamp: new Date(2023, 11, 1, 10, index).toISOString()
    }));
  };

  describe('Demographics Extraction', () => {
    it('should extract age from various formats', () => {
      const testCases = [
        "I'm 25 years old",
        "I am 30",
        "I'm 35 year old", 
        "My age is 28",
        "I turn 40 next month"
      ];

      testCases.forEach((message, index) => {
        const conversation = createConversation([message]);
        const result = conversationService.extractUserInfo(conversation);
        
        const expectedAges = [25, 30, 35, 28, 40];
        expect(result.age).toBe(expectedAges[index]);
      });
    });

    it('should extract gender correctly', () => {
      const testCases = [
        { message: "I'm a male", expected: "male" },
        { message: "I am female", expected: "female" },
        { message: "I'm a woman", expected: "woman" },
        { message: "I'm a guy", expected: "guy" }
      ];

      testCases.forEach(({ message, expected }) => {
        const conversation = createConversation([message]);
        const result = conversationService.extractUserInfo(conversation);
        expect(result.gender).toBe(expected);
      });
    });

    it('should extract weight in different units', () => {
      const testCases = [
        { message: "I weigh 70kg", expected: 70 },
        { message: "My weight is 150 lbs", expected: 150 },
        { message: "I'm 65 kilos", expected: 65 },
        { message: "I weigh 140 pounds", expected: 140 }
      ];

      testCases.forEach(({ message, expected }) => {
        const conversation = createConversation([message]);
        const result = conversationService.extractUserInfo(conversation);
        expect(result.weight).toBe(expected);
      });
    });

    it('should extract height in various formats', () => {
      const testCases = [
        { message: "I'm 5'8\"", expectedInches: 68 },
        { message: "I am 6 feet 2 inches", expectedInches: 74 },
        { message: "I'm 175cm tall", expected: 175 },
        { message: "My height is 1.75m", expected: 1.75 }
      ];

      testCases.forEach(({ message, expectedInches, expected }) => {
        const conversation = createConversation([message]);
        const result = conversationService.extractUserInfo(conversation);
        expect(result.height).toBe(expectedInches || expected);
      });
    });

    it('should calculate BMI when both weight and height are available', () => {
      const conversation = createConversation([
        "I weigh 70kg and I'm 175cm tall"
      ]);
      
      const result = conversationService.extractUserInfo(conversation);
      
      expect(result.weight).toBe(70);
      expect(result.height).toBe(175);
      expect(result.bmi).toBeCloseTo(22.9, 1);
    });
  });

  describe('Biometrics & Habits Extraction', () => {
    it('should extract sleep duration', () => {
      const testCases = [
        { message: "I sleep 7 hours per night", expected: 7 },
        { message: "I get 8 hours sleep", expected: 8 },
        { message: "Sleep about 6 hours", expected: 6 }
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
        { message: "My daily steps are 8500", expected: 8500 },
        { message: "I walk about 12000 steps", expected: 12000 }
      ];

      testCases.forEach(({ message, expected }) => {
        const conversation = createConversation([message]);
        const result = conversationService.extractUserInfo(conversation);
        expect(result.daily_steps).toBe(expected);
      });
    });

    it('should extract heart rate information', () => {
      const testCases = [
        { message: "My resting heart rate is 65 bpm", expected: 65 },
        { message: "Heart rate around 70", expected: 70 },
        { message: "Resting HR is 60", expected: 60 }
      ];

      testCases.forEach(({ message, expected }) => {
        const conversation = createConversation([message]);
        const result = conversationService.extractUserInfo(conversation);
        expect(result.resting_heart_rate).toBe(expected);
      });
    });

    it('should extract stress level', () => {
      const testCases = [
        { message: "I feel very stressed lately", expected: "very" },
        { message: "My stress level is high", expected: "high" },
        { message: "I'm feeling overwhelmed", expected: "overwhelmed" },
        { message: "I'm quite relaxed", expected: "relaxed" }
      ];

      testCases.forEach(({ message, expected }) => {
        const conversation = createConversation([message]);
        const result = conversationService.extractUserInfo(conversation);
        expect(result.stress_level).toBe(expected);
      });
    });
  });

  describe('Lifestyle Context Extraction', () => {
    it('should detect work schedule patterns', () => {
      const testCases = [
        { message: "I work 8 hours a day", schedule: "work 8 hours" },
        { message: "I have a 9 to 5 job", schedule: "9 to 5" },
        { message: "I work night shifts", schedule: "night shift", nightShifts: true },
        { message: "I work remotely", schedule: "remote" }
      ];

      testCases.forEach(({ message, schedule, nightShifts }) => {
        const conversation = createConversation([message]);
        const result = conversationService.extractUserInfo(conversation);
        expect(result.work_schedule).toContain(schedule);
        if (nightShifts) {
          expect(result.night_shifts).toBe(true);
        }
      });
    });

    it('should extract chronotype preferences', () => {
      const testCases = [
        { message: "I'm a morning person", expected: "morning" },
        { message: "I'm an early bird", expected: "morning" },
        { message: "I'm a night owl", expected: "evening" },
        { message: "I'm an evening person", expected: "evening" }
      ];

      testCases.forEach(({ message, expected }) => {
        const conversation = createConversation([message]);
        const result = conversationService.extractUserInfo(conversation);
        expect(result.morning_evening_type).toBe(expected);
      });
    });
  });

  describe('Medical & Health Extraction', () => {
    it('should extract medication information', () => {
      const conversation = createConversation([
        "I take vitamin D supplements and blood pressure medication"
      ]);
      
      const result = conversationService.extractUserInfo(conversation);
      
      expect(result.medications).toEqual(
        expect.arrayContaining([
          expect.stringContaining('vitamin d'),
          expect.stringContaining('blood pressure')
        ])
      );
    });

    it('should extract injury information', () => {
      const conversation = createConversation([
        "I have chronic back pain from an old sports injury"
      ]);
      
      const result = conversationService.extractUserInfo(conversation);
      
      expect(result.injuries).toEqual(
        expect.arrayContaining([
          expect.stringContaining('back pain')
        ])
      );
    });

    it('should extract contraindications', () => {
      const conversation = createConversation([
        "I can't do high-impact exercises because my doctor said I shouldn't"
      ]);
      
      const result = conversationService.extractUserInfo(conversation);
      
      expect(result.contraindications).toEqual(
        expect.arrayContaining([
          expect.stringContaining("can't do high-impact")
        ])
      );
    });
  });

  describe('Goals & Preferences Extraction', () => {
    it('should extract health goals', () => {
      const conversation = createConversation([
        "I want to lose weight and improve my sleep quality"
      ]);
      
      const result = conversationService.extractUserInfo(conversation);
      
      expect(result.health_goals).toContain('lose weight');
      expect(result.health_goals).toContain('improve sleep');
    });

    it('should extract activity preferences', () => {
      const conversation = createConversation([
        "I love yoga and running, sometimes I go swimming"
      ]);
      
      const result = conversationService.extractUserInfo(conversation);
      
      expect(result.activity_preferences).toBeDefined();
      expect(result.activity_preferences!).toContain('yoga');
      expect(result.activity_preferences!).toContain('running');
      expect(result.activity_preferences!).toContain('swimming');
    });

    it('should extract nutrition habits', () => {
      const conversation = createConversation([
        "I'm vegetarian and do intermittent fasting"
      ]);
      
      const result = conversationService.extractUserInfo(conversation);
      
      expect(result.nutrition_habits).toContain('vegetarian');
      expect(result.nutrition_habits).toContain('intermittent fasting');
    });

    it('should extract caffeine and alcohol intake', () => {
      const conversation = createConversation([
        "I drink 3 cups of coffee per day and have a glass of wine occasionally"
      ]);
      
      const result = conversationService.extractUserInfo(conversation);
      
      expect(result.caffeine_intake).toContain('3 cups');
      expect(result.alcohol_intake).toBeDefined();
    });
  });

  describe('Data Deduplication', () => {
    it('should remove duplicate entries from arrays', () => {
      const conversation = createConversation([
        "I love yoga",
        "I really enjoy yoga classes",
        "Yoga is my favorite activity"
      ]);
      
      const result = conversationService.extractUserInfo(conversation);
      
      const yogaCount = result.activity_preferences?.filter(pref => pref === 'yoga').length || 0;
      expect(yogaCount).toBe(1);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle comprehensive conversation with multiple data points', () => {
      const conversation = createConversation([
        "Hi, I'm Sarah, 32 years old",
        "Hello Sarah! Tell me about yourself",
        "I weigh 68kg and I'm 165cm tall. I work as a software developer",
        "That's interesting! How's your health?",
        "I sleep about 7 hours per night and walk 9000 steps daily. I feel quite stressed with work",
        "What about your goals?",
        "I want to lose weight and reduce stress. I love yoga and running",
        "Any medical concerns?",
        "I take vitamin D supplements and have some back pain from sitting too much"
      ]);
      
      const result = conversationService.extractUserInfo(conversation);
      
      // Check demographics
      expect(result.age).toBe(32);
      expect(result.weight).toBe(68);
      expect(result.height).toBe(165);
      expect(result.bmi).toBeCloseTo(25.0, 1);
      
      // Check biometrics
      expect(result.sleep_duration).toBe(7);
      expect(result.daily_steps).toBe(9000);
      expect(result.stress_level).toBe('stressed');
      
      // Check goals and preferences
      expect(result.health_goals).toContain('lose weight');
      expect(result.health_goals).toContain('reduce stress');
      expect(result.activity_preferences).toBeDefined();
      expect(result.activity_preferences!).toContain('yoga');
      expect(result.activity_preferences!).toContain('running');
      
      // Check medical info
      expect(result.medications).toEqual(
        expect.arrayContaining([
          expect.stringContaining('vitamin d')
        ])
      );
      expect(result.injuries).toEqual(
        expect.arrayContaining([
          expect.stringContaining('back pain')
        ])
      );
    });
  });
});
