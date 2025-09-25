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

class EnhancedConversationService {
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey,
      });
    } else {
      logger.warn('OpenAI API key not found. Conversation service will be unavailable.');
    }
  }

  async generateResponse(conversation: ConversationMessage[]): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI service not available');
    }

    try {
      const messages = [
        { role: 'system', content: CONVERSATION_SYSTEM_PROMPT },
        { role: 'assistant', content: CONVERSATION_PERSONA_PROMPT }
      ];

      // Add first message context for new conversations
      if (conversation.length === 1) {
        messages.push({ role: 'system', content: FIRST_MESSAGE_CONTEXT });
      }

      // Add conversation history
      conversation.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });

      // Try GPT-5 first, fallback to GPT-4 if it fails
      let response;
      try {
        response = await this.openai.chat.completions.create({
          model: 'gpt-5',
          messages: messages as any,
          max_completion_tokens: 1500, // GPT-5 uses max_completion_tokens
          temperature: 0.7
        });
      } catch (modelError) {
        logger.warn('GPT-5 failed, falling back to GPT-4:', modelError);
        response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: messages as any,
          max_tokens: 1500,
          temperature: 0.7
        });
      }

      const assistantMessage = response.choices[0]?.message?.content;
      if (!assistantMessage) {
        throw new Error('Empty response from OpenAI');
      }

      return assistantMessage;

    } catch (error) {
      logger.error('Error generating conversation response', error);
      
      // More specific error handling for debugging
      if (error instanceof Error) {
        logger.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
        
        // Check for specific OpenAI errors
        if (error.message.includes('model') && error.message.includes('gpt-5')) {
          logger.warn('GPT-5 model not available, falling back to GPT-4');
          // Could implement fallback here
        }
        
        if (error.message.includes('API key')) {
          logger.error('OpenAI API key issue detected');
        }
      }
      
      return 'Sorry, something went wrong 😅 Can you try again?';
    }
  }

  // ENHANCED: Extract user information with much better natural language support
  extractUserInfo(conversation: ConversationMessage[]): WellnessData {
    const userInfo: WellnessData = {};

    const userMessages = conversation
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content.toLowerCase());

    const allText = userMessages.join(' ');

    // 🎯 ENHANCED AGE EXTRACTION - Much more comprehensive
    this.extractAge(allText, userInfo);
    
    // 🎯 ENHANCED GENDER EXTRACTION - Better context understanding  
    this.extractGender(allText, userInfo);
    
    // 🎯 ENHANCED WEIGHT EXTRACTION - Unit conversion & context
    this.extractWeight(allText, userInfo);
    
    // 🎯 ENHANCED HEIGHT EXTRACTION - Imperial & metric support
    this.extractHeight(allText, userInfo);
    
    // 🎯 ENHANCED SLEEP EXTRACTION - Range handling
    this.extractSleep(allText, userInfo);
    
    // 🎯 ENHANCED HEALTH DATA EXTRACTION
    this.extractHealthMetrics(allText, userInfo);
    
    // 🎯 ENHANCED LIFESTYLE EXTRACTION
    this.extractLifestyle(allText, userInfo);
    
    // 🎯 ENHANCED GOALS & PREFERENCES
    this.extractGoalsAndPreferences(allText, userInfo);

    // Calculate BMI if we have weight and height
    if (userInfo.weight && userInfo.height) {
      const heightM = userInfo.height / 100; // cm to meters
      userInfo.bmi = Math.round((userInfo.weight / (heightM * heightM)) * 10) / 10;
    }

    // Debug logging
    const filledFields = Object.keys(userInfo).filter(key => {
      const value = (userInfo as any)[key];
      return value !== undefined && value !== null && (Array.isArray(value) ? value.length > 0 : value !== '');
    });
    
    console.log('🎯 ENHANCED extraction result:', { 
      totalFields: Object.keys(userInfo).length, 
      filledFields: filledFields.length, 
      fields: filledFields,
      sample: { age: userInfo.age, gender: userInfo.gender, weight: userInfo.weight }
    });

    return userInfo;
  }

  private extractAge(text: string, userInfo: WellnessData): void {
    const agePatterns = [
      // Direct statements - much more comprehensive
      /(?:i'?m|i am|i'm|im|me)\s*(?:a\s*)?(\d{1,3})\s*(?:years?\s*old|yrs?\s*old|y\.?o\.?|year old)?/i,
      /(?:age|aged?)\s*(?:is|of|:|was|am)?\s*(\d{1,3})/i,
      /(\d{1,3})\s*(?:years?\s*old|yrs?\s*old|y\.?o\.?|year old)/i,
      /(?:turn(?:ed|ing)?|will be|gonna be|about to be)\s*(\d{1,3})/i,
      /(?:born in|birth year)\s*(\d{4})/i,
      /(\d{1,3})\s*(?:year|yr)\s*old/i,
      /(?:just|recently|about|around)\s*(?:turned|became)\s*(\d{1,3})/i,
      
      // Word numbers - comprehensive
      /(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s\-]?(?:one|two|three|four|five|six|seven|eight|nine)?/i,
      
      // Age ranges
      /(?:early|mid|late)\s*(?:twenties|thirties|forties|fifties|sixties)/i,
      /(?:in my|in the)\s*(?:twenties|thirties|forties|fifties)/i,
      
      // Casual mentions
      /(?:when i was|at age|at the age of)\s*(\d{1,3})/i,
      /(?:birthday|bday)\s*(?:is|was)?\s*(?:in)?\s*(\d{1,2})/i
    ];

    for (const pattern of agePatterns) {
      const match = text.match(pattern);
      if (match) {
        let age = 0;
        
        // Handle birth year calculation
        if (match[0].includes('born') || match[0].includes('birth')) {
          const currentYear = new Date().getFullYear();
          age = currentYear - parseInt(match[1]);
        }
        // Handle word numbers
        else if (match[0].match(/twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety/i)) {
          age = this.parseAgeFromWords(match[0]);
        }
        // Handle age ranges
        else if (match[0].match(/early|mid|late/i)) {
          age = this.parseRangeAge(match[0]);
        }
        // Handle regular numbers
        else if (match[1]) {
          age = parseInt(match[1]);
        }
        
        console.log('🔍 Age extraction:', { pattern: pattern.source, match: match[0], extractedAge: age });
        
        if (age >= 13 && age <= 120) {
          userInfo.age = age;
          console.log('✅ Age saved:', age);
          break;
        }
      }
    }
  }

  private extractGender(text: string, userInfo: WellnessData): void {
    const genderPatterns = [
      /(?:i'?m|i am|i'm|im)\s*(?:a\s*)?(male|female|man|woman|guy|girl|boy|dude|lady|gentleman|non-binary|nb)/i,
      /(?:gender|sex)\s*(?:is|:)?\s*(male|female|man|woman|m|f|non-binary|nb)/i,
      /(male|female|man|woman|guy|girl|boy|dude|lady|gentleman)\s*(?:here|speaking|myself)/i,
      /(?:identify as|consider myself)\s*(?:a\s*)?(male|female|man|woman|non-binary|nb)/i,
      /(?:my pronouns are|use|pronouns:)\s*(he\/him|she\/her|they\/them)/i
    ];
    
    for (const pattern of genderPatterns) {
      const match = text.match(pattern);
      if (match) {
        const gender = match[1]?.toLowerCase();
        
        // Normalize gender values with comprehensive mapping
        if (['he/him', 'man', 'male', 'guy', 'boy', 'dude', 'gentleman', 'm'].includes(gender) || 
            text.includes('husband') || text.includes('boyfriend') || text.includes(' mr ')) {
          userInfo.gender = 'male';
        } else if (['she/her', 'woman', 'female', 'girl', 'lady', 'f'].includes(gender) ||
                   text.includes('wife') || text.includes('girlfriend') || text.includes(' mrs ') || text.includes(' ms ')) {
          userInfo.gender = 'female';
        } else if (['they/them', 'non-binary', 'nb'].includes(gender)) {
          userInfo.gender = 'non-binary';
        }
        
        if (userInfo.gender) break;
      }
    }
  }

  private extractWeight(text: string, userInfo: WellnessData): void {
    const weightPatterns = [
      // Direct statements with approximations
      /(?:i\s*)?(?:weigh|weight is|weight:|my weight)\s*(?:about|around|approximately|roughly)?\s*(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?|kgs?)/i,
      /(?:weight|weigh)\s*(?:about|around|roughly|approximately)?\s*(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?|kgs?)/i,
      /(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?|kgs?)\s*(?:in weight|heavy|weight)/i,
      
      // Weight change context
      /(?:lost|lose|losing)\s*(?:about|around)?\s*(\d+)\s*(lbs?|pounds?|kg|kilos?)/i,
      /(?:gained?|gain|gaining)\s*(?:about|around)?\s*(\d+)\s*(lbs?|pounds?|kg|kilos?)/i,
      /(?:current|now|currently)\s*(?:weigh|weight)\s*(?:is)?\s*(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?)/i,
      
      // Target weight
      /(?:goal|target|want to)\s*(?:weigh|weight)\s*(?:is)?\s*(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?)/i,
      
      // Casual mentions  
      /(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?|kgs?)(?:\s*(?:now|currently|today|exactly))?/i
    ];
    
    for (const pattern of weightPatterns) {
      const match = text.match(pattern);
      if (match) {
        let weight = parseFloat(match[1]);
        const unit = match[2]?.toLowerCase();
        
        // Convert pounds to kg
        if (unit && (unit.includes('lb') || unit.includes('pound'))) {
          weight = Math.round(weight * 0.453592 * 10) / 10;
        }
        
        // Validate realistic weight range
        if (weight >= 30 && weight <= 300) {
          userInfo.weight = weight;
          console.log('✅ Weight extracted:', weight, 'kg');
          break;
        }
      }
    }
  }

  private extractHeight(text: string, userInfo: WellnessData): void {
    const heightPatterns = [
      // Imperial formats with natural language
      /(?:i'?m|i am|height is|height:|my height)\s*(?:about|around|approximately)?\s*(\d+)(?:'|ft|feet)\s*(?:and\s*)?(\d+)(?:"|in|inch|inches)?/i,
      /(\d+)\s*(?:foot|feet|ft|')\s*(?:and\s*)?(\d+)\s*(?:inch|inches|in|")/i,
      /(\d+)'(\d+)"/i, // 5'8"
      /(\d+)\s*feet?\s*(\d+)\s*inch/i,
      /(\d+)\s*ft\s*(\d+)\s*in/i,
      
      // Metric formats with natural language
      /(?:i'?m|i am|height is|height:|my height)\s*(?:about|around|approximately)?\s*(\d+(?:\.\d+)?)\s*(?:meters?|m)(?!\w)/i,
      /(?:i'?m|i am|height is|height:|my height)\s*(?:about|around|approximately)?\s*(\d+)\s*(?:centimeters?|cm)/i,
      /(\d+\.\d+)\s*(?:meters?|m)(?:\s*tall)?/i,
      /(\d+)\s*(?:centimeters?|cm)(?:\s*tall)?/i,
      
      // Casual mentions
      /(?:about|around|roughly)\s*(\d+)\s*(?:foot|feet|ft)/i,
      /(?:tall|height)\s*(?:is|of|:)?\s*(?:about|around)?\s*(\d+(?:\.\d+)?)\s*(?:meters?|m|cm|centimeters?)/i
    ];
    
    for (const pattern of heightPatterns) {
      const match = text.match(pattern);
      if (match) {
        let heightInCm = 0;
        
        if (match[2] !== undefined) {
          // Feet and inches format
          const feet = parseInt(match[1]);
          const inches = parseInt(match[2]) || 0;
          heightInCm = Math.round((feet * 12 + inches) * 2.54);
        } else if (match[0].includes('m') && !match[0].includes('cm')) {
          // Meters format
          heightInCm = Math.round(parseFloat(match[1]) * 100);
        } else if (match[0].includes('cm')) {
          // Centimeters format
          heightInCm = parseInt(match[1]);
        } else if (match[0].includes('ft') || match[0].includes('feet') || match[0].includes('foot')) {
          // Feet only format
          heightInCm = Math.round(parseInt(match[1]) * 12 * 2.54);
        }
        
        // Validate realistic height range
        if (heightInCm >= 100 && heightInCm <= 250) {
          userInfo.height = heightInCm;
          console.log('✅ Height extracted:', heightInCm, 'cm');
          break;
        }
      }
    }
  }

  private extractSleep(text: string, userInfo: WellnessData): void {
    const sleepPatterns = [
      // Comprehensive sleep duration patterns
      /(?:i\s*)?(?:sleep|get|have)\s*(?:about|around|roughly|approximately)?\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:of\s*sleep|per\s*night|each\s*night|a\s*night|nightly)?/i,
      /(?:sleep|rest)\s*(?:for|about|around)?\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i,
      /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:of\s*)?(?:sleep|rest)/i,
      
      // Sleep schedule mentions
      /(?:bedtime|sleep\s*schedule|sleep\s*pattern)\s*(?:is|:)?\s*(?:about|around)?\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i,
      
      // Range handling (e.g., "7-8 hours")
      /(?:sleep|get|have)\s*(?:between|about)?\s*(\d+)(?:\s*to\s*|-\s*)(\d+)\s*(?:hours?|hrs?)/i,
      
      // Casual and habitual mentions
      /(?:usually|typically|normally|generally|mostly)\s*(?:sleep|get)\s*(?:about|around)?\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i,
      /(?:need|require)\s*(?:about|around)?\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:of\s*sleep|to\s*sleep)/i,
      /(?:average|on average)\s*(?:about|around)?\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i
    ];
    
    for (const pattern of sleepPatterns) {
      const match = text.match(pattern);
      if (match) {
        let sleepHours = 0;
        
        if (match[2]) {
          // Handle range like "7-8 hours" - take average
          sleepHours = (parseInt(match[1]) + parseInt(match[2])) / 2;
        } else {
          sleepHours = parseFloat(match[1]);
        }
        
        // Validate realistic sleep duration
        if (sleepHours >= 3 && sleepHours <= 12) {
          userInfo.sleep_duration = sleepHours;
          console.log('✅ Sleep duration extracted:', sleepHours, 'hours');
          break;
        }
      }
    }
  }

  private extractHealthMetrics(text: string, userInfo: WellnessData): void {
    // Heart rate patterns
    const heartRatePatterns = [
      /(?:heart rate|pulse|resting heart rate|rhr)\s*(?:is|:)?\s*(?:about|around)?\s*(\d+)\s*(?:bpm|beats)/i,
      /(\d+)\s*(?:bpm|beats per minute)/i,
      /(?:resting|rest)\s*(?:heart rate|pulse)\s*(?:is|:)?\s*(\d+)/i
    ];
    
    for (const pattern of heartRatePatterns) {
      const match = text.match(pattern);
      if (match) {
        const heartRate = parseInt(match[1]);
        if (heartRate >= 40 && heartRate <= 150) {
          userInfo.resting_heart_rate = heartRate;
          console.log('✅ Heart rate extracted:', heartRate, 'bpm');
          break;
        }
      }
    }

    // Steps patterns
    const stepPatterns = [
      /(?:walk|get|have)\s*(?:about|around)?\s*(\d+(?:,\d+)?)\s*(?:steps|step)/i,
      /(\d+(?:,\d+)?)\s*(?:steps|step)\s*(?:per day|daily|a day)/i,
      /(?:daily steps|step count)\s*(?:is|:)?\s*(?:about|around)?\s*(\d+(?:,\d+)?)/i
    ];
    
    for (const pattern of stepPatterns) {
      const match = text.match(pattern);
      if (match) {
        const steps = parseInt(match[1].replace(',', ''));
        if (steps >= 100 && steps <= 50000) {
          userInfo.daily_steps = steps;
          console.log('✅ Steps extracted:', steps);
          break;
        }
      }
    }

    // Stress level patterns
    const stressPatterns = [
      /(?:stress|stressed)\s*(?:level|is)?\s*(?:is|:)?\s*(high|low|medium|moderate|very high|very low)/i,
      /(very stressed|stressed|not stressed|relaxed|calm)/i,
      /(?:feel|feeling)\s*(stressed|overwhelmed|relaxed|calm)/i
    ];
    
    for (const pattern of stressPatterns) {
      const match = text.match(pattern);
      if (match) {
        const stress = match[1].toLowerCase();
        if (['high', 'very high', 'stressed', 'very stressed', 'overwhelmed'].includes(stress)) {
          userInfo.stress_level = 'high';
        } else if (['medium', 'moderate'].includes(stress)) {
          userInfo.stress_level = 'moderate';
        } else if (['low', 'very low', 'not stressed', 'relaxed', 'calm'].includes(stress)) {
          userInfo.stress_level = 'low';
        }
        
        if (userInfo.stress_level) {
          console.log('✅ Stress level extracted:', userInfo.stress_level);
          break;
        }
      }
    }
  }

  private extractLifestyle(text: string, userInfo: WellnessData): void {
    // Work schedule patterns
    const workPatterns = [
      /(?:work|job|working)\s*(?:as|is)?\s*(.+?)(?:\s|$|,|\.|!|\?)/i,
      /(?:i'?m|i am)\s*(?:a|an)\s*(.+?)(?:\s|$|,|\.|!|\?)/i,
      /(?:profession|career|occupation)\s*(?:is|:)?\s*(.+?)(?:\s|$|,|\.|!|\?)/i
    ];
    
    for (const pattern of workPatterns) {
      const match = text.match(pattern);
      if (match) {
        const work = match[1].trim();
        if (work.length > 2 && work.length < 100) {
          userInfo.work_schedule = work;
          console.log('✅ Work schedule extracted:', work);
          break;
        }
      }
    }

    // Location patterns - comprehensive
    const locationPatterns = [
      /(?:live in|living in|from|based in)\s*(.+?)(?:\s|$|,|\.|!|\?)/i,
      /(?:location|city|country|state)\s*(?:is|:)?\s*(.+?)(?:\s|$|,|\.|!|\?)/i,
      /(new york|los angeles|chicago|london|paris|tokyo|sydney|toronto|berlin|madrid|rome|amsterdam|mumbai|delhi|bangalore|singapore|hong kong|dubai|moscow|stockholm|copenhagen|oslo|helsinki|vienna|zurich|geneva|brussels|lisbon|dublin|edinburgh|glasgow|manchester|birmingham|leeds|liverpool|bristol|cardiff|belfast|barcelona|valencia|seville|milan|naples|florence|venice|munich|hamburg|cologne|frankfurt|stuttgart|dusseldorf|leipzig|dresden|hannover|bremen|nuremberg|dortmund|essen|duisburg|bochum|wuppertal|bielefeld|bonn|munster|karlsruhe|mannheim|augsburg|wiesbaden|gelsenkirchen|monchengladbach|braunschweig|chemnitz|kiel|aachen|halle|magdeburg|freiburg|krefeld|lubeck|oberhausen|erfurt|mainz|rostock|kassel|hagen|hamm|saarbrucken|mulheim|potsdam|ludwigshafen|oldenburg|leverkusen|osnabrück|solingen|heidelberg|herne|neuss|darmstadt|paderborn|regensburg|ingolstadt|wurzburg|fürth|wolfsburg|offenbach|ulm|heilbronn|pforzheim|gottingen|bottrop|trier|recklinghausen|reutlingen|bremerhaven|koblenz|bergisch gladbach|jena|remscheid|erlangen|moers|siegen|hildesheim|salzgitter)/i
    ];
    
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        const location = match[1].trim();
        if (location.length > 1 && location.length < 50) {
          userInfo.location = location;
          console.log('✅ Location extracted:', location);
          break;
        }
      }
    }
  }

  private extractGoalsAndPreferences(text: string, userInfo: WellnessData): void {
    // Health goals - comprehensive extraction
    const goalKeywords = [
      'lose weight', 'weight loss', 'get fit', 'build muscle', 'gain muscle', 'strength',
      'endurance', 'cardio', 'flexibility', 'balance', 'coordination', 'improve sleep',
      'better sleep', 'sleep quality', 'reduce stress', 'stress management', 'mental health',
      'anxiety', 'depression', 'mood', 'energy', 'stamina', 'marathon', 'half marathon',
      '5k', '10k', 'triathlon', 'yoga', 'pilates', 'crossfit', 'bodybuilding', 'powerlifting',
      'swimming', 'running', 'cycling', 'hiking', 'climbing', 'dancing', 'martial arts',
      'boxing', 'kickboxing', 'tennis', 'basketball', 'soccer', 'football', 'volleyball',
      'badminton', 'squash', 'golf', 'skiing', 'snowboarding', 'surfing', 'skateboarding',
      'nutrition', 'diet', 'healthy eating', 'meal prep', 'cooking', 'supplements',
      'vitamins', 'protein', 'hydration', 'water intake', 'quit smoking', 'stop drinking',
      'moderation', 'mindfulness', 'meditation', 'breathing', 'posture', 'back pain',
      'joint health', 'mobility', 'stretching', 'recovery', 'rehabilitation'
    ];

    userInfo.health_goals = [];
    userInfo.activity_preferences = [];
    
    goalKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        if (['lose weight', 'weight loss', 'get fit', 'build muscle', 'improve sleep', 'reduce stress'].includes(keyword)) {
          userInfo.health_goals!.push(keyword);
        } else if (['yoga', 'pilates', 'running', 'swimming', 'cycling', 'hiking', 'dancing', 'martial arts'].includes(keyword)) {
          userInfo.activity_preferences!.push(keyword);
        }
      }
    });

    // Remove duplicates
    userInfo.health_goals = [...new Set(userInfo.health_goals)];
    userInfo.activity_preferences = [...new Set(userInfo.activity_preferences)];
    
    console.log('✅ Goals extracted:', userInfo.health_goals?.length || 0);
    console.log('✅ Activities extracted:', userInfo.activity_preferences?.length || 0);
  }

  // Helper methods for parsing
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

  private parseRangeAge(text: string): number {
    const lower = text.toLowerCase();
    
    if (lower.includes('twenties')) {
      if (lower.includes('early')) return 22;
      if (lower.includes('mid')) return 25;
      if (lower.includes('late')) return 28;
      return 25;
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
    
    return 0;
  }

  async generateWellnessSummary(conversationHistory: ConversationMessage[]): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI service not available');
    }

    try {
      // Extract user info first
      const extractedUserInfo = this.extractUserInfo(conversationHistory);

      // Create transcription
      const transcription = conversationHistory
        .map(msg => `${msg.role === 'user' ? 'User' : 'Anna'}: ${msg.content}`)
        .join('\n\n');

      const prompt = generateWellnessSummaryPrompt(transcription, extractedUserInfo);
      
      // Try GPT-5 first, fallback to GPT-4 if it fails
      let response;
      try {
        response = await this.openai.chat.completions.create({
          model: 'gpt-5',
          messages: [
            { role: 'system', content: WELLNESS_SUMMARY_SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ],
          max_completion_tokens: 2500 // GPT-5 uses max_completion_tokens
        });
      } catch (modelError) {
        logger.warn('GPT-5 failed in summary, falling back to GPT-4:', modelError);
        response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: WELLNESS_SUMMARY_SYSTEM_PROMPT },
            { role: 'user', content: prompt }
          ],
          max_tokens: 2500
        });
      }

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

export const enhancedConversationService = new EnhancedConversationService();
