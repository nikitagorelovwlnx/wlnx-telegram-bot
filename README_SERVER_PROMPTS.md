# 🤖 Server-Based Prompt Configuration System

## Overview

The bot now loads all prompt configurations from the server instead of using hardcoded local files. This enables:
- **Dynamic prompt updates** without redeploying the bot
- **A/B testing** different prompt strategies
- **Centralized management** of all bot prompts
- **Version control** of prompt changes

## Architecture

### 1. Prompt Config Service (`promptConfigService.ts`)
- **Loads prompts from server** via `/api/prompts/wellness-stages` endpoint
- **Caches responses** for 5 minutes to reduce server load
- **Fallback to local prompts** if server unavailable
- **Validates response format** to ensure data integrity

### 2. Wellness Stage Service (`wellnessStageService.ts`)
- **Uses remote prompts** for all GPT interactions
- **Async prompt loading** - all methods now return Promises
- **ChatGPT-only approach** - no pattern matching for international support
- **Native conversation flow** - no commands required

### 3. Native User Experience
- **No commands needed** - users just start talking
- **Automatic wellness collection** for new users without data
- **Seamless integration** with existing conversation flow
- **Fallback to normal chat** if wellness system unavailable

## Server API Contract

### Expected Endpoints:

#### 1. `GET /api/prompts` - Wellness Interview Prompts

```typescript
interface PromptsResponse {
  success: boolean;
  data: {
    systemPrompt: string;
    stages: StagePromptConfig[];
  };
  version?: string;
  lastUpdated?: string;
}

interface StagePromptConfig {
  stage: WellnessStage;
  systemPrompt: string;
  stagePrompt: string;
  introductionMessage: string;
  requiredFields: string[];
  completionCriteria: string;
}
```

#### 2. `GET /api/form-schemas` - Wellness Form Schema

```typescript
interface FormSchemaResponse {
  success: boolean;
  data: {
    schema: any; // Wellness form schema structure
    version?: string;
    description?: string;
  };
  lastUpdated?: string;
}
```

### Example Responses:

#### Prompts Response:
```json
{
  "success": true,
  "data": {
    "systemPrompt": "You are a wellness data analyst...",
    "stages": [
      {
        "stage": "demographics_baseline",
        "systemPrompt": "Extract demographic data...",
        "stagePrompt": "STAGE 1: DEMOGRAPHICS...",
        "introductionMessage": "Let's get to know each other!...",
        "requiredFields": ["age", "gender"],
        "completionCriteria": "age + gender + (weight OR height)"
      }
      // ... other stages
    ]
  },
  "version": "1.0.0",
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

#### Form Schema Response:
```json
{
  "success": true,
  "data": {
    "schema": {
      "stages": [
        "demographics_baseline",
        "biometrics_habits", 
        "lifestyle_context",
        "medical_history",
        "goals_preferences"
      ],
      "fields": {
        "demographics_baseline": ["age", "gender", "weight", "height", "location"],
        "biometrics_habits": ["sleep_duration", "daily_steps", "stress_level"],
        "lifestyle_context": ["work_schedule", "workload"],
        "medical_history": ["chronic_conditions", "medications"],
        "goals_preferences": ["health_goals", "activity_preferences"]
      }
    },
    "version": "1.0.0",
    "description": "Wellness form data collection schema"
  },
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

## Configuration

### Environment Variables
```env
# API endpoint base URL
API_BASE_URL=https://your-server.com

# OpenAI API key (required for GPT extraction)  
OPENAI_API_KEY=your_key_here
```

### Cache Settings
- **Cache Duration**: 5 minutes (configurable in `promptConfigService.ts`)
- **Automatic Refresh**: When cache expires
- **Manual Refresh**: Call `promptConfigService.clearCache()`

## Usage Flow

### 1. User starts conversation
```
User: "Hi there!"
Bot: Detects user has no wellness data
     → Loads prompts from server
     → Starts stage 1: Demographics
```

### 2. Server provides prompts
```javascript
// Bot automatically:
const systemPrompt = await promptConfigService.getSystemPrompt();
const stagePrompt = await promptConfigService.getStagePrompt('demographics_baseline');
const intro = await promptConfigService.getStageIntroduction('demographics_baseline');
```

### 3. GPT extraction with server prompts
```javascript
const response = await openai.chat.completions.create({
  messages: [
    { role: 'system', content: systemPrompt + '\n\n' + stagePrompt },
    { role: 'user', content: `User response: "${userInput}"` }
  ]
});
```

## Error Handling

### Server Unavailable
- **Graceful fallback** to hardcoded local prompts
- **Logs warning** but continues operation
- **User experience unaffected**

### Invalid Response Format
- **Validates response structure** before use  
- **Falls back to local prompts** on validation failure
- **Detailed error logging** for debugging

### Network Timeouts
- **Uses configurable timeout** from `config.apiTimeout`
- **Automatic retry** logic (implement if needed)
- **Fallback behavior** maintains service availability

## Testing

All functionality is tested with:
- **Unit tests** for prompt service
- **Integration tests** for wellness flow
- **Mock server responses** for reliable testing
- **Fallback behavior** validation

Run tests:
```bash
npm test -- --testPathPattern=wellnessStageService.test.ts
npm test -- --testPathPattern=nativeWellnessFlow.test.ts
```

## Benefits

1. **Dynamic Updates**: Change prompts without redeployment
2. **A/B Testing**: Different prompt strategies for different users
3. **Analytics**: Track prompt performance on server-side
4. **Consistency**: Centralized prompt management
5. **Scalability**: Easy to add new stages or modify existing ones
6. **Reliability**: Fallback ensures service continuity

## Next Steps

1. **Implement server endpoint** `/api/prompts/wellness-stages`
2. **Deploy prompt management interface** for content editors
3. **Add prompt versioning** and rollback capabilities
4. **Implement A/B testing** framework
5. **Add analytics** for prompt performance tracking

The system is now ready for server-side prompt management! 🚀
