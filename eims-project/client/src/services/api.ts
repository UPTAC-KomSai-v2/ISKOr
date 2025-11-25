import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';
import type { ApiResponse, AuthTokens, LoginCredentials, User } from '@/types';

// ============================================
// Axios Instance
// ============================================

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 and not already retried, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken } = response.data.data;
          useAuthStore.getState().setAccessToken(accessToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  }
);

// ============================================
// Auth API
// ============================================

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  logout: async (refreshToken?: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.post('/auth/logout', { refreshToken });
    return response.data;
  },

  refresh: async (refreshToken: string): Promise<ApiResponse<{ accessToken: string; expiresIn: number }>> => {
    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data;
  },

  me: async (): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// ============================================
// Exams API
// ============================================

export const examsApi = {
  list: async (params?: { page?: number; limit?: number; status?: string }) => {
    const response = await api.get('/exams', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/exams/${id}`);
    return response.data;
  },

  create: async (data: {
    title: string;
    description?: string;
    courseId: string;
    type: string;
    totalPoints: number;
    passingScore: number;
    guidelines?: string;
  }) => {
    const response = await api.post('/exams', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    title: string;
    description: string;
    type: string;
    totalPoints: number;
    passingScore: number;
    guidelines: string;
    status: string;
  }>) => {
    const response = await api.put(`/exams/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/exams/${id}`);
    return response.data;
  },
};

// ============================================
// Schedules API
// ============================================

export const schedulesApi = {
  list: async (params?: { examId?: string; upcoming?: boolean }) => {
    const response = await api.get('/schedules', { params });
    return response.data;
  },

  getByExam: async (examId: string) => {
    const response = await api.get(`/schedules/exam/${examId}`);
    return response.data;
  },

  create: async (data: {
    examId: string;
    section?: string;
    room?: string;
    meetLink?: string;
    startTime: string;
    endTime: string;
  }) => {
    const response = await api.post('/schedules', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    section: string;
    room: string;
    meetLink: string;
    startTime: string;
    endTime: string;
  }>) => {
    const response = await api.put(`/schedules/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/schedules/${id}`);
    return response.data;
  },
};

// ============================================
// Announcements API
// ============================================

export const announcementsApi = {
  list: async (params?: { page?: number; limit?: number; examId?: string; type?: string }) => {
    const response = await api.get('/announcements', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/announcements/${id}`);
    return response.data;
  },

  create: async (data: {
    title: string;
    content: string;
    type: string;
    priority?: string;
    examId?: string;
    targetRoles: string;
    expiresAt?: string;
  }) => {
    const response = await api.post('/announcements', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    title: string;
    content: string;
    type: string;
    priority: string;
    targetRoles: string;
    expiresAt: string;
  }>) => {
    const response = await api.put(`/announcements/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/announcements/${id}`);
    return response.data;
  },
};

// ============================================
// Results API
// ============================================

export const resultsApi = {
  list: async (params?: { page?: number; limit?: number; examId?: string; status?: string }) => {
    const response = await api.get('/results', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/results/${id}`);
    return response.data;
  },

  create: async (data: {
    examId: string;
    studentId: string;
    score: number;
    remarks?: string;
  }) => {
    const response = await api.post('/results', data);
    return response.data;
  },

  createBulk: async (data: {
    examId: string;
    results: Array<{ studentId: string; score: number; remarks?: string }>;
  }) => {
    const response = await api.post('/results/bulk', data);
    return response.data;
  },

  publish: async (id: string) => {
    const response = await api.put(`/results/${id}/publish`);
    return response.data;
  },

  requestRegrade: async (id: string, reason: string) => {
    const response = await api.post(`/results/${id}/regrade`, { reason });
    return response.data;
  },

  respondToRegrade: async (id: string, data: {
    status: 'APPROVED' | 'REJECTED' | 'RESOLVED';
    response: string;
    newScore?: number;
  }) => {
    const response = await api.put(`/results/regrade/${id}/respond`, data);
    return response.data;
  },
};

// ============================================
// Students API
// ============================================

export const studentsApi = {
  list: async (params?: { page?: number; limit?: number; search?: string; program?: string }) => {
    const response = await api.get('/students', { params });
    return response.data;
  },

  get: async (id: string) => {
    const response = await api.get(`/students/${id}`);
    return response.data;
  },

  getByCourse: async (courseId: string) => {
    const response = await api.get(`/students/by-course/${courseId}`);
    return response.data;
  },

  sync: async (students: Array<{
    email: string;
    firstName: string;
    lastName: string;
    studentNumber: string;
    program: string;
    yearLevel: number;
    section?: string;
  }>) => {
    const response = await api.post('/students/sync', { students });
    return response.data;
  },
};

// ============================================
// Notifications API
// ============================================

export const notificationsApi = {
  list: async (params?: { page?: number; limit?: number; unreadOnly?: boolean }) => {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (id: string) => {
    const response = await api.put(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.put('/notifications/read-all');
    return response.data;
  },
};

export default api;
