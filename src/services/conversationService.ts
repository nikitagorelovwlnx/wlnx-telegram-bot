import OpenAI from 'openai';
import { config } from '../config';
import { ConversationMessage } from '../types';
import { logger } from '../utils/logger';
import { 
  CONVERSATION_PERSONA_PROMPT, 
  FIRST_MESSAGE_CONTEXT,
  CONVERSATION_SYSTEM_PROMPT 
} from '../prompts/conversationPrompts';
import { 
  WELLNESS_SUMMARY_SYSTEM_PROMPT,
  generateWellnessSummaryPrompt 
} from '../prompts/summaryPrompts';

class ConversationService {
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey,
      });
    } else {
      logger.warn('OpenAI API key not provided. Conversation features will not be available.');
    }
  }

  private getPersonaSystemPrompt(): string {
    return CONVERSATION_PERSONA_PROMPT;
  }

  async generateResponse(messages: ConversationMessage[], isFirstMessage: boolean = false): Promise<string> {
    if (!this.openai) {
      return 'Sorry, I\'m having connection issues right now 😔 Try texting me a bit later';
    }

    try {
      const systemMessage: ConversationMessage = {
        role: 'system',
        content: this.getPersonaSystemPrompt(),
        timestamp: new Date().toISOString()
      };

      let conversationMessages = [systemMessage, ...messages];

      // If this is the first message, add an acquaintance context
      if (isFirstMessage) {
        const contextMessage: ConversationMessage = {
          role: 'system',
          content: FIRST_MESSAGE_CONTEXT,
          timestamp: new Date().toISOString()
        };
        conversationMessages.splice(1, 0, contextMessage);
      }

      const openaiMessages = conversationMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await this.openai.chat.completions.create({
        model: config.openaiModel,
        messages: openaiMessages,
        max_tokens: 300,
        temperature: 0.8,
        presence_penalty: 0.2,
        frequency_penalty: 0.1
      });

      const assistantMessage = response.choices[0]?.message?.content;
      
      if (!assistantMessage) {
        return 'Hmm, I paused for a moment... 🤔 Could you repeat that?';
      }

      logger.debug('Conversation response generated', {
        model: config.openaiModel,
        tokensUsed: response.usage?.total_tokens,
        isFirstMessage
      });

      return assistantMessage;

    } catch (error) {
      logger.error('Error generating conversation response', error);
      return 'Sorry, something went wrong 😅 Can you try again?';
    }
  }

  // Extract user information from conversation messages
  extractUserInfo(conversation: ConversationMessage[]): {
    // Demographics and Baseline
    age?: number;
    gender?: string;
    weight?: number;
    height?: number;
    bmi?: number;
    waist_circumference?: number;
    location?: string;
    timezone?: string;
    
    // Biometrics and Habits
    daily_steps?: number;
    sleep_duration?: number;
    sleep_quality?: string;
    sleep_regularity?: string;
    hrv?: number;
    resting_heart_rate?: number;
    stress_level?: string;
    hydration_level?: string;
    nutrition_habits?: string[];
    caffeine_intake?: string;
    alcohol_intake?: string;
    
    // Lifestyle Context
    work_schedule?: string;
    workload?: string;
    business_travel?: boolean;
    night_shifts?: boolean;
    cognitive_load?: string;
    family_obligations?: string[];
    recovery_resources?: string[];
    
    // Medical History
    chronic_conditions?: string[];
    injuries?: string[];
    contraindications?: string[];
    medications?: string[];
    supplements?: string[];
    
    // Personal Goals and Preferences
    health_goals?: string[];
    motivation_level?: string;
    morning_evening_type?: string;
    activity_preferences?: string[];
    coaching_style_preference?: string;
    lifestyle_factors?: string[];
    interests?: string[];
  } {
    const userInfo = {
      // Demographics
      age: undefined as number | undefined,
      gender: undefined as string | undefined,
      weight: undefined as number | undefined,
      height: undefined as number | undefined,
      bmi: undefined as number | undefined,
      waist_circumference: undefined as number | undefined,
      location: undefined as string | undefined,
      timezone: undefined as string | undefined,
      
      // Biometrics
      daily_steps: undefined as number | undefined,
      sleep_duration: undefined as number | undefined,
      sleep_quality: undefined as string | undefined,
      sleep_regularity: undefined as string | undefined,
      hrv: undefined as number | undefined,
      resting_heart_rate: undefined as number | undefined,
      stress_level: undefined as string | undefined,
      hydration_level: undefined as string | undefined,
      nutrition_habits: [] as string[],
      caffeine_intake: undefined as string | undefined,
      alcohol_intake: undefined as string | undefined,
      
      // Lifestyle
      work_schedule: undefined as string | undefined,
      workload: undefined as string | undefined,
      business_travel: undefined as boolean | undefined,
      night_shifts: undefined as boolean | undefined,
      cognitive_load: undefined as string | undefined,
      family_obligations: [] as string[],
      recovery_resources: [] as string[],
      
      // Medical
      chronic_conditions: [] as string[],
      injuries: [] as string[],
      contraindications: [] as string[],
      medications: [] as string[],
      supplements: [] as string[],
      
      // Goals and Preferences
      health_goals: [] as string[],
      motivation_level: undefined as string | undefined,
      morning_evening_type: undefined as string | undefined,
      activity_preferences: [] as string[],
      coaching_style_preference: undefined as string | undefined,
      lifestyle_factors: [] as string[],
      interests: [] as string[]
    };

    const userMessages = conversation
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content.toLowerCase());

    const allText = userMessages.join(' ');

    // Extract demographics
    const agePatterns = [
      /i'm (\d{1,2})/i,
      /(\d{1,2})\s*(years old|year old)/i,
      /age.{0,10}(\d{1,2})/i,
      /turn (\d{1,2})/i
    ];

    for (const pattern of agePatterns) {
      const match = allText.match(pattern);
      if (match) {
        const age = parseInt(match[1]);
        if (age >= 10 && age <= 120) {
          userInfo.age = age;
          break;
        }
      }
    }

    // Extract gender
    const genderPatterns = [
      /i'm (male|female|man|woman|guy|girl)/i,
      /(male|female|man|woman|guy|girl)/i
    ];
    for (const pattern of genderPatterns) {
      const match = allText.match(pattern);
      if (match) {
        userInfo.gender = match[1].toLowerCase();
        break;
      }
    }

    // Extract weight
    const weightPatterns = [
      /weigh (\d+)\s*(lbs?|pounds?|kg|kilos?)/i,
      /(\d+)\s*(lbs?|pounds?|kg|kilos?)/i,
      /weight.{0,10}(\d+)/i
    ];
    for (const pattern of weightPatterns) {
      const match = allText.match(pattern);
      if (match) {
        userInfo.weight = parseInt(match[1]);
        break;
      }
    }

    // Extract height
    const heightPatterns = [
      /(\d+)'(\d+)"/i, // 5'8"
      /(\d+)\s*feet?\s*(\d+)\s*inch/i,
      /(\d+)\s*ft\s*(\d+)\s*in/i,
      /(\d+\.\d+)\s*m/i, // 1.75m
      /(\d+)\s*cm/i
    ];
    for (const pattern of heightPatterns) {
      const match = allText.match(pattern);
      if (match) {
        if (match[2]) { // feet and inches
          const feet = parseInt(match[1]);
          const inches = parseInt(match[2]);
          userInfo.height = feet * 12 + inches; // convert to inches
        } else {
          userInfo.height = parseFloat(match[1]);
        }
        break;
      }
    }

    // Extract location and timezone
    const locationPatterns = [
      /live in (.+?)(?:\s|$|,|\.|!|\?)/i,
      /from (.+?)(?:\s|$|,|\.|!|\?)/i,
      /in (.+?)(?:\s|$|,|\.|!|\?)/i,
      /(new york|los angeles|chicago|houston|phoenix|philadelphia|san antonio|san diego|dallas|san jose|austin|jacksonville|san francisco|columbus|charlotte|fort worth|detroit|el paso|memphis|seattle|denver|washington|boston|nashville|baltimore|oklahoma city|portland|las vegas|milwaukee|albuquerque|tucson|fresno|sacramento|mesa|kansas city|atlanta|omaha|colorado springs|raleigh|miami|virginia beach|oakland|minneapolis|tulsa|arlington|new orleans|wichita|cleveland|tampa|bakersfield|aurora|anaheim|honolulu|santa ana|corpus christi|riverside|lexington|stockton|henderson|saint paul|st paul|cincinnati|pittsburgh|greensboro|plano|lincoln|orlando|irvine|newark|toledo|jersey city|chula vista|durham|fort wayne|st petersburg|laredo|buffalo|madison|lubbock|chandler|scottsdale|glendale|norfolk|north las vegas|irving|fremont|birmingham|rochester|san bernardino|spokane|gilbert|arlington|montgomery|baton rouge|richmond|des moines|modesto|fayetteville|shreveport|akron|tacoma|aurora|oxnard|fontana|yonkers|augusta|mobile|little rock|amarillo|moreno valley|glendale|huntington beach|columbus|grand rapids|salt lake city|tallahassee|worcester|newport news|huntsville|knoxville|providence|fort lauderdale|vancouver|burnaby|calgary|edmonton|halifax|hamilton|kitchener|london|markham|mississauga|montreal|ottawa|quebec city|regina|richmond|saskatoon|surrey|toronto|vancouver|victoria|windsor|winnipeg)/i
    ];

    for (const pattern of locationPatterns) {
      const match = allText.match(pattern);
      if (match && match[1]) {
        userInfo.location = match[1].trim();
        break;
      }
    }

    // Extract timezone
    const timezonePatterns = [
      /(pst|pdt|est|edt|cst|cdt|mst|mdt)/i,
      /timezone.{0,10}(utc[+-]\d+)/i,
      /(eastern|western|central|mountain|pacific)\s*time/i
    ];
    for (const pattern of timezonePatterns) {
      const match = allText.match(pattern);
      if (match) {
        userInfo.timezone = match[1];
        break;
      }
    }

    // Extract biometrics and habits
    const sleepPatterns = [
      /sleep\s*(?:about|around)?\s*(\d+)\s*hours?/i,
      /(\d+)\s*hours?\s*(?:of\s*)?sleep/i,
      /get\s*(?:about|around)?\s*(\d+)\s*hours?/i
    ];
    for (const pattern of sleepPatterns) {
      const match = allText.match(pattern);
      if (match) {
        userInfo.sleep_duration = parseInt(match[1]);
        break;
      }
    }

    // Extract steps
    const stepPatterns = [
      /(\d+)\s*steps/i,
      /walk (\d+)/i
    ];
    for (const pattern of stepPatterns) {
      const match = allText.match(pattern);
      if (match) {
        userInfo.daily_steps = parseInt(match[1]);
        break;
      }
    }

    // Extract heart rate
    const hrPatterns = [
      /heart rate.{0,10}(\d+)/i,
      /resting.{0,10}(\d+)/i,
      /(\d+)\s*bpm/i
    ];
    for (const pattern of hrPatterns) {
      const match = allText.match(pattern);
      if (match) {
        const hr = parseInt(match[1]);
        if (hr >= 40 && hr <= 200) {
          userInfo.resting_heart_rate = hr;
          break;
        }
      }
    }

    // Extract stress level
    const stressPatterns = [
      /stress.{0,20}(high|low|medium|moderate|very high|very low)/i,
      /(stressed|overwhelmed|calm|relaxed)/i
    ];
    for (const pattern of stressPatterns) {
      const match = allText.match(pattern);
      if (match) {
        userInfo.stress_level = match[1];
        break;
      }
    }

    // Extract work schedule and lifestyle
    const workPatterns = [
      /work (\d+)\s*hours?/i,
      /(9\s*to\s*5|nine\s*to\s*five)/i,
      /(night\s*shift|overnight)/i,
      /(remote|office|hybrid)/i
    ];
    for (const pattern of workPatterns) {
      const match = allText.match(pattern);
      if (match) {
        if (match[0].includes('night') || match[0].includes('overnight')) {
          userInfo.night_shifts = true;
        }
        userInfo.work_schedule = match[0];
        break;
      }
    }

    // Extract morning/evening preference
    const chronotypePatterns = [
      /(morning\s*person|early\s*bird)/i,
      /(night\s*owl|evening\s*person)/i
    ];
    for (const pattern of chronotypePatterns) {
      const match = allText.match(pattern);
      if (match) {
        userInfo.morning_evening_type = match[0].includes('morning') || match[0].includes('early') ? 'morning' : 'evening';
        break;
      }
    }

    // Extract goals, interests, and preferences
    const goalKeywords = [
      'lose weight', 'gain muscle', 'get fit', 'improve health', 'reduce stress',
      'sleep better', 'improve sleep', 'more energy', 'feel better', 'get stronger', 'lose fat',
      'work-life balance', 'boost productivity', 'manage stress'
    ];

    const activityKeywords = [
      'yoga', 'running', 'gym', 'cycling', 'swimming', 'hiking', 'dancing',
      'meditation', 'walking', 'sports', 'strength training', 'cardio'
    ];

    const nutritionKeywords = [
      'vegetarian', 'vegan', 'keto', 'paleo', 'intermittent fasting',
      'meal prep', 'organic', 'gluten free'
    ];

    const familyKeywords = [
      'kids', 'children', 'family', 'married', 'spouse', 'partner',
      'caregiver', 'parent', 'single parent'
    ];

    const recoveryKeywords = [
      'massage', 'spa', 'sauna', 'gym access', 'personal trainer',
      'meditation app', 'therapy', 'counseling'
    ];

    userMessages.forEach(message => {
      goalKeywords.forEach(goal => {
        if (message.includes(goal)) {
          userInfo.health_goals.push(goal);
        }
      });

      activityKeywords.forEach(activity => {
        if (message.includes(activity)) {
          userInfo.activity_preferences.push(activity);
        }
      });

      nutritionKeywords.forEach(nutrition => {
        if (message.includes(nutrition)) {
          userInfo.nutrition_habits.push(nutrition);
        }
      });

      familyKeywords.forEach(family => {
        if (message.includes(family)) {
          userInfo.family_obligations.push(family);
        }
      });

      recoveryKeywords.forEach(recovery => {
        if (message.includes(recovery)) {
          userInfo.recovery_resources.push(recovery);
        }
      });

      // Extract caffeine and alcohol intake
      if (message.includes('coffee') || message.includes('caffeine')) {
        const caffeineMatch = message.match(/(\d+)\s*(cups?|shots?)\s*(coffee|espresso)/i);
        if (caffeineMatch) {
          userInfo.caffeine_intake = caffeineMatch[0];
        } else {
          userInfo.caffeine_intake = 'drinks coffee';
        }
      }

      if (message.includes('alcohol') || message.includes('drink') || message.includes('wine') || message.includes('beer')) {
        const alcoholMatch = message.match(/(\d+)\s*(drinks?|glasses?|beers?)\s*(per|a)\s*(day|week)/i);
        if (alcoholMatch) {
          userInfo.alcohol_intake = alcoholMatch[0];
        } else {
          userInfo.alcohol_intake = 'drinks alcohol';
        }
      }

      // Extract motivation level
      if (message.includes('motivated') || message.includes('motivation')) {
        const motivationMatch = message.match(/(very|highly|not|low|medium|high)\s*(motivated|motivation)/i);
        if (motivationMatch) {
          userInfo.motivation_level = motivationMatch[1];
        }
      }
    });

    // Check for medications
    const medications = [
      'medication', 'medicine', 'pill', 'prescription', 'drug', 'supplement',
      'vitamin', 'aspirin', 'ibuprofen', 'tylenol', 'advil', 'insulin',
      'blood pressure', 'cholesterol', 'antidepressant', 'antibiotic'
    ];
    
    userMessages.forEach(message => {
      medications.forEach(med => {
        if (message.includes(med)) {
          const sentences = message.split(/[.!?]+/);
          sentences.forEach(sentence => {
            if (sentence.includes(med) && sentence.trim().length > 5) {
              userInfo.medications.push(sentence.trim());
            }
          });
        }
      });

      // Check for injuries
      const injuries = [
        'injury', 'injured', 'hurt', 'pain', 'back pain', 'knee pain',
        'shoulder pain', 'neck pain', 'sprained', 'broken', 'fracture',
        'torn', 'surgery', 'operation', 'physical therapy'
      ];
      
      injuries.forEach(injury => {
        if (message.includes(injury)) {
          const sentences = message.split(/[.!?]+/);
          sentences.forEach(sentence => {
            if (sentence.includes(injury) && sentence.trim().length > 5) {
              userInfo.injuries.push(sentence.trim());
            }
          });
        }
      });

      // Check for contraindications
      const contraindications = [
        'cannot', 'can\'t', 'forbidden', 'doctor said', 'not allowed',
        'restricted', 'avoid', 'shouldn\'t', 'prohibited'
      ];
      contraindications.forEach(contra => {
        if (message.includes(contra)) {
          const sentences = message.split(/[.!?]+/);
          sentences.forEach(sentence => {
            if (sentence.includes(contra) && sentence.trim().length > 5) {
              userInfo.contraindications.push(sentence.trim());
            }
          });
        }
      });
    });

    // Extract additional lifestyle factors
    const lifestyleKeywords = [
      'work from home', 'office job', 'desk job', 'sedentary', 'active job',
      'smoke', 'don\'t smoke', 'quit smoking', 'drink alcohol', 'don\'t drink',
      'poor sleep', 'sleep problems', 'insomnia', 'night shift', 'travel frequently'
    ];

    userMessages.forEach(message => {
      lifestyleKeywords.forEach(lifestyle => {
        if (message.includes(lifestyle)) {
          userInfo.lifestyle_factors.push(lifestyle);
        }
      });
    });

    // Remove duplicates from all arrays
    userInfo.contraindications = [...new Set(userInfo.contraindications)];
    userInfo.health_goals = [...new Set(userInfo.health_goals)];
    userInfo.lifestyle_factors = [...new Set(userInfo.lifestyle_factors)];
    userInfo.medications = [...new Set(userInfo.medications)];
    userInfo.injuries = [...new Set(userInfo.injuries)];
    userInfo.activity_preferences = [...new Set(userInfo.activity_preferences)];
    userInfo.nutrition_habits = [...new Set(userInfo.nutrition_habits)];
    userInfo.family_obligations = [...new Set(userInfo.family_obligations)];
    userInfo.recovery_resources = [...new Set(userInfo.recovery_resources)];

    // Calculate BMI if we have weight and height
    if (userInfo.weight && userInfo.height) {
      // Check if values seem to be in metric (kg/cm) or imperial (lbs/inches)
      const isMetric = userInfo.weight < 300 && userInfo.height > 100; // kg and cm
      
      let weightKg: number;
      let heightM: number;
      
      if (isMetric) {
        // Values are in kg and cm
        weightKg = userInfo.weight;
        heightM = userInfo.height / 100; // cm to meters
      } else {
        // Values are in lbs and inches
        weightKg = userInfo.weight * 0.453592;
        heightM = userInfo.height * 0.0254;
      }
      
      userInfo.bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;
    }

    return userInfo;
  }

  async generateWellnessSummary(conversationHistory: ConversationMessage[]): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI service not available');
    }

    // Extract user info first
    const extractedUserInfo = this.extractUserInfo(conversationHistory);

    // Create transcription
    const transcription = conversationHistory
      .map(msg => `${msg.role === 'user' ? 'User' : 'Anna'}: ${msg.content}`)
      .join('\n\n');

    // Generate enhanced prompt with extracted data
    const summaryPrompt = generateWellnessSummaryPrompt(transcription, extractedUserInfo);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: WELLNESS_SUMMARY_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: summaryPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2500
      });

      return response.choices[0]?.message?.content || 'Unable to generate summary';
    } catch (error) {
      logger.error('Error generating wellness summary:', error);
      throw error;
    }
  }

  isAvailable(): boolean {
    return this.openai !== null;
  }
}

export const conversationService = new ConversationService();
