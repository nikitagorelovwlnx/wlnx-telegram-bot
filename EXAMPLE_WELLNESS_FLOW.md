# 🎯 Wellness Form System Example Flow

## Bot Conversation (Multilingual)

### Stage 1: Demographics

**User:** `/wellness_form`

**Bot:** 
```
📋 Personal Health Form

I will guide you through 5 stages of information collection for personalized recommendations.

Stage 1/5: Demographics and Baseline

Let's get acquainted! 😊 Tell me a bit about yourself - age, location, basic physical data (height, weight). This will help me understand you better.
```

**User:** `Hi! I'm a 28-year-old guy from Berlin. I weigh about 75kg and I'm 1.80m tall.`

**Bot (ChatGPT extracts data):**
```
Got it! Age 28 years. Gender male. Weight 75 kg. Height 180 cm. Location Berlin.

✅ Excellent! Moving to next section.

Stage 2/5: Biometrics and Habits

Great! Now let's talk about your habits 📊 How much do you usually sleep? How about physical activity - walking, steps? What about nutrition and general well-being?
```

### Stage 2: Biometrics and Habits

**User:** `Je dors environ 7h par nuit, je marche beaucoup - environ 12000 pas par jour. Je me sens assez stressé au travail ces derniers temps.`

**Bot (ChatGPT understands French):**
```
Got it! Sleep 7 hours per night. 12000 steps per day. Stress level high.

✅ Excellent! Moving to next section.

Stage 3/5: Lifestyle Context
...
```

### Stage 3: Lifestyle

**User:** `I work remotely as a programmer. Flexible schedule but sometimes work late. No family, live alone.`

**Bot:**
```
Got it! Work schedule: remote programmer. Workload: sometimes work late. Family obligations: live alone.

✅ Excellent! Moving to next section.
...
```

## Technical Implementation

### What happens inside:

```typescript
// 1. User sends message
const userMessage = "Hi! I'm a 28-year-old guy from Berlin...";

// 2. System sends to ChatGPT
const gptRequest = {
  stage: 'demographics_baseline',
  userResponse: userMessage,
  conversationContext: [...],
  previousData: {}
};

// 3. ChatGPT returns structured data
const gptResponse = {
  extractedData: {
    age: 28,
    gender: 'male',
    weight: 75,
    height: 180,
    location: 'Berlin'
  },
  confidence: 95,
  reasoning: 'User clearly stated age (28), gender (guy), weight (75kg), height (1.80m), and location (Berlin)',
  stageComplete: true
};

// 4. System advances to next stage
```

## Advantages in Action

### 🌍 International Support
- **English:** "I'm 25 years old" ✅
- **Russian:** "Мне 25 лет" ✅  
- **French:** "J'ai 25 ans" ✅
- **German:** "Ich bin 25 Jahre alt" ✅

### 💬 Natural Speech
- **Formal:** "My weight is 70 kilograms" ✅
- **Casual:** "I weigh around 70kg" ✅
- **With typos:** "I wieght about 70kgs" ✅
- **Mixed:** "Weight is about 70kg" ✅

### 🔄 Contextual Understanding
ChatGPT remembers conversation context and can link information:
```
User: "I'm an athlete"
... later ...
User: "I train every day"
ChatGPT: understands connection and correctly categorizes activity
```

## Management Commands

```bash
/wellness_form      # Start form
/wellness_status    # View progress
/skip_stage         # Skip stage
/wellness_restart   # Start over
```

## Result

After completing all 5 stages, system automatically:
1. **Combines data** from all stages into single structure
2. **Calculates BMI** if weight and height available
3. **Saves to server** via existing API
4. **Returns to normal chat** with complete user data

User receives personalized recommendations based on collected data! 🎉
