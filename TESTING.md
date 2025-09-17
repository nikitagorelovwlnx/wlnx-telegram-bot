# 🧪 Руководство по тестированию WLNX Telegram Bot

## ✅ Полный комплект тестов с мокированием внешних сервисов

### 📁 Структура тестов

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

### 🚀 Запуск тестов

```bash
# Все тесты
npm test

# Тесты с покрытием кода
npm run test:coverage

# Только unit тесты
npm run test:unit

# Только интеграционные тесты
npm run test:integration

# Режим наблюдения (перезапуск при изменениях)
npm run test:watch
```

### 🔧 Что замокировано

#### External APIs
- **OpenAI API** - возвращает предсказуемые ответы
- **HTTP вызовы (Axios)** - полностью замокированы
- **Telegram Bot API** - эмуляция Context и действий

#### Internal Services
- **Логирование** - перехватывается Jest
- **Переменные окружения** - настроены для тестов
- **Файловая система** - не используется

### 📊 Покрытие тестами

#### ConversationService
- ✅ Генерация ответов AI
- ✅ Извлечение пользовательских данных (demographics, biometrics, medical, goals)
- ✅ Создание wellness summary с использованием извлеченных данных
- ✅ Обработка ошибок OpenAI

#### ApiService
- ✅ CRUD операции wellness интервью
- ✅ Аутентификация пользователей
- ✅ Обработка HTTP ошибок
- ✅ Логирование API запросов

#### CommandHandler
- ✅ Команды бота (/start, /help, /settings)
- ✅ Естественный диалог с AI
- ✅ Регистрация пользователей
- ✅ Ручное и автоматическое сохранение интервью

#### Data Extraction
- ✅ Извлечение возраста, веса, роста
- ✅ Биометрические данные (сон, шаги, пульс)
- ✅ Медицинская информация
- ✅ Цели и предпочтения
- ✅ Дедупликация данных

#### Integration Tests
- ✅ Полный цикл: регистрация → диалог → сохранение
- ✅ Автосохранение после 6+ сообщений
- ✅ Консистентность данных между extraction и summary
- ✅ Обработка ошибок API
- ✅ Производительность с большими разговорами

### 🎯 Примеры использования

#### Тест извлечения данных
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

#### Тест API с мокированием
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

#### Интеграционный тест
```typescript
it('should complete full wellness interview flow', async () => {
  // 1. Регистрация
  await CommandHandler.start(mockCtx);
  await CommandHandler.handleRegistrationFlow(mockCtx, 'John');
  
  // 2. Диалог
  await CommandHandler.handleNaturalConversation(mockCtx, "I'm 30 years old");
  
  // 3. Сохранение
  await CommandHandler.saveConversation(mockCtx);
  
  expect(mockApiService.createWellnessInterview).toHaveBeenCalled();
});
```

### 🔍 Отладка тестов

```bash
# Запуск с детальным выводом
npm test -- --verbose

# Отладка конкретного теста
npm test -- --testNamePattern="should extract age"

# Только неудачные тесты
npm test -- --onlyFailures
```

### 🛡️ Edge Cases

Тесты покрывают:
- Пустые/некорректные данные
- API ошибки (400, 404, 500)
- Сетевые проблемы
- Большие объемы данных (100+ сообщений)
- Конфиденциальность данных
- Производительность

### 📈 CI/CD Integration

Тесты готовы для:
- GitHub Actions
- GitLab CI
- Jenkins
- Любой CI/CD pipeline с Node.js

### 🔐 Безопасность

- Моки не содержат реальных API ключей
- Тестовые данные не содержат PII
- Логирование фильтрует конфиденциальную информацию

### 📝 Добавление новых тестов

1. Создать файл в соответствующей папке
2. Импортировать setup и зависимости
3. Настроить моки в `beforeEach`
4. Следовать паттернам существующих тестов
5. Обеспечить очистку после тестов

### 🏆 Целевые метрики покрытия

- **Statements**: > 80%
- **Branches**: > 75% 
- **Functions**: > 85%
- **Lines**: > 80%

### 💡 Лучшие практики

- Изолированные тесты
- Предсказуемые моки
- Читаемые assertion'ы
- Тестирование edge cases
- Быстрое выполнение (< 30 сек для всех тестов)

---

**Готово к запуску!** 🚀

Все тесты настроены и готовы для проверки функциональности бота с полным мокированием внешних сервисов.
