import { userService } from '../services/userService';

describe('UserService', () => {
  beforeEach(() => {
    // Clear users before each test
    userService.removeUser('123');
    userService.removeUser('456');
  });

  test('should set and get user data', () => {
    const userData = {
      telegramId: '123',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
    };

    userService.setUser('123', userData);
    const user = userService.getUser('123');

    expect(user).toMatchObject(userData);
    expect(user?.isAuthenticated).toBe(false);
  });

  test('should authenticate user', () => {
    userService.setUser('123', { telegramId: '123' });
    userService.authenticate('123', 'test-token', 1);

    const user = userService.getUser('123');
    expect(user?.isAuthenticated).toBe(true);
    expect(user?.apiToken).toBe('test-token');
    expect(user?.userId).toBe(1);
    expect(userService.isAuthenticated('123')).toBe(true);
  });

  test('should logout user', () => {
    userService.setUser('123', { telegramId: '123' });
    userService.authenticate('123', 'test-token', 1);
    userService.logout('123');

    const user = userService.getUser('123');
    expect(user?.isAuthenticated).toBe(false);
    expect(user?.apiToken).toBeUndefined();
    expect(user?.userId).toBeUndefined();
    expect(userService.isAuthenticated('123')).toBe(false);
  });

  test('should get API token', () => {
    userService.setUser('123', { telegramId: '123' });
    userService.authenticate('123', 'test-token', 1);

    expect(userService.getApiToken('123')).toBe('test-token');
    expect(userService.getApiToken('456')).toBeNull();
  });

  test('should count users correctly', () => {
    expect(userService.getUserCount()).toBe(0);
    
    userService.setUser('123', { telegramId: '123' });
    expect(userService.getUserCount()).toBe(1);
    
    userService.setUser('456', { telegramId: '456' });
    expect(userService.getUserCount()).toBe(2);
    
    userService.authenticate('123', 'token', 1);
    expect(userService.getAuthenticatedUserCount()).toBe(1);
  });
});
