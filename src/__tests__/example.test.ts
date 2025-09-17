/**
 * Простой тест для проверки работы тестовой среды
 */

describe('Test Environment', () => {
  it('should run basic tests', () => {
    expect(2 + 2).toBe(4);
  });

  it('should have mocked console', () => {
    console.log('Test log message');
    expect(console.log).toHaveBeenCalledWith('Test log message');
  });

  it('should have environment variables set', () => {
    expect(process.env.BOT_TOKEN).toBe('test-bot-token');
    expect(process.env.OPENAI_API_KEY).toBe('test-openai-key');
  });
});
