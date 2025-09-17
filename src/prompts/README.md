# Prompts for WLNX Telegram Bot

This directory contains prompts separated into individual files for easy management and editing.

## Structure

### `conversationPrompts.ts`
Contains prompts for bot conversation:
- **CONVERSATION_PERSONA_PROMPT** - main prompt for Anna persona
- **FIRST_MESSAGE_CONTEXT** - context for first message
- **CONVERSATION_SYSTEM_PROMPT** - system prompt for conversations

### `summaryPrompts.ts`
Contains prompts for wellness summary generation:
- **WELLNESS_SUMMARY_SYSTEM_PROMPT** - system prompt for analyst
- **generateWellnessSummaryPrompt()** - function for generating detailed prompt using extracted data
- **SUMMARY_SCHEMA_DESCRIPTION** - summary schema description

## How it works

1. **Conversation**: Bot uses prompts from `conversationPrompts.ts` for user communication
2. **Data extraction**: `extractUserInfo()` analyzes conversation and extracts structured data
3. **Summary generation**: `generateWellnessSummary()` uses prompts from `summaryPrompts.ts` + extracted data to create detailed report
4. **Saving**: API receives transcription + enhanced summary (which now contains all extracted attributes in structured format)

## Benefits

- ✅ Prompts are easy to edit separately
- ✅ Summary now uses extracted data
- ✅ Simple API structure is preserved (transcription + summary)
- ✅ All wellness attributes are included in summary in structured format
- ✅ Logging allows tracking extracted data
