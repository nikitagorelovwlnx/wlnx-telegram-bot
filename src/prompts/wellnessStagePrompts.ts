/**
 * Промпты для 5 этапов сбора данных wellness формы
 * Каждый этап имеет специализированный промпт для извлечения данных через ChatGPT
 */

import { WellnessStage, WellnessData } from '../types';

// Базовый системный промпт для извлечения данных
export const WELLNESS_EXTRACTION_SYSTEM_PROMPT = `
Ты специализируешься на извлечении структурированных данных о здоровье и фитнесе из естественной речи пользователей.

ТВОЯ ЗАДАЧА:
- Извлечь конкретные данные из ответа пользователя
- Вернуть результат в точном JSON формате  
- Быть консервативным: если не уверен в данных - не добавляй их
- Различать явные данные от предположений

ПРАВИЛА:
1. Извлекай только те данные, которые пользователь ЯВНО упомянул
2. Не додумывай и не предполагай данные
3. Преобразуй единицы измерения в метрическую систему (кг, см, часы)
4. Для списков массивов - добавляй только четко названные элементы
5. Возвращай confidence от 0 до 100 на основе четкости данных

ФОРМАТ ОТВЕТА ВСЕГДА:
{
  "extractedData": { /* только поля WellnessData */ },
  "confidence": 85,
  "reasoning": "Объяснение что и откуда извлечено",
  "suggestedNextQuestion": "Следующий логичный вопрос",
  "stageComplete": false
}
`;

// 1. DEMOGRAPHICS AND BASELINE
export const STAGE_1_DEMOGRAPHICS_BASELINE_PROMPT = `
ЭТАП 1: ДЕМОГРАФИЧЕСКИЕ ДАННЫЕ И БАЗОВЫЕ ПОКАЗАТЕЛИ

Извлеки из ответа пользователя следующие поля:
- age (число): возраст в годах
- gender (строка): пол - "male", "female", "non-binary"  
- weight (число): вес в килограммах
- height (число): рост в сантиметрах
- location (строка): местоположение/город
- timezone (строка): часовой пояс

ПРИМЕРЫ ИЗВЛЕЧЕНИЯ:
"Мне 25 лет" → age: 25
"Я парень" → gender: "male" 
"Вес 70 кг" → weight: 70
"5 футов 8 дюймов" → height: 173 (преобразовать в см)
"Живу в Москве" → location: "Москва"

BMI рассчитывается автоматически, не извлекай его.

Этап завершен если есть хотя бы age, gender, и (weight или height).
`;

// 2. BIOMETRICS AND HABITS
export const STAGE_2_BIOMETRICS_HABITS_PROMPT = `
ЭТАП 2: БИОМЕТРИЧЕСКИЕ ДАННЫЕ И ПРИВЫЧКИ

Извлеки из ответа пользователя следующие поля:
- daily_steps (число): количество шагов в день
- sleep_duration (число): часы сна за ночь  
- sleep_quality (строка): "good", "poor", "average"
- sleep_regularity (строка): регулярность сна
- resting_heart_rate (число): пульс в покое (уд/мин)
- stress_level (строка): "low", "moderate", "high"
- hydration_level (строка): уровень гидратации
- nutrition_habits (массив строк): привычки питания
- caffeine_intake (строка): потребление кофеина
- alcohol_intake (строка): потребление алкоголя

ПРИМЕРЫ ИЗВЛЕЧЕНИЯ:
"Сплю 7 часов" → sleep_duration: 7
"Хожу 10000 шагов" → daily_steps: 10000
"Пульс 65" → resting_heart_rate: 65
"Очень стрессую" → stress_level: "high"
"Пью много кофе" → caffeine_intake: "много кофе"
"Ем мясо и овощи" → nutrition_habits: ["мясо", "овощи"]

Этап завершен если есть хотя бы sleep_duration и 2 других поля.
`;

// 3. LIFESTYLE CONTEXT  
export const STAGE_3_LIFESTYLE_CONTEXT_PROMPT = `
ЭТАП 3: КОНТЕКСТ ОБРАЗА ЖИЗНИ

Извлеки из ответа пользователя следующие поля:
- work_schedule (строка): график/тип работы
- workload (строка): рабочая нагрузка
- business_travel (булево): командировки
- night_shifts (булево): ночные смены
- cognitive_load (строка): когнитивная нагрузка
- family_obligations (массив строк): семейные обязанности
- recovery_resources (массив строк): ресурсы восстановления

ПРИМЕРЫ ИЗВЛЕЧЕНИЯ:
"Работаю программистом" → work_schedule: "программист"
"Офис 9-5" → work_schedule: "офисная работа 9-17"
"Иногда езжу в командировки" → business_travel: true
"Работаю ночами" → night_shifts: true
"Воспитываю детей" → family_obligations: ["воспитание детей"]
"Хожу в спортзал для отдыха" → recovery_resources: ["спортзал"]

Этап завершен если есть work_schedule и 2 других поля.
`;

// 4. MEDICAL HISTORY
export const STAGE_4_MEDICAL_HISTORY_PROMPT = `
ЭТАП 4: МЕДИЦИНСКАЯ ИСТОРИЯ

Извлеки из ответа пользователя следующие поля:
- chronic_conditions (массив строк): хронические заболевания
- injuries (массив строк): травмы
- contraindications (массив строк): противопоказания
- medications (массив строк): лекарства
- supplements (массив строк): добавки/витамины

ПРИМЕРЫ ИЗВЛЕЧЕНИЯ:
"У меня диабет" → chronic_conditions: ["диабет"]
"Была травма колена" → injuries: ["травма колена"]
"Принимаю витамин D" → supplements: ["витамин D"]
"Пью лекарство от давления" → medications: ["лекарство от давления"]
"Нельзя кардио нагрузки" → contraindications: ["кардио нагрузки"]

ВАЖНО: Будь особенно осторожен с медицинскими данными. 
Извлекай только то, что пользователь четко и явно указал.

Этап завершен если пользователь дал информацию по медицине ИЛИ явно сказал что проблем нет.
`;

// 5. PERSONAL GOALS AND PREFERENCES
export const STAGE_5_GOALS_PREFERENCES_PROMPT = `
ЭТАП 5: ЦЕЛИ И ПРЕДПОЧТЕНИЯ

Извлеки из ответа пользователя следующие поля:
- health_goals (массив строк): цели по здоровью
- motivation_level (строка): уровень мотивации
- morning_evening_type (строка): "morning", "evening", "flexible"
- activity_preferences (массив строк): предпочтения активности
- coaching_style_preference (строка): стиль коучинга
- lifestyle_factors (массив строк): факторы образа жизни
- interests (массив строк): интересы

ПРИМЕРЫ ИЗВЛЕЧЕНИЯ:
"Хочу похудеть на 5 кг" → health_goals: ["похудение на 5 кг"]
"Люблю бегать" → activity_preferences: ["бег"]
"Я сова, встаю поздно" → morning_evening_type: "evening"
"Очень мотивирован" → motivation_level: "высокая"
"Нужна жесткая дисциплина" → coaching_style_preference: "строгий"
"Интересуюсь йогой" → interests: ["йога"]

Этап завершен если есть health_goals и activity_preferences.
`;

// Маппинг промптов по этапам
export const STAGE_PROMPTS: Record<WellnessStage, string> = {
  'demographics_baseline': STAGE_1_DEMOGRAPHICS_BASELINE_PROMPT,
  'biometrics_habits': STAGE_2_BIOMETRICS_HABITS_PROMPT,
  'lifestyle_context': STAGE_3_LIFESTYLE_CONTEXT_PROMPT,
  'medical_history': STAGE_4_MEDICAL_HISTORY_PROMPT,
  'goals_preferences': STAGE_5_GOALS_PREFERENCES_PROMPT,
  'completed': '' // Не используется
};

// Вопросы для начала каждого этапа
export const STAGE_INTRODUCTION_MESSAGES: Record<WellnessStage, string> = {
  'demographics_baseline': 
    'Давайте знакомиться! 😊 Расскажите немного о себе - возраст, где живете, основные физические данные (рост, вес). Это поможет мне лучше вас понять.',
    
  'biometrics_habits': 
    'Отлично! Теперь давайте поговорим о ваших привычках 📊 Сколько обычно спите? Как с физической активностью - ходьба, шаги? Что с питанием и общим самочувствием?',
    
  'lifestyle_context':
    'Хорошо! Теперь важно понять ваш образ жизни 🏢 Расскажите про работу, график, семейные дела. Что влияет на ваш день и как вы восстанавливаетесь?',
    
  'medical_history':
    'Перейдем к важной теме - здоровье 🏥 Есть ли какие-то проблемы со здоровьем, травмы, лекарства или ограничения? Если все хорошо - просто скажите, что проблем нет.',
    
  'goals_preferences':
    'И последнее - ваши цели! 🎯 Чего хотите достичь? Какая активность нравится? Как предпочитаете заниматься - утром или вечером? Какой подход вам больше подходит?',
    
  'completed': 
    'Спасибо! Я собрал всю необходимую информацию 🎉 Теперь могу дать персональные рекомендации по здоровью и фитнесу.'
};

// Поля которые должны быть заполнены для каждого этапа (минимум)
export const STAGE_REQUIRED_FIELDS: Record<WellnessStage, string[]> = {
  'demographics_baseline': ['age', 'gender'],
  'biometrics_habits': ['sleep_duration'],  
  'lifestyle_context': ['work_schedule'],
  'medical_history': [], // Может быть пустым если нет проблем
  'goals_preferences': ['health_goals'],
  'completed': []
};

// Следующий этап после текущего
export const STAGE_PROGRESSION: Record<WellnessStage, WellnessStage> = {
  'demographics_baseline': 'biometrics_habits',
  'biometrics_habits': 'lifestyle_context', 
  'lifestyle_context': 'medical_history',
  'medical_history': 'goals_preferences',
  'goals_preferences': 'completed',
  'completed': 'completed'
};
