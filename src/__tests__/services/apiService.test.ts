/**
 * Tests for ApiService
 */

import axios from 'axios';
import { WellnessInterview, InterviewResult } from '../../types';

// Import after axios is mocked
let apiService: any;

// Mock axios properly
jest.mock('axios', () => ({
  create: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
}));

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() }
  }
};

// Setup axios.create to return our mock instance before importing ApiService
mockAxios.create.mockReturnValue(mockAxiosInstance as any);

beforeEach(async () => {
  jest.clearAllMocks();
  mockAxios.create.mockReturnValue(mockAxiosInstance as any);
  
  // Import apiService after mocking
  const module = await import('../../services/apiService');
  apiService = module.apiService;
});

describe('ApiService', () => {
  describe('Wellness Interview Operations', () => {
    const mockWellnessInterview: WellnessInterview = {
      id: 'interview-123',
      user_id: 'user-456',
      transcription: 'User: Hi Anna\nAnna: Hello! How are you?',
      summary: 'Basic wellness conversation summary',
      created_at: '2023-12-01T10:00:00Z',
      updated_at: '2023-12-01T10:00:00Z'
    };

    describe('createWellnessInterview', () => {
      it('should create wellness interview successfully', async () => {
        const mockResponse = { data: mockWellnessInterview };
        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        const result = await apiService.createWellnessInterview('test@example.com', {
          transcription: 'Test transcription',
          summary: 'Test summary'
        });

        expect(result).toEqual(mockWellnessInterview);
        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/interviews', {
          email: 'test@example.com',
          transcription: 'Test transcription',
          summary: 'Test summary',
          wellness_data: undefined  // Allow for wellness_data field
        });
      });

      it('should log request data for debugging', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const mockResponse = { data: mockWellnessInterview };
        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        await apiService.createWellnessInterview('test@example.com', {
          transcription: 'Test transcription',
          summary: 'Test summary'
        });

        expect(consoleSpy).toHaveBeenCalledWith(
          'Creating wellness interview with data:',
          expect.objectContaining({
            email: 'test@example.com',
            transcriptionLength: 18,
            summaryLength: 12,
            url: '/interviews'
          })
        );

        consoleSpy.mockRestore();
      });

      it('should handle API errors', async () => {
        const apiError = new Error('API Error');
        (apiError as any).response = {
          status: 400,
          data: { error: 'Invalid data' }
        };
        mockAxiosInstance.post.mockRejectedValue(apiError);

        await expect(apiService.createWellnessInterview('test@example.com', {
          transcription: 'Test',
          summary: 'Test'
        })).rejects.toThrow('API Error');
      });

      it('should send wellness_data when provided', async () => {
        const mockResponse = { data: mockWellnessInterview };
        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        const wellnessData = {
          age: 30,
          weight: 70,
          health_goals: ['lose weight', 'improve fitness']
        };

        const result = await apiService.createWellnessInterview('test@example.com', {
          transcription: 'Test transcription',
          summary: 'Test summary',
          wellness_data: wellnessData
        });

        expect(result).toEqual(mockWellnessInterview);
        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/interviews', {
          email: 'test@example.com',
          transcription: 'Test transcription',
          summary: 'Test summary',
          wellness_data: wellnessData
        });
      });
    });

    describe('getWellnessInterviews', () => {
      it('should retrieve wellness interviews by email', async () => {
        const mockResponse = { 
          data: [mockWellnessInterview]
        };
        mockAxiosInstance.get.mockResolvedValue(mockResponse);

        const result = await apiService.getWellnessInterviews('test@example.com');

        expect(result).toEqual([mockWellnessInterview]);
        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/interviews', {
          params: { email: 'test@example.com' }
        });
      });
    });

    describe('updateWellnessInterview', () => {
      it('should update wellness interview successfully', async () => {
        const updatedInterview = { ...mockWellnessInterview, summary: 'Updated summary' };
        const mockResponse = { data: updatedInterview };
        mockAxiosInstance.put.mockResolvedValue(mockResponse);

        const result = await apiService.updateWellnessInterview(
          'test@example.com',
          'interview-123',
          { summary: 'Updated summary' }
        );

        expect(result).toEqual(updatedInterview);
        expect(mockAxiosInstance.put).toHaveBeenCalledWith(
          '/interviews/interview-123',
          { 
            email: 'test@example.com',
            summary: 'Updated summary' 
          }
        );
      });
    });

    describe('deleteWellnessInterview', () => {
      it('should delete wellness interview successfully', async () => {
        mockAxiosInstance.delete.mockResolvedValue({ data: {} });

        await apiService.deleteWellnessInterview('test@example.com', 'interview-123');

        expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/interviews/interview-123', {
          data: { email: 'test@example.com' }
        });
      });
    });

    describe('getAllUsersWithSessions', () => {
      it('should get all users with complete session history', async () => {
        const mockUsersData = {
          users: [
            {
              email: 'client@example.com',
              session_count: 2,
              sessions: [mockWellnessInterview]
            }
          ]
        };
        const mockResponse = { data: mockUsersData };
        mockAxiosInstance.get.mockResolvedValue(mockResponse);

        const result = await apiService.getAllUsersWithSessions();

        expect(result).toEqual(mockUsersData);
        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/users');
      });
    });
  });

  describe('Interview Results Operations (Auth Required)', () => {
    const mockInterviewResult: InterviewResult = {
      id: 1,
      user_id: 1,
      position: 'Frontend Developer',
      company: 'Tech Corp',
      interview_date: '2023-12-01T14:00:00Z',
      result: 'passed',
      notes: 'Great interview',
      score: 8,
      created_at: '2023-12-01T10:00:00Z',
      updated_at: '2023-12-01T10:00:00Z'
    };

    describe('createInterviewResult', () => {
      it('should create interview result with auth token', async () => {
        const mockResponse = { data: mockInterviewResult };
        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        const result = await apiService.createInterviewResult('auth-token', {
          position: 'Frontend Developer',
          company: 'Tech Corp',
          interview_date: '2023-12-01T14:00:00Z',
          result: 'passed',
          notes: 'Great interview',
          score: 8
        });

        expect(result).toEqual(mockInterviewResult);
        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          '/interviews',
          expect.objectContaining({
            position: 'Frontend Developer',
            company: 'Tech Corp'
          }),
          { headers: { Authorization: 'Bearer auth-token' } }
        );
      });
    });

    describe('getInterviewResults', () => {
      it('should retrieve interview results with auth token', async () => {
        const mockResponse = { data: [mockInterviewResult] };
        mockAxiosInstance.get.mockResolvedValue(mockResponse);

        const result = await apiService.getInterviewResults('auth-token');

        expect(result).toEqual([mockInterviewResult]);
        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/interviews', {
          headers: { Authorization: 'Bearer auth-token' }
        });
      });
    });
  });

  describe('User Authentication', () => {
    describe('registerUser', () => {
      it('should register user successfully', async () => {
        const mockAuthResponse = {
          token: 'jwt-token',
          user: { id: 1, email: 'test@example.com', name: 'Test User' }
        };
        const mockResponse = { data: mockAuthResponse };
        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        const result = await apiService.registerUser('test@example.com', 'password123', 'Test User');

        expect(result).toEqual(mockAuthResponse);
        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/users/register', {
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User'
        });
      });
    });

    describe('loginUser', () => {
      it('should login user successfully', async () => {
        const mockAuthResponse = {
          token: 'jwt-token',
          user: { id: 1, email: 'test@example.com', name: 'Test User' }
        };
        const mockResponse = { data: mockAuthResponse };
        mockAxiosInstance.post.mockResolvedValue(mockResponse);

        const result = await apiService.loginUser('test@example.com', 'password123');

        expect(result).toEqual(mockAuthResponse);
        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/users/login', {
          email: 'test@example.com',
          password: 'password123'
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      mockAxiosInstance.post.mockRejectedValue(networkError);

      await expect(apiService.createWellnessInterview('test@example.com', {
        transcription: 'Test',
        summary: 'Test'
      })).rejects.toMatchObject({
        message: 'Network Error'
      });
    });

    it('should handle 404 errors', async () => {
      const notFoundError = new Error('Interview not found');
      (notFoundError as any).response = {
        status: 404,
        data: { message: 'Interview not found' }
      };
      mockAxiosInstance.get.mockRejectedValue(notFoundError);

      await expect(apiService.getWellnessInterviews('test@example.com'))
        .rejects.toMatchObject({
          message: 'Interview not found'
        });
    });
  });
});
