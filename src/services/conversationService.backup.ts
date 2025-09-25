import OpenAI from 'openai';
import { config } from '../config';
import { ConversationMessage, WellnessData } from '../types';
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
  extractUserInfo(conversation: ConversationMessage[]): WellnessData {
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

    // Enhanced age extraction with natural language support
    const agePatterns = [
      // Direct statements
      /(?:i'?m|i am|i'm|im)\s*(?:a\s*)?(\d{1,3})\s*(?:years?\s*old|yrs?\s*old|y\.?o\.?)?/i,
      /(?:age|aged?)\s*(?:is|of|:)?\s*(\d{1,3})/i,
      /(\d{1,3})\s*(?:years?\s*old|yrs?\s*old|y\.?o\.?)/i,
      /(?:turn(?:ed|ing)?|will be|gonna be)\s*(\d{1,3})/i,
      /(?:born in|birth year)\s*(\d{4})/i, // Calculate from birth year
      /(\d{1,3})\s*(?:year|yr)\s*old/i,
      /(?:just|recently|about)\s*(?:turned|became)\s*(\d{1,3})/i,
      // Informal expressions
      /(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s\-]?(?:one|two|three|four|five|six|seven|eight|nine)?/i,
      // Early/mid/late twenties etc
      /(?:early|mid|late)\s*(twenties|thirties|forties|fifties|sixties)/i
    ];

    for (const pattern of agePatterns) {
      const match = allText.match(pattern);
      if (match) {
        let age = 0;
        
        // Handle birth year
        if (match[0].includes('born') || match[0].includes('birth')) {
          const currentYear = new Date().getFullYear();
          age = currentYear - parseInt(match[1]);
        }
        // Handle word numbers
        else if (match[0].match(/twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety/i)) {
          age = this.parseAgeFromWords(match[0]);
        }
        // Handle early/mid/late
        else if (match[0].match(/early|mid|late/i)) {
          age = this.parseRangeAge(match[0]);
        }
        // Handle regular numbers
        else {
          age = parseInt(match[1]);
        }
        
        console.log('🔍 Age extraction:', { pattern: pattern.source, match: match[0], extractedAge: age, text: allText.substring(0, 100) });
        if (age >= 13 && age <= 120) { // More inclusive range
          userInfo.age = age;
          console.log('✅ Age saved to userInfo:', age);
          break;
        }
      }
    }

    // Enhanced gender extraction
    const genderPatterns = [
      /(?:i'?m|i am|i'm|im)\s*(?:a\s*)?(male|female|man|woman|guy|girl|boy|dude|lady|gentleman)/i,
      /(?:gender|sex)\s*(?:is|:)?\s*(male|female|man|woman|m|f)/i,
      /(male|female|man|woman|guy|girl|boy|dude|lady|gentleman)\s*(?:here|speaking|myself)/i,
      /(?:identify as|consider myself)\s*(?:a\s*)?(male|female|man|woman|non-binary|nb)/i,
      // Handle pronouns
      /(?:my pronouns are|use)\s*(he\/him|she\/her|they\/them)/i,
      // Context clues
      /(?:husband|wife|boyfriend|girlfriend|mr|mrs|ms)/i
    ];
    
    for (const pattern of genderPatterns) {
      const match = allText.match(pattern);
      if (match) {
        let gender = match[1]?.toLowerCase();
        
        // Normalize gender values
        if (['he/him', 'man', 'male', 'guy', 'boy', 'dude', 'gentleman', 'husband', 'boyfriend', 'mr'].includes(gender) || 
            allText.includes('husband') || allText.includes('boyfriend') || allText.includes(' mr ')) {
          userInfo.gender = 'male';
        } else if (['she/her', 'woman', 'female', 'girl', 'lady', 'wife', 'girlfriend', 'mrs', 'ms'].includes(gender) ||
                   allText.includes('wife') || allText.includes('girlfriend') || allText.includes(' mrs ') || allText.includes(' ms ')) {
          userInfo.gender = 'female';
        } else if (['they/them', 'non-binary', 'nb'].includes(gender)) {
          userInfo.gender = 'non-binary';
        } else if (gender && gender.length > 0) {
          userInfo.gender = gender;
        }
        
        if (userInfo.gender) break;
      }
    }

    // Enhanced weight extraction with better natural language support
    const weightPatterns = [
      // Direct statements
      /(?:i\s*)?(?:weigh|weight is|weight:|my weight)\s*(?:about|around|approximately)?\s*(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?|kgs?)/i,
      /(?:weight|weigh)\s*(?:about|around|roughly|approximately)?\s*(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?|kgs?)/i,
      /(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?|kgs?)\s*(?:in weight|heavy|weight)/i,
      // Contextual mentions
      /lost\s*(?:about|around)?\s*(\d+)\s*(lbs?|pounds?|kg|kilos?)/i,
      /gained?\s*(?:about|around)?\s*(\d+)\s*(lbs?|pounds?|kg|kilos?)/i,
      /(?:current|now)\s*(?:weigh|weight)\s*(?:is)?\s*(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?)/i,
      // Numbers with context
      /(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?|kgs?)(?:\s*(?:now|currently|today))?/i
    ];
    
    for (const pattern of weightPatterns) {
      const match = allText.match(pattern);
      if (match) {
        let weight = parseFloat(match[1]);
        const unit = match[2]?.toLowerCase();
        
        // Convert to kg if needed
        if (unit && (unit.includes('lb') || unit.includes('pound'))) {
          weight = Math.round(weight * 0.453592 * 10) / 10; // Convert lbs to kg
        }
        
        // Validate weight range (30kg to 300kg)
        if (weight >= 30 && weight <= 300) {
          userInfo.weight = weight;
          break;
        }
      }
    }

    // Enhanced height extraction with natural language support
    const heightPatterns = [
      // Imperial formats
      /(?:i'?m|i am|height is|height:|my height)\s*(?:about|around|approximately)?\s*(\d+)(?:'|ft|feet)\s*(\d+)(?:"|in|inch|inches)?/i,
      /(\d+)\s*(?:foot|feet|ft|')\s*(?:and\s*)?(\d+)\s*(?:inch|inches|in|")/i,
      /(\d+)'(\d+)"/i, // 5'8"
      /(\d+)\s*feet?\s*(\d+)\s*inch/i,
      /(\d+)\s*ft\s*(\d+)\s*in/i,
      
      // Metric formats  
      /(?:i'?m|i am|height is|height:|my height)\s*(?:about|around|approximately)?\s*(\d+(?:\.\d+)?)\s*(?:meters?|m)/i,
      /(?:i'?m|i am|height is|height:|my height)\s*(?:about|around|approximately)?\s*(\d+)\s*(?:centimeters?|cm)/i,
      /(\d+\.\d+)\s*(?:meters?|m)(?:\s*tall)?/i, // 1.75m
      /(\d+)\s*(?:centimeters?|cm)(?:\s*tall)?/i,
      
      // Casual mentions
      /(?:about|around|roughly)\s*(\d+)\s*(?:foot|feet|ft)/i,
      /(?:tall|height)\s*(?:is|of|:)?\s*(?:about|around)?\s*(\d+(?:\.\d+)?)\s*(?:meters?|m|cm|centimeters?)/i,
      /(?:tall|height)\s*(?:is|of|:)?\s*(?:about|around)?\s*(\d+)(?:'|ft|feet)\s*(\d+)?/i
    ];
    
    for (const pattern of heightPatterns) {
      const match = allText.match(pattern);
      if (match) {
        let heightInCm = 0;
        
        if (match[2] !== undefined) {
          // feet and inches format
          const feet = parseInt(match[1]);
          const inches = parseInt(match[2]) || 0;
          heightInCm = Math.round((feet * 12 + inches) * 2.54); // convert to cm
        } else if (match[0].includes('m') && !match[0].includes('cm')) {
          // meters format
          heightInCm = Math.round(parseFloat(match[1]) * 100);
        } else if (match[0].includes('cm')) {
          // centimeters format
          heightInCm = parseInt(match[1]);
        } else if (match[0].includes('ft') || match[0].includes('feet') || match[0].includes('foot')) {
          // feet only format
          heightInCm = Math.round(parseInt(match[1]) * 12 * 2.54);
        }
        
        // Validate height range (100cm to 250cm)
        if (heightInCm >= 100 && heightInCm <= 250) {
          userInfo.height = heightInCm;
          break;
        }
      }
    }

    // Enhanced sleep duration extraction
    const sleepPatternsEnhanced = [
      /(?:i\s*)?(?:sleep|get|have)\s*(?:about|around|roughly|approximately)?\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:of\s*sleep|per\s*night|each\s*night|a\s*night)?/i,
      /(?:sleep|rest)\s*(?:for|about|around)?\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i,
      /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:of\s*)?(?:sleep|rest)/i,
      /(?:bedtime|sleep\s*schedule|sleep\s*pattern)\s*(?:is|:)?\s*(?:about|around)?\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i,
      // Handle ranges like "7-8 hours"
      /(?:sleep|get|have)\s*(?:between|about)?\s*(\d+)(?:\s*to\s*|-\s*)(\d+)\s*(?:hours?|hrs?)/i,
      // Casual mentions
      /(?:usually|typically|normally|generally)\s*(?:sleep|get)\s*(?:about|around)?\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i,
      /(?:need|require)\s*(?:about|around)?\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:of\s*sleep|to\s*sleep)/i
    ];
    
    for (const pattern of sleepPatternsEnhanced) {
      const match = allText.match(pattern);
      if (match) {
        let sleepHours = 0;
        
        if (match[2]) {
          // Handle range like "7-8 hours" - take average
          sleepHours = (parseInt(match[1]) + parseInt(match[2])) / 2;
        } else {
          sleepHours = parseFloat(match[1]);
        }
        
        // Validate sleep duration (3-12 hours)
        if (sleepHours >= 3 && sleepHours <= 12) {
          userInfo.sleep_duration = sleepHours;
          break;
        }
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
    const sleepPatternsSimple = [
      /sleep\s*(?:about|around)?\s*(\d+)\s*hours?/i,
      /(\d+)\s*hours?\s*(?:of\s*)?sleep/i,
      /get\s*(?:about|around)?\s*(\d+)\s*hours?/i
    ];
    for (const pattern of sleepPatternsSimple) {
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

    // Debug: Log final extraction results
    const filledFields = Object.keys(userInfo).filter(key => {
      const value = (userInfo as any)[key];
      return value !== undefined && value !== null && (Array.isArray(value) ? value.length > 0 : value !== '');
    });
    console.log('🎯 Final extractUserInfo result:', { 
      totalFields: Object.keys(userInfo).length, 
      filledFields: filledFields.length, 
      fields: filledFields,
      age: userInfo.age,
      userInfoSample: { age: userInfo.age, gender: userInfo.gender, location: userInfo.location }
    });

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

  // Helper method to parse ages from words like "twenty-five"
  private parseAgeFromWords(text: string): number {
    const wordToNumber = {
      'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 
      'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9
    };
    
    let total = 0;
    const words = text.toLowerCase().split(/[\s\-]/);
    
    for (const word of words) {
      if (wordToNumber[word as keyof typeof wordToNumber]) {
        total += wordToNumber[word as keyof typeof wordToNumber];
      }
    }
    
    return total;
  }

  // Helper method to parse range ages like "early twenties"
  private parseRangeAge(text: string): number {
    const lower = text.toLowerCase();
    
    if (lower.includes('twenties')) {
      if (lower.includes('early')) return 22;
      if (lower.includes('mid')) return 25;
      if (lower.includes('late')) return 28;
      return 25; // default mid-twenties
    }
    if (lower.includes('thirties')) {
      if (lower.includes('early')) return 32;
      if (lower.includes('mid')) return 35;
      if (lower.includes('late')) return 38;
      return 35;
    }
    if (lower.includes('forties')) {
      if (lower.includes('early')) return 42;
      if (lower.includes('mid')) return 45;
      if (lower.includes('late')) return 48;
      return 45;
    }
    if (lower.includes('fifties')) {
      if (lower.includes('early')) return 52;
      if (lower.includes('mid')) return 55;
      if (lower.includes('late')) return 58;
      return 55;
    }
    
    return 0;
  }

  isAvailable(): boolean {
    return this.openai !== null;
  }
}

export const conversationService = new ConversationService();
