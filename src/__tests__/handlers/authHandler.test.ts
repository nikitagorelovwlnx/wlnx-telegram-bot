/**
 * Tests for AuthHandler
 */

import { AuthHandler } from '../../handlers/authHandler';
import { userService } from '../../services/userService';
import { apiService } from '../../services/apiService';
import { Context } from 'telegraf';

// Mock dependencies
jest.mock('../../services/userService');
jest.mock('../../services/apiService');
jest.mock('../../utils/helpers');

const mockUserService = userService as jest.Mocked<typeof userService>;
const mockApiService = apiService as jest.Mocked<typeof apiService>;

// Mock context
const createMockContext = (override: Partial<Context> = {}): Context => ({
  reply: jest.fn().mockResolvedValue({}),
  from: {
    id: 123456789,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    is_bot: false
  },
  chat: {
    id: 123456789,
    type: 'private'
  },
  message: {
    message_id: 1,
    from: {
      id: 123456789,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      is_bot: false
    },
    chat: {
      id: 123456789,
      type: 'private'
    },
    date: Date.now() / 1000,
    text: 'test message'
  },
  ...override
} as Context);

// Mock getUserInfo helper
jest.mock('../../utils/helpers', () => ({
  getUserInfo: jest.fn((ctx) => ({
    id: ctx.from?.id || 123456789,
    username: ctx.from?.username || 'testuser',
    firstName: ctx.from?.first_name || 'Test',
    lastName: ctx.from?.last_name || 'User'
  })),
  handleError: jest.fn(),
  logUserAction: jest.fn(),
  validateEmail: jest.fn((email) => email.includes('@')),
  validatePassword: jest.fn((password) => ({ valid: password.length >= 6 }))
}));

describe('AuthHandler', () => {
  let mockCtx: Context;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = createMockContext();
  });

  describe('startRegistration', () => {
    it('should start registration flow', async () => {
      await AuthHandler.startRegistration(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('WLNX Registration'),
        expect.objectContaining({ parse_mode: 'Markdown' })
      );
      expect(mockUserService.setUser).toHaveBeenCalledWith(
        '123456789',
        expect.objectContaining({
          telegramId: '123456789',
          username: 'testuser',
          firstName: 'Test'
        })
      );
    });
  });

  describe('handleEmailInput', () => {
    it('should handle valid email input', async () => {
      const { validateEmail } = require('../../utils/helpers');
      validateEmail.mockReturnValue(true);

      await AuthHandler.handleEmailInput(mockCtx, 'test@example.com');

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('password')
      );
      expect(mockUserService.setUser).toHaveBeenCalledWith(
        '123456789',
        expect.objectContaining({
          email: 'test@example.com'
        })
      );
    });

    it('should reject invalid email format', async () => {
      const { validateEmail } = require('../../utils/helpers');
      validateEmail.mockReturnValue(false);

      await AuthHandler.handleEmailInput(mockCtx, 'invalid-email');

      expect(mockCtx.reply).toHaveBeenCalledWith('❌ Invalid email format. Try again:');
    });
  });

  describe('handlePasswordInput', () => {
    it('should handle valid password', async () => {
      const { validatePassword } = require('../../utils/helpers');
      validatePassword.mockReturnValue({ valid: true });

      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        email: 'test@example.com'
      } as any);

      mockApiService.registerUser.mockResolvedValue({
        success: true,
        user: { id: '123', email: 'test@example.com' },
        token: 'test-token'
      } as any);

      await AuthHandler.handlePasswordInput(mockCtx, 'password123');

      expect(mockApiService.registerUser).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Registration successful')
      );
    });

    it('should reject weak password', async () => {
      const { validatePassword } = require('../../utils/helpers');
      validatePassword.mockReturnValue({ valid: false, message: 'Password too short' });

      await AuthHandler.handlePasswordInput(mockCtx, '123');

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Password too short')
      );
    });
  });

  describe('startLogin', () => {
    it('should start login flow', async () => {
      await AuthHandler.startLogin(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Login'),
        expect.objectContaining({ parse_mode: 'Markdown' })
      );
    });
  });

  describe('handleLoginPassword', () => {
    it('should handle successful login', async () => {
      mockApiService.loginUser.mockResolvedValue({
        success: true,
        user: { id: '123', email: 'test@example.com' },
        token: 'test-token'
      } as any);

      await AuthHandler.handleLoginPassword(mockCtx, 'test@example.com', 'password123');

      expect(mockApiService.loginUser).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Login successful')
      );
    });

    it('should handle login failure', async () => {
      mockApiService.loginUser.mockRejectedValue(new Error('Invalid credentials'));

      await AuthHandler.handleLoginPassword(mockCtx, 'test@example.com', 'wrongpassword');

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Login failed')
      );
    });
  });

  describe('logout', () => {
    it('should handle logout for authenticated user', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        email: 'test@example.com',
        isAuthenticated: true
      } as any);

      await AuthHandler.logout(mockCtx);

      expect(mockUserService.logout).toHaveBeenCalledWith('123456789');
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('logged out')
      );
    });

    it('should handle logout for non-authenticated user', async () => {
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        isAuthenticated: false
      } as any);

      await AuthHandler.logout(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('not authenticated')
      );
    });

    it('should handle logout for non-existent user', async () => {
      mockUserService.getUser.mockReturnValue(null);

      await AuthHandler.logout(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('not authenticated')
      );
    });
  });

  describe('checkAuth', () => {
    it('should check authentication status', async () => {
      mockUserService.isAuthenticated.mockReturnValue(true);
      mockUserService.getUser.mockReturnValue({
        telegramId: '123456789',
        email: 'test@example.com',
        isAuthenticated: true
      } as any);

      await AuthHandler.checkAuth(mockCtx);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('authenticated')
      );
    });
  });

  describe('error handling', () => {
    it('should handle errors in startRegistration gracefully', async () => {
      mockUserService.setUser.mockImplementation(() => {
        throw new Error('Database error');
      });

      // Should not throw
      await expect(AuthHandler.startRegistration(mockCtx)).resolves.not.toThrow();
    });

    it('should handle errors in logout gracefully', async () => {
      mockUserService.getUser.mockImplementation(() => {
        throw new Error('Service error');
      });

      // Should not throw
      await expect(AuthHandler.logout(mockCtx)).resolves.not.toThrow();
    });
  });
});
