import OpenAI from 'openai';
import { config } from '../config';
import { ConversationMessage } from '../types';
import { logger } from '../utils/logger';

class OpenAIService {
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey,
      });
    } else {
      logger.warn('OpenAI API key not provided. Wellness coaching will not be available.');
    }
  }

  private getWellnessCoachSystemPrompt(): string {
    return `You are a professional wellness coach with years of experience. Your task is to interview the user and collect key information about their health and lifestyle.

IMPORTANT: Gradually collect the following statistics about the user:
1. Age
2. Location (city, country)
3. Contraindications (medical restrictions, allergies, chronic conditions)
4. Health goals
5. Lifestyle factors (activity, nutrition, sleep, stress)

INTERVIEW RULES:
- Ask questions gradually, no more than 1–2 at a time
- Be friendly and supportive
- Show empathy and understanding
- Ask clarifying questions to gather details
- Use professional but accessible language
- Respond in English

INTERVIEW STRUCTURE:
1. Greeting and getting acquainted
2. Collect basic information (age, location)
3. Explore goals and motivation
4. Discuss current health state
5. Identify contraindications and restrictions
6. Analyze lifestyle
7. Summarize findings and give recommendations

Start with a friendly greeting and introduce yourself as a wellness coach. Explain the purpose and begin with basic questions.`;
  }

  async generateResponse(messages: ConversationMessage[]): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI service is not initialized. Please check your API key.');
    }

    try {
      const systemMessage: ConversationMessage = {
        role: 'system',
        content: this.getWellnessCoachSystemPrompt(),
        timestamp: new Date().toISOString()
      };

      const openaiMessages = [systemMessage, ...messages].map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await this.openai.chat.completions.create({
        model: config.openaiModel,
        messages: openaiMessages,
        max_tokens: 500,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const assistantMessage = response.choices[0]?.message?.content;
      
      if (!assistantMessage) {
        throw new Error('No response from OpenAI');
      }

      logger.debug('OpenAI response generated', {
        model: config.openaiModel,
        tokensUsed: response.usage?.total_tokens
      });

      return assistantMessage;

    } catch (error: any) {
      logger.error('OpenAI API error', {
        error: error.message,
        code: error.code,
        type: error.type
      });
      
      if (error.code === 'insufficient_quota') {
        throw new Error('OpenAI API quota exceeded. Please contact the administrator.');
      } else if (error.code === 'invalid_api_key') {
        throw new Error('Invalid OpenAI API key. Please contact the administrator.');
      } else {
        throw new Error('Error contacting OpenAI. Please try again later.');
      }
    }
  }

  extractStatistics(conversation: ConversationMessage[]): {
    age?: number;
    location?: string;
    contraindications?: string[];
    health_goals?: string[];
    lifestyle_factors?: string[];
  } {
    const statistics = {
      age: undefined as number | undefined,
      location: undefined as string | undefined,
      contraindications: [] as string[],
      health_goals: [] as string[],
      lifestyle_factors: [] as string[]
    };

    const userMessages = conversation
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content.toLowerCase());

    const allText = userMessages.join(' ');

    // Извлечение возраста
    const ageMatch = allText.match(/(\d{1,2})\s*(лет|года|год|years?|y\.?o\.?)/i);
    if (ageMatch) {
      const age = parseInt(ageMatch[1]);
      if (age >= 10 && age <= 120) {
        statistics.age = age;
      }
    }

    // Извлечение местоположения
    const locationPatterns = [
      /живу в (.+?)(?:\s|$|,|\.|!|\?)/i,
      /из (.+?)(?:\s|$|,|\.|!|\?)/i,
      /город (.+?)(?:\s|$|,|\.|!|\?)/i,
      /(москва|спб|санкт-петербург|екатеринбург|новосибирск|казань|нижний новгород|челябинск|самара|омск|ростов|уфа|красноярск|воронеж|пермь|волгоград)/i
    ];

    for (const pattern of locationPatterns) {
      const match = allText.match(pattern);
      if (match && match[1]) {
        statistics.location = match[1].trim();
        break;
      }
    }

    // Извлечение противопоказаний
    const contraindicationKeywords = [
      'аллергия', 'диабет', 'гипертония', 'астма', 'артрит', 'мигрень',
      'проблемы с сердцем', 'заболевания', 'ограничения', 'противопоказания',
      'не могу', 'нельзя', 'запрещено', 'болезнь', 'лечение', 'таблетки'
    ];

    userMessages.forEach(message => {
      contraindicationKeywords.forEach(keyword => {
        if (message.includes(keyword)) {
          const sentences = message.split(/[.!?]+/);
          sentences.forEach(sentence => {
            if (sentence.includes(keyword) && sentence.trim().length > 10) {
              statistics.contraindications.push(sentence.trim());
            }
          });
        }
      });
    });

    // Извлечение целей здоровья
    const goalKeywords = [
      'хочу', 'цель', 'похудеть', 'набрать вес', 'мышцы', 'выносливость',
      'здоровье', 'фитнес', 'спорт', 'тренировки', 'питание', 'сон'
    ];

    userMessages.forEach(message => {
      goalKeywords.forEach(keyword => {
        if (message.includes(keyword)) {
          const sentences = message.split(/[.!?]+/);
          sentences.forEach(sentence => {
            if (sentence.includes(keyword) && sentence.trim().length > 10) {
              statistics.health_goals.push(sentence.trim());
            }
          });
        }
      });
    });

    // Извлечение факторов образа жизни
    const lifestyleKeywords = [
      'работаю', 'сплю', 'ем', 'тренируюсь', 'курю', 'пью', 'стресс',
      'активность', 'сидячий', 'офис', 'спорт', 'прогулки'
    ];

    userMessages.forEach(message => {
      lifestyleKeywords.forEach(keyword => {
        if (message.includes(keyword)) {
          const sentences = message.split(/[.!?]+/);
          sentences.forEach(sentence => {
            if (sentence.includes(keyword) && sentence.trim().length > 10) {
              statistics.lifestyle_factors.push(sentence.trim());
            }
          });
        }
      });
    });

    // Удаляем дубликаты
    statistics.contraindications = [...new Set(statistics.contraindications)];
    statistics.health_goals = [...new Set(statistics.health_goals)];
    statistics.lifestyle_factors = [...new Set(statistics.lifestyle_factors)];

    return statistics;
  }

  isAvailable(): boolean {
    return this.openai !== null;
  }
}

export const openaiService = new OpenAIService();
