#!/usr/bin/env node

const OpenAI = require('openai');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY не найден в .env файле');
    console.log('Пожалуйста, добавьте OPENAI_API_KEY в .env файл');
    process.exit(1);
  }

  console.log('🔑 API ключ найден');
  
  const openai = new OpenAI({
    apiKey: apiKey,
  });

  try {
    console.log('🧪 Тестируем GPT-4...');
    const response4 = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'Hello, say "GPT-4 works!"' }
      ],
      max_tokens: 50
    });
    
    console.log('✅ GPT-4 работает:', response4.choices[0]?.message?.content);
    
  } catch (error) {
    console.error('❌ GPT-4 ошибка:', error.message);
  }

  try {
    console.log('🧪 Тестируем GPT-5...');
    const response5 = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        { role: 'user', content: 'Hello, say "GPT-5 works!"' }
      ],
      max_completion_tokens: 50 // GPT-5 uses max_completion_tokens
    });
    
    console.log('✅ GPT-5 работает:', response5.choices[0]?.message?.content);
    
  } catch (error) {
    console.error('❌ GPT-5 ошибка:', error.message);
    if (error.message.includes('model')) {
      console.log('💡 GPT-5 может быть недоступен, используйте GPT-4');
    }
  }
}

console.log('🚀 Запуск теста OpenAI API...\n');
testOpenAI().catch(console.error);
