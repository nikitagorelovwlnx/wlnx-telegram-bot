# Tests for WLNX Telegram Bot

This directory contains comprehensive tests for the Telegram bot with external service mocking.

## Test Structure

### `setup.ts`
Test environment setup:
- OpenAI API mocking
- Axios mocking for API calls
- Telegraf mocking
- Environment variables setup

### `services/`
**conversationService.test.ts**
- AI response generation tests
- User data extraction tests
- Wellness summary generation tests
- OpenAI error handling

**apiService.test.ts**
- CRUD operations tests for wellness interviews
- User authentication tests
- API error handling tests
- Axios request mocking

### `handlers/`
**commandHandler.test.ts**
- Bot command tests (/start, /help, etc.)
- Natural dialogue tests
- User registration tests
- Interview saving tests

### `data-extraction/`
**userInfoExtraction.test.ts**
- Detailed demographic data extraction tests
- Biometric indicators tests
- Medical information tests
- Goals and preferences tests
- Data deduplication tests

### `integration/`
**bot-workflow.test.ts**
- Full cycle: registration → dialogue → extraction → saving
- Auto-save tests
- Data consistency tests
- Performance tests
- Data privacy tests

## Running Tests

```bash
# All tests
npm test

# Specific test
npm test -- conversationService.test.ts

# With code coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Mocking Setup

### OpenAI API
Mocked in `setup.ts`, returns predictable responses for testing.

### Axios/API calls
Each test configures its own mock responses via `mockAxiosInstance`.

### Telegram Bot API
Telegraf and Context are mocked for interaction simulation.

## Testing Patterns

### 1. Test Isolation
Each test is independent and clears state in `beforeEach`.

### 2. External Dependency Mocking
- OpenAI API
- HTTP requests
- Telegram API
- Logging

### 3. Edge Case Testing
- Empty/invalid data
- API errors
- Network issues
- Large data volumes

### 4. Integration Tests
Test complete user scenarios end-to-end.

## Coverage Metrics

Target metrics:
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 85%
- **Lines**: > 80%

## Test Debugging

```bash
# Run with detailed output
npm test -- --verbose

# Debug specific test
npm test -- --testNamePattern="should extract age"

# Only failed tests
npm test -- --onlyFailures
```

## Continuous Integration

Tests run automatically on:
- Push to any branch
- Pull Request
- Scheduled builds

## Adding New Tests

1. Create file in appropriate folder
2. Import necessary dependencies
3. Set up mocking in `beforeEach`
4. Write tests following existing patterns
5. Ensure state cleanup after tests
