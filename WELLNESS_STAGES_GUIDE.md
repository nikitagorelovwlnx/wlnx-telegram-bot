# 🏥 Wellness Form Stage-based Data Collection Guide

## Overview

New system uses ChatGPT for international data collection:
- **5 stages** of structured data gathering
- **ChatGPT extraction** for any languages and response formats  
- **Smart progression** between stages based on data completeness

## 📊 5 Data Collection Stages

### 1️⃣ Demographics and Baseline
**Goal:** Collect basic physical characteristics  
**Fields:**
- `age` - user age
- `gender` - user gender
- `weight` - weight in kg
- `height` - height in cm
- `location` - location/city
- `timezone` - timezone

**Completion criteria:** age + gender + (weight OR height)

### 2️⃣ Biometrics and Habits
**Goal:** Understand daily patterns and health metrics  
**Fields:**
- `sleep_duration` - hours of sleep
- `daily_steps` - steps per day
- `resting_heart_rate` - resting heart rate
- `stress_level` - stress level
- `nutrition_habits` - eating habits
- `caffeine_intake` - caffeine consumption

**Completion criteria:** sleep duration + 2 other fields

### 3️⃣ Lifestyle Context
**Goal:** Understand work and family circumstances  
**Fields:**
- `work_schedule` - work schedule
- `workload` - work load
- `business_travel` - business travel
- `family_obligations` - family obligations
- `recovery_resources` - recovery resources

**Completion criteria:** work schedule + 2 other fields

### 4️⃣ Medical History
**Goal:** Identify limitations and risks  
**Fields:**
- `chronic_conditions` - chronic conditions
- `injuries` - injuries
- `medications` - medications
- `supplements` - supplements
- `contraindications` - contraindications

**Completion criteria:** medical info OR explicit "no problems"

### 5️⃣ Goals and Preferences
**Goal:** Determine motivation and preferences  
**Fields:**
- `health_goals` - health goals
- `activity_preferences` - activity preferences
- `morning_evening_type` - chronotype
- `motivation_level` - motivation level
- `coaching_style_preference` - coaching style

**Completion criteria:** health goals + activity preferences

## 🤖 Data Extraction System

### ChatGPT Approach:
1. **Every user response** sent to ChatGPT
2. **Any language** - ChatGPT understands Russian, English, French, etc.
3. **Any format** - informal speech, abbreviations, typos

### Advantages:
- ✅ **International** - works in any language
- ✅ **High accuracy** - GPT parses complex speech
- ✅ **Flexible** - understands context and nuances
- ✅ **Simple** - one extraction method for everything

## 📝 New Commands

### For Users:
- `/wellness_form` - Start stage-based form filling
- `/wellness_status` - View filling progress  
- `/wellness_restart` - Restart form from beginning
- `/skip_stage` - Skip current stage

### For Developers:
- `wellnessStageService.initializeWellnessProcess()` - Start new process
- `wellnessStageService.processUserResponse()` - Process user response
- `wellnessStageService.getFinalWellnessData()` - Get final data

## 🔄 System Logic

```typescript
// 1. Initialize
const progress = wellnessStageService.initializeWellnessProcess();

// 2. Show stage introduction
const intro = wellnessStageService.getStageIntroduction(progress.currentStage);

// 3. Process user response
const result = await wellnessStageService.processUserResponse(userText, progress);

// 4. Update and advance to next stage (if ready)
if (result.shouldAdvanceStage) {
  progress.currentStage = getNextStage(progress.currentStage);
}
```

## 🎯 Usage

### In CommandHandler:
- User calls `/wellness_form`
- System switches to stage-based collection mode
- Each message processed through `handleWellnessStageInput`
- After completion returns to normal conversation

### API Integration:
- Final data automatically saved via `/save_interview`
- Supports existing `WellnessData` format
- Compatible with current server

## 🧪 Testing

```bash
# Run new service tests
npm test -- wellnessStageService.test.ts

# Check compilation
npm run build

# Run bot in dev mode
npm run dev
```

## 📈 Monitoring

Logs:
- Which extraction method was used (gpt_extraction only now)
- Data extraction confidence level
- Time spent on each stage
- Completeness of collected data

## 🔧 Configuration

In `.env`:
```
OPENAI_API_KEY=your_key_here  # Required for GPT extraction
```

If key not provided - system will show error message to user.

## 🚀 System Advantages

1. **Structured** - clear stages instead of chaotic conversation
2. **Flexible** - can skip stages and return
3. **International** - works in any language
4. **Scalable** - easy to add new stages
5. **Trackable** - complete form completion history
