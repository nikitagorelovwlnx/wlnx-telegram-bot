# 🧪 Testing Guide for WLNX Telegram Bot

## ✅ Complete test suite with external service mocking

### 📁 Test Structure

```
src/__tests__/
├── setup.ts                           # Настройка Jest и моки
├── example.test.ts                     # Простой тест для проверки
├── README.md                           # Документация тестов
├── services/
│   ├── conversationService.test.ts     # Тесты AI сервиса
│   └── apiService.test.ts              # Тесты API клиента
├── handlers/
│   └── commandHandler.test.ts          # Тесты команд бота
├── data-extraction/
│   └── userInfoExtraction.test.ts      # Тесты извлечения данных
└── integration/
    └── bot-workflow.test.ts            # End-to-end тесты
```

### 🚀 Running Tests

```bash
# All tests
npm test

# Tests with code coverage
npm run test:coverage

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode (restart on changes)
npm run test:watch
```

### 🔧 What's Mocked

#### External APIs
- **OpenAI API** - returns predictable responses
- **HTTP calls (Axios)** - fully mocked
- **Telegram Bot API** - Context and actions emulation

#### Internal Services
- **Logging** - intercepted by Jest
- **Environment variables** - configured for tests
- **File system** - not used

### 📈 Test Coverage

#### ConversationService
- ✅ AI response generation
- ✅ User data extraction (demographics, biometrics, medical, goals)
- ✅ Wellness summary creation using extracted data
- ✅ OpenAI error handling

#### ApiService
- ✅ CRUD operations for wellness interviews
- ✅ User authentication
- ✅ HTTP error handling
- ✅ API request logging

#### CommandHandler
- ✅ Bot commands (/start, /help, /settings)
- ✅ Natural dialogue with AI
- ✅ User registration
- ✅ Manual and automatic interview saving

#### Data Extraction
- ✅ Age, weight, height extraction
- ✅ Biometric data (sleep, steps, pulse)
- ✅ Medical information
- ✅ Goals and preferences
- ✅ Data deduplication

#### Integration Tests
- ✅ Full cycle: registration → dialogue → saving
- ✅ Auto-save after 6+ messages
- ✅ Data consistency between extraction and summary
- ✅ API error handling
- ✅ Performance with large conversations

### 🎯 Usage Examples

#### Data extraction test
```typescript
it('should extract comprehensive user data', () => {
  const conversation = [
    { role: 'user', content: "I'm Sarah, 28, weigh 65kg, sleep 7 hours" }
  ];
  
  const result = conversationService.extractUserInfo(conversation);
  
  expect(result.age).toBe(28);
  expect(result.weight).toBe(65);
  expect(result.sleep_duration).toBe(7);
});
```

#### API test with mocking
```typescript
it('should create wellness interview', async () => {
  mockAxiosInstance.post.mockResolvedValue({ data: mockInterview });
  
  const result = await apiService.createWellnessInterview('test@example.com', {
    transcription: 'Test',
    summary: 'Test summary'
  });
  
  expect(result).toEqual(mockInterview);
});
```

#### Integration test
```typescript
it('should complete full wellness interview flow', async () => {
  // 1. Registration
  await CommandHandler.start(mockCtx);
  await CommandHandler.handleRegistrationFlow(mockCtx, 'John');
  
  // 2. Dialogue
  await CommandHandler.handleNaturalConversation(mockCtx, "I'm 30 years old");
  
  // 3. Saving
  await CommandHandler.saveConversation(mockCtx);
  
  expect(mockApiService.createWellnessInterview).toHaveBeenCalled();
});
```

### 🔍 Test Debugging

```bash
# Run with detailed output
npm test -- --verbose

# Debug specific test
npm test -- --testNamePattern="should extract age"

# Only failed tests
npm test -- --onlyFailures
```

### 🛡️ Edge Cases

Tests cover:
- Empty/invalid data
- API errors (400, 404, 500)
- Network issues
- Large data volumes (100+ messages)
- Data privacy
- Performance

### 📈 CI/CD Integration

Tests are ready for:
- GitHub Actions
- GitLab CI
- Jenkins
- Any CI/CD pipeline with Node.js

### 🔐 Security

- Mocks don't contain real API keys
- Test data doesn't contain PII
- Logging filters confidential information

### 📝 Adding New Tests

1. Create file in appropriate folder
2. Import setup and dependencies
3. Set up mocks in `beforeEach`
4. Follow patterns of existing tests
5. Ensure cleanup after tests

### 🏆 Target Coverage Metrics

- **Statements**: > 80%
- **Branches**: > 75% 
- **Functions**: > 85%
- **Lines**: > 80%

### 💡 Best Practices

- Isolated tests
- Predictable mocks
- Readable assertions
- Edge case testing
- Fast execution (< 30 sec for all tests)

---

**Ready to run!** 🚀

All tests are configured and ready to verify bot functionality with full external service mocking.
