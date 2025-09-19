# 🏥 Wellness Form Schema

## Complete Wellness Data Structure

```typescript
interface WellnessData {
  // 📊 Demographics and Baseline
  age?: number;                          // возраст (число)
  gender?: string;                       // пол (строка) 
  weight?: number;                       // вес в кг (число)
  height?: number;                       // рост в см (число)
  bmi?: number;                          // ИМТ - рассчитывается автоматически
  waist_circumference?: number;          // обхват талии в см
  location?: string;                     // местоположение
  timezone?: string;                     // часовой пояс

  // 💓 Biometrics and Habits  
  daily_steps?: number;                  // шаги в день
  sleep_duration?: number;               // часы сна
  sleep_quality?: string;                // качество сна ("good", "poor", "average")
  sleep_regularity?: string;             // регулярность сна
  hrv?: number;                          // вариабельность пульса
  resting_heart_rate?: number;           // пульс в покое
  stress_level?: string;                 // уровень стресса ("low", "moderate", "high")
  hydration_level?: string;              // уровень гидратации
  nutrition_habits?: string[];           // привычки питания (массив строк)
  caffeine_intake?: string;              // потребление кофеина
  alcohol_intake?: string;               // потребление алкоголя

  // 🏢 Lifestyle Context
  work_schedule?: string;                // график работы
  workload?: string;                     // рабочая нагрузка
  business_travel?: boolean;             // командировки (булево)
  night_shifts?: boolean;                // ночные смены (булево)
  cognitive_load?: string;               // когнитивная нагрузка
  family_obligations?: string[];         // семейные обязанности
  recovery_resources?: string[];         // ресурсы восстановления

  // 🏥 Medical History
  chronic_conditions?: string[];         // хронические заболевания
  injuries?: string[];                   // травмы
  contraindications?: string[];          // противопоказания
  medications?: string[];                // лекарства
  supplements?: string[];                // добавки

  // 🎯 Personal Goals and Preferences
  health_goals?: string[];               // цели здоровья
  motivation_level?: string;             // уровень мотивации
  morning_evening_type?: string;         // хронотип ("morning", "evening", "flexible")
  activity_preferences?: string[];       // предпочтения активности
  coaching_style_preference?: string;    // стиль коучинга
  lifestyle_factors?: string[];          // факторы образа жизни
  interests?: string[];                  // интересы
}
```

## Form Field Categories

### 🟢 High Priority Fields (Core Health Data)
- `age`, `weight`, `height`, `bmi`
- `sleep_duration`, `stress_level`, `resting_heart_rate`
- `health_goals`, `activity_preferences`

### 🟡 Medium Priority Fields (Lifestyle Context)  
- `location`, `work_schedule`, `workload`
- `daily_steps`, `sleep_quality`
- `nutrition_habits`, `caffeine_intake`

### 🟠 Low Priority Fields (Detailed Analysis)
- `hrv`, `waist_circumference`, `timezone`
- `business_travel`, `night_shifts`, `cognitive_load`
- `family_obligations`, `recovery_resources`

### 🔴 Medical Fields (Optional but Important)
- `chronic_conditions`, `injuries`, `contraindications`
- `medications`, `supplements`

## Example Complete Form Data

```json
{
  "wellness_data": {
    "age": 33,
    "gender": "male", 
    "weight": 75,
    "height": 180,
    "bmi": 23.1,
    "location": "San Francisco",
    "daily_steps": 8500,
    "sleep_duration": 7.5,
    "sleep_quality": "good",
    "stress_level": "moderate",
    "resting_heart_rate": 68,
    "work_schedule": "remote software developer",
    "health_goals": [
      "lose 5 pounds",
      "improve sleep quality", 
      "reduce work stress"
    ],
    "activity_preferences": [
      "running",
      "yoga",
      "weight training"
    ],
    "nutrition_habits": [
      "mostly vegetarian",
      "meal prep"
    ],
    "medications": [],
    "supplements": ["vitamin D", "omega-3"],
    "chronic_conditions": [],
    "injuries": ["old knee injury"]
  }
}
```

## Form Validation Rules

- **Age**: 16-100 years
- **Weight**: 30-300 kg  
- **Height**: 100-250 cm
- **BMI**: Auto-calculated from weight/height
- **Sleep Duration**: 3-12 hours
- **Heart Rate**: 40-150 bpm
- **Arrays**: Max 10 items each
- **Strings**: Max 500 characters each
