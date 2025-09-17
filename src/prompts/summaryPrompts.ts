/**
 * Промпты для генерации wellness summary
 */

export const WELLNESS_SUMMARY_SYSTEM_PROMPT = `You are a wellness data analyst. Analyze conversation transcripts and extracted user data to create comprehensive wellness summaries.`;

export const generateWellnessSummaryPrompt = (
  transcription: string,
  extractedUserInfo: any
): string => {
  return `You are a wellness data analyst. Analyze this conversation transcript and extracted user data to create a comprehensive wellness summary.

CONVERSATION TRANSCRIPT:
${transcription}

EXTRACTED USER DATA:
${JSON.stringify(extractedUserInfo, null, 2)}

Create a structured wellness summary in the following format:

## WELLNESS PROFILE SUMMARY

### DEMOGRAPHICS & BASELINE
- Age: ${extractedUserInfo.age || 'Not specified'}
- Gender: ${extractedUserInfo.gender || 'Not specified'}
- Location: ${extractedUserInfo.location || 'Not specified'}
- Weight: ${extractedUserInfo.weight || 'Not specified'}
- Height: ${extractedUserInfo.height || 'Not specified'}
- BMI: ${extractedUserInfo.bmi || 'Not calculated'}

### BIOMETRICS & DAILY HABITS
- Daily Steps: ${extractedUserInfo.daily_steps || 'Not specified'}
- Sleep Duration: ${extractedUserInfo.sleep_duration || 'Not specified'} hours
- Sleep Quality: ${extractedUserInfo.sleep_quality || 'Not discussed'}
- Resting Heart Rate: ${extractedUserInfo.resting_heart_rate || 'Not specified'} bpm
- Stress Level: ${extractedUserInfo.stress_level || 'Not assessed'}
- Hydration: ${extractedUserInfo.hydration_level || 'Not discussed'}
- Caffeine Intake: ${extractedUserInfo.caffeine_intake || 'Not specified'}
- Alcohol Consumption: ${extractedUserInfo.alcohol_intake || 'Not specified'}

### LIFESTYLE CONTEXT
- Work Schedule: ${extractedUserInfo.work_schedule || 'Not specified'}
- Workload: ${extractedUserInfo.workload || 'Not discussed'}
- Night Shifts: ${extractedUserInfo.night_shifts ? 'Yes' : 'No/Not specified'}
- Business Travel: ${extractedUserInfo.business_travel ? 'Frequent' : 'Rare/Not specified'}
- Family Obligations: ${extractedUserInfo.family_obligations?.length ? extractedUserInfo.family_obligations.join(', ') : 'Not discussed'}
- Recovery Resources: ${extractedUserInfo.recovery_resources?.length ? extractedUserInfo.recovery_resources.join(', ') : 'Not discussed'}

### MEDICAL HISTORY & HEALTH
- Chronic Conditions: ${extractedUserInfo.chronic_conditions?.length ? extractedUserInfo.chronic_conditions.join(', ') : 'None mentioned'}
- Injuries: ${extractedUserInfo.injuries?.length ? extractedUserInfo.injuries.join(', ') : 'None mentioned'}
- Medications: ${extractedUserInfo.medications?.length ? extractedUserInfo.medications.join(', ') : 'None mentioned'}
- Supplements: ${extractedUserInfo.supplements?.length ? extractedUserInfo.supplements.join(', ') : 'None mentioned'}
- Contraindications: ${extractedUserInfo.contraindications?.length ? extractedUserInfo.contraindications.join(', ') : 'None mentioned'}

### GOALS & PREFERENCES
- Health Goals: ${extractedUserInfo.health_goals?.length ? extractedUserInfo.health_goals.join(', ') : 'Not specified'}
- Motivation Level: ${extractedUserInfo.motivation_level || 'Not assessed'}
- Chronotype: ${extractedUserInfo.morning_evening_type || 'Not determined'}
- Activity Preferences: ${extractedUserInfo.activity_preferences?.length ? extractedUserInfo.activity_preferences.join(', ') : 'Not discussed'}
- Nutrition Habits: ${extractedUserInfo.nutrition_habits?.length ? extractedUserInfo.nutrition_habits.join(', ') : 'Not discussed'}
- Coaching Style Preference: ${extractedUserInfo.coaching_style_preference || 'Not specified'}

### KEY INSIGHTS & OPPORTUNITIES
Based on the conversation and extracted data, provide:
- Main wellness challenges identified
- Strengths and positive habits
- Priority areas for improvement
- Recommended next steps
- Potential risk factors to monitor

### CONVERSATION QUALITY
- Total messages exchanged: [Count from transcript]
- Key topics discussed: [Summarize main themes]
- Data completeness: [Assess how much information was gathered]
- Engagement level: [Assess user's openness and detail in responses]

Format this as a comprehensive but readable wellness assessment. Include specific details mentioned in the conversation. If information is not available, note "Not discussed" or "Not specified" rather than making assumptions.

Focus on creating actionable insights based on the available data.`;
};

export const SUMMARY_SCHEMA_DESCRIPTION = `
The wellness summary should follow this structure:
1. Demographics & Baseline (age, gender, physical stats)
2. Biometrics & Daily Habits (sleep, activity, stress, nutrition)
3. Lifestyle Context (work, travel, family, resources)
4. Medical History & Health (conditions, medications, restrictions)
5. Goals & Preferences (objectives, motivation, preferences)
6. Key Insights & Opportunities (analysis and recommendations)
7. Conversation Quality (metadata about the interaction)
`;
