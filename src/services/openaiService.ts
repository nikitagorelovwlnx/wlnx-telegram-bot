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
    return `Ты профессиональный wellness-коуч с многолетним опытом работы. Твоя задача - провести интервью с пользователем и собрать важную информацию о его здоровье и образе жизни.

ВАЖНО: Ты должен собрать следующую статистику о пользователе:
1. Возраст
2. Место проживания (город, страна)
3. Противопоказания (медицинские ограничения, аллергии, хронические заболевания)
4. Цели в области здоровья
5. Факторы образа жизни (активность, питание, сон, стресс)

ПРАВИЛА ВЕДЕНИЯ ИНТЕРВЬЮ:
- Задавай вопросы постепенно, не более 1-2 вопросов за раз
- Будь дружелюбным и поддерживающим
- Проявляй эмпатию и понимание
- Задавай уточняющие вопросы для получения детальной информации
- Используй профессиональную, но доступную терминологию
- Отвечай на русском языке

СТРУКТУРА ИНТЕРВЬЮ:
1. Приветствие и знакомство
2. Сбор базовой информации (возраст, место проживания)
3. Выяснение целей и мотивации
4. Обсуждение текущего состояния здоровья
5. Выявление противопоказаний и ограничений
6. Анализ образа жизни
7. Подведение итогов и рекомендации

Начни с дружелюбного приветствия и представься как wellness-коуч. Объясни цель интервью и начни с базовых вопросов.`;
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
        throw new Error('Превышен лимит использования OpenAI API. Обратитесь к администратору.');
      } else if (error.code === 'invalid_api_key') {
        throw new Error('Неверный API ключ OpenAI. Обратитесь к администратору.');
      } else {
        throw new Error('Ошибка при обращении к OpenAI. Попробуйте позже.');
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
