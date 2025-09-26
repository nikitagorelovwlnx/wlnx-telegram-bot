import OpenAI from 'openai';
import { config } from '../config';
import { ConversationMessage, WellnessData } from '../types';
import { logger } from '../utils/logger';
import { promptConfigService } from './promptConfigService';

class EnhancedConversationService {
  private openai: OpenAI;

  constructor() {
    if (!config.openaiApiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }

  async generateResponse(conversation: ConversationMessage[]): Promise<string> {
    try {
      const messages: any[] = [];

      // Add Anna's system prompt with character description
      const systemPrompt = await promptConfigService.getConversationSystemPrompt();
      
      messages.push({
        role: 'system',
        content: systemPrompt
      });

      // Add conversation history
      conversation.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: messages as any,
        max_tokens: 1500,
        temperature: 0.7
      });

      const assistantMessage = response.choices[0]?.message?.content;
      if (!assistantMessage) {
        throw new Error('Empty response from OpenAI');
      }

      return assistantMessage;

    } catch (error) {
      logger.error('Error generating conversation response', error);
      throw error;
    }
  }

  async generateWellnessSummary(
    conversationHistory: ConversationMessage[], 
    extractedUserInfo: WellnessData
  ): Promise<string> {
    try {
      // Create transcription
      const transcription = conversationHistory
        .map(msg => `${msg.role === 'user' ? 'User' : 'Anna'}: ${msg.content}`)
        .join('\n\n');

      const prompt = `Generate a wellness summary for this user:

EXTRACTED DATA:
${JSON.stringify(extractedUserInfo, null, 2)}

CONVERSATION HIGHLIGHTS:
${conversationHistory.slice(-10).map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Create a structured wellness summary with key insights and recommendations.`;

      // Load wellness summary system prompt from server
      const wellnessSummarySystemPrompt = await promptConfigService.getWellnessSummarySystemPrompt();
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: wellnessSummarySystemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2500,
        temperature: 0.3
      });

      return response.choices[0]?.message?.content || 'Unable to generate summary';
    } catch (error) {
      logger.error('Error generating wellness summary:', error);
      throw error;
    }
  }
}

export const conversationService = new EnhancedConversationService();
