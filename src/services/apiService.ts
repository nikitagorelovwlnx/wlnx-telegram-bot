import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '../config';
import { 
  User, 
  AuthResponse, 
  CalendarIntegration, 
  TelegramIntegration, 
  InterviewResult,
  WellnessInterview,
  ApiError 
} from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: config.apiTimeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for adding auth token
    this.api.interceptors.request.use((config) => {
      const token = this.getStoredToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        const apiError: ApiError = {
          message: error.response?.data?.message || error.message || 'Unknown API error',
          status: error.response?.status,
          code: error.response?.data?.code,
        };
        throw apiError;
      }
    );
  }

  private getStoredToken(): string | null {
    // In a real implementation, you might store tokens in a database
    // For now, we'll handle tokens per session
    return null;
  }

  // User Authentication
  async registerUser(email: string, password: string, name?: string): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/users/register', {
      email,
      password,
      name,
    });
    return response.data;
  }

  async loginUser(email: string, password: string): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/users/login', {
      email,
      password,
    });
    return response.data;
  }

  async getCurrentUser(token: string): Promise<User> {
    const response: AxiosResponse<User> = await this.api.get('/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  async updateUser(token: string, userData: Partial<User>): Promise<User> {
    const response: AxiosResponse<User> = await this.api.put('/users/me', userData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  // Calendar Integration
  async createCalendarIntegration(
    token: string,
    integrationData: Omit<CalendarIntegration, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<CalendarIntegration> {
    const response: AxiosResponse<CalendarIntegration> = await this.api.post('/calendar', integrationData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  async getCalendarIntegrations(token: string): Promise<CalendarIntegration[]> {
    const response: AxiosResponse<CalendarIntegration[]> = await this.api.get('/calendar', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  async updateCalendarIntegration(
    token: string,
    id: number,
    integrationData: Partial<CalendarIntegration>
  ): Promise<CalendarIntegration> {
    const response: AxiosResponse<CalendarIntegration> = await this.api.put(`/calendar/${id}`, integrationData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  async deleteCalendarIntegration(token: string, id: number): Promise<void> {
    await this.api.delete(`/calendar/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // Telegram Integration
  async createTelegramIntegration(
    token: string,
    integrationData: Omit<TelegramIntegration, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<TelegramIntegration> {
    const response: AxiosResponse<TelegramIntegration> = await this.api.post('/telegram', integrationData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  async getTelegramIntegrations(token: string): Promise<TelegramIntegration[]> {
    const response: AxiosResponse<TelegramIntegration[]> = await this.api.get('/telegram', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  async updateTelegramIntegration(
    token: string,
    id: number,
    integrationData: Partial<TelegramIntegration>
  ): Promise<TelegramIntegration> {
    const response: AxiosResponse<TelegramIntegration> = await this.api.put(`/telegram/${id}`, integrationData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  async deleteTelegramIntegration(token: string, id: number): Promise<void> {
    await this.api.delete(`/telegram/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // Interview Results
  async createInterviewResult(
    token: string,
    interviewData: Omit<InterviewResult, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<InterviewResult> {
    const response: AxiosResponse<InterviewResult> = await this.api.post('/interviews', interviewData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  async getInterviewResults(token: string): Promise<InterviewResult[]> {
    const response: AxiosResponse<InterviewResult[]> = await this.api.get('/interviews', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  async getInterviewResult(token: string, id: number): Promise<InterviewResult> {
    const response: AxiosResponse<InterviewResult> = await this.api.get(`/interviews/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  async updateInterviewResult(
    token: string,
    id: number,
    interviewData: Partial<InterviewResult>
  ): Promise<InterviewResult> {
    const response: AxiosResponse<InterviewResult> = await this.api.put(`/interviews/${id}`, interviewData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  async deleteInterviewResult(token: string, id: number): Promise<void> {
    await this.api.delete(`/interviews/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // Wellness Interview endpoints (email-based, no auth required)
  async createWellnessInterview(
    email: string,
    interviewData: Omit<WellnessInterview, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<WellnessInterview> {
    const requestData = {
      email,
      transcription: interviewData.transcription,
      summary: interviewData.summary
    };
    
    // Debug logging
    console.log('Creating wellness interview with data:', {
      email: requestData.email,
      transcriptionLength: requestData.transcription?.length || 0,
      summaryLength: requestData.summary?.length || 0
    });
    
    const response: AxiosResponse<WellnessInterview> = await this.api.post('/interviews', requestData);
    return response.data;
  }

  async getWellnessInterviews(email: string): Promise<WellnessInterview[]> {
    const response: AxiosResponse<{ results: WellnessInterview[] }> = await this.api.get('/interviews', {
      params: { email }
    });
    return response.data.results;
  }

  async updateWellnessInterview(
    email: string,
    id: string,
    interviewData: Partial<WellnessInterview>
  ): Promise<WellnessInterview> {
    const response: AxiosResponse<WellnessInterview> = await this.api.put(`/interviews/${id}`, interviewData, {
      params: { email }
    });
    return response.data;
  }

  async getWellnessInterview(email: string, id: string): Promise<WellnessInterview> {
    const response: AxiosResponse<WellnessInterview> = await this.api.get(`/interviews/${id}`, {
      params: { email }
    });
    return response.data;
  }

  async deleteWellnessInterview(email: string, id: string): Promise<void> {
    await this.api.delete(`/interviews/${id}`, {
      params: { email }
    });
  }
}

export const apiService = new ApiService();
