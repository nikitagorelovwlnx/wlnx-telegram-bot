/**
 * Tests for helper utilities
 */

import { getUserInfo, validateEmail, validatePassword, logUserAction, isAdmin, handleError } from '../../utils/helpers';
import { Context } from 'telegraf';

describe('Helper Utilities', () => {
  describe('getUserInfo', () => {
    it('should extract user info from context', () => {
      const mockCtx = {
        from: {
          id: 123456789,
          first_name: 'John',
          last_name: 'Doe',
          username: 'johndoe'
        }
      } as Context;

      const result = getUserInfo(mockCtx);

      expect(result).toEqual({
        id: 123456789,
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe'
      });
    });

    it('should handle missing optional fields', () => {
      const mockCtx = {
        from: {
          id: 123456789,
          first_name: 'John',
          is_bot: false
          // No last_name or username
        }
      } as Context;

      const result = getUserInfo(mockCtx);

      expect(result).toEqual({
        id: 123456789,
        firstName: 'John',
        lastName: undefined,
        username: undefined
      });
    });

    it('should handle missing from field', () => {
      const mockCtx = {} as Context;

      const result = getUserInfo(mockCtx);

      expect(result).toEqual({
        id: 0,
        firstName: 'Unknown',
        lastName: undefined,
        username: undefined
      });
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com'
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        'user..name@example.com',
        'user name@example.com',
        ''
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  describe('validatePassword', () => {
    it('should accept valid passwords', () => {
      const validPasswords = [
        'password123',
        'mySecurePass',
        '123456',
        'a'.repeat(20)
      ];

      validPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.valid).toBe(true);
        expect(result.message).toBeUndefined();
      });
    });

    it('should reject short passwords', () => {
      const shortPasswords = [
        '12345',
        'abc',
        'a',
        ''
      ];

      shortPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.message).toBe('Password must be at least 6 characters long');
      });
    });
  });

  describe('logUserAction', () => {
    it('should log user actions', () => {
      const mockCtx = {
        from: {
          id: 123456789,
          first_name: 'John',
          username: 'johndoe'
        }
      } as Context;

      // Should not throw
      expect(() => logUserAction(mockCtx, 'test_action')).not.toThrow();
    });

    it('should handle missing user info', () => {
      const mockCtx = {} as Context;

      // Should not throw
      expect(() => logUserAction(mockCtx, 'test_action')).not.toThrow();
    });
  });

  describe('isAdmin', () => {
    it('should return false for non-admin users', () => {
      const mockCtx = {
        from: {
          id: 123456789,
          username: 'regular_user'
        }
      } as Context;

      expect(isAdmin(mockCtx)).toBe(false);
    });

    it('should handle missing user info', () => {
      const mockCtx = {} as Context;

      expect(isAdmin(mockCtx)).toBe(false);
    });
  });

  describe('handleError', () => {
    it('should handle errors with reply promise', async () => {
      const mockCtx = {
        reply: jest.fn().mockResolvedValue({})
      } as any;

      const error = new Error('Test error');

      // Should not throw
      expect(() => handleError(mockCtx, error)).not.toThrow();
      expect(mockCtx.reply).toHaveBeenCalledWith('Something went wrong. Please try again later.');
    });

    it('should handle errors with non-promise reply', () => {
      const mockCtx = {
        reply: jest.fn().mockReturnValue(undefined)
      } as any;

      const error = new Error('Test error');

      // Should not throw
      expect(() => handleError(mockCtx, error)).not.toThrow();
      expect(mockCtx.reply).toHaveBeenCalledWith('Something went wrong. Please try again later.');
    });

    it('should handle custom error messages', () => {
      const mockCtx = {
        reply: jest.fn().mockResolvedValue({})
      } as any;

      const error = new Error('Test error');
      const customMessage = 'Custom error message';

      handleError(mockCtx, error, customMessage);

      expect(mockCtx.reply).toHaveBeenCalledWith(customMessage);
    });

    it('should handle reply errors gracefully', () => {
      const mockCtx = {
        reply: jest.fn().mockRejectedValue(new Error('Reply failed'))
      } as any;

      const error = new Error('Test error');

      // Should not throw even if reply fails
      expect(() => handleError(mockCtx, error)).not.toThrow();
    });
  });
});
