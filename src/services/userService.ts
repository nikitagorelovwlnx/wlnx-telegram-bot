import { BotUser } from '../types';

class UserService {
  private users: Map<string, BotUser> = new Map();

  // Store user session data
  setUser(telegramId: string, userData: Partial<BotUser>): void {
    const existingUser = this.users.get(telegramId) || {
      telegramId,
      isAuthenticated: false,
    };

    const updatedUser: BotUser = {
      ...existingUser,
      ...userData,
    };

    this.users.set(telegramId, updatedUser);
  }

  // Get user session data
  getUser(telegramId: string): BotUser | null {
    return this.users.get(telegramId) || null;
  }

  // Check if user is authenticated
  isAuthenticated(telegramId: string): boolean {
    const user = this.getUser(telegramId);
    return !!(user?.isAuthenticated && user.apiToken);
  }

  // Get user's API token
  getApiToken(telegramId: string): string | null {
    const user = this.getUser(telegramId);
    return user?.apiToken || null;
  }

  // Set user as authenticated with API token
  authenticate(telegramId: string, apiToken: string, userId: number): void {
    this.setUser(telegramId, {
      apiToken,
      userId,
      isAuthenticated: true,
    });
  }

  // Logout user
  logout(telegramId: string): void {
    this.setUser(telegramId, {
      apiToken: undefined,
      userId: undefined,
      isAuthenticated: false,
    });
  }

  // Get all authenticated users
  getAuthenticatedUsers(): BotUser[] {
    return Array.from(this.users.values()).filter(user => user.isAuthenticated);
  }

  // Remove user session
  removeUser(telegramId: string): void {
    this.users.delete(telegramId);
  }

  // Get user count
  getUserCount(): number {
    return this.users.size;
  }

  // Get authenticated user count
  getAuthenticatedUserCount(): number {
    return this.getAuthenticatedUsers().length;
  }
}

export const userService = new UserService();
