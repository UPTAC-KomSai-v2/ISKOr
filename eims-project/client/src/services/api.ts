import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const API_URL = '/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Question types used in the backend
export type QuestionType =
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'ESSAY'
  | 'MATCHING'
  | 'FILL_IN_BLANK';

export interface Choice {
  _id?: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  _id: string;
  examId: string;
  type: QuestionType;
  questionText: string;
  points: number;
  order: number;
  choices?: Choice[];
  correctAnswer?: boolean;
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  matchingPairs?: { _id?: string; left: string; right: string }[];
  rubric?: string;
  maxWords?: number;
  imageUrl?: string;
  explanation?: string;
}

export const questionsApi = {
  getByExam: (examId: string) =>
    api.get<Question[]>(`/questions/exam/${examId}`).then(res => res.data),

  create: (payload: Partial<Question> & { examId: string }) =>
    api.post<Question>('/questions', payload).then(res => res.data),

  update: (id: string, payload: Partial<Question>) =>
    api.put<Question>(`/questions/${id}`, payload).then(res => res.data),

  remove: (id: string) =>
    api.delete<{ message: string }>(`/questions/${id}`).then(res => res.data),
};


// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
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
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          const { accessToken } = response.data.data;
          useAuthStore.getState().setAccessToken(accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      } else {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/password', { currentPassword, newPassword }),
};

// Dashboard API
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getRecentActivity: (limit = 10) => api.get(`/dashboard/recent-activity?limit=${limit}`),
};

// Courses API
export const coursesApi = {
  list: (params?: Record<string, any>) => api.get('/courses', { params }),
  get: (id: string) => api.get(`/courses/${id}`),
  create: (data: any) => api.post('/courses', data),
  update: (id: string, data: any) => api.put(`/courses/${id}`, data),
  delete: (id: string) => api.delete(`/courses/${id}`),
  getStudents: (id: string) => api.get(`/courses/${id}/students`),
  enrollStudents: (id: string, studentIds: string[]) =>
    api.post(`/courses/${id}/enroll`, { studentIds }),
};

// Exams API
export const examsApi = {
  list: (params?: Record<string, any>) => api.get('/exams', { params }),
  getUpcoming: (limit = 5) => api.get(`/exams/upcoming?limit=${limit}`),
  get: (id: string) => api.get(`/exams/${id}`),
  create: (data: any) => api.post('/exams', data),
  update: (id: string, data: any) => api.put(`/exams/${id}`, data),
  delete: (id: string) => api.delete(`/exams/${id}`),
  addSchedule: (id: string, data: any) => api.post(`/exams/${id}/schedules`, data),
  updateSchedule: (examId: string, scheduleId: string, data: any) =>
    api.put(`/exams/${examId}/schedules/${scheduleId}`, data),
  deleteSchedule: (examId: string, scheduleId: string) =>
    api.delete(`/exams/${examId}/schedules/${scheduleId}`),
};

// Results API
export const resultsApi = {
  list: (params?: Record<string, any>) => api.get('/results', { params }),
  getByExam: (examId: string) => api.get(`/results/exam/${examId}`),
  get: (id: string) => api.get(`/results/${id}`),
  create: (data: any) => api.post('/results', data),
  createBulk: (examId: string, results: any[]) =>
    api.post('/results/bulk', { examId, results }),
  update: (id: string, data: any) => api.put(`/results/${id}`, data),
  publish: (id: string) => api.put(`/results/${id}/publish`),
  publishBulk: (resultIds: string[]) => api.put('/results/publish-bulk', { resultIds }),
  requestRegrade: (id: string, reason: string) =>
    api.post(`/results/${id}/regrade`, { reason }),
  respondToRegrade: (resultId: string, regradeId: string, data: any) =>
    api.put(`/results/${resultId}/regrade/${regradeId}`, data),
  getPendingRegrades: () => api.get('/results/regrades/pending'),
};

// Announcements API
export const announcementsApi = {
  list: (params?: Record<string, any>) => api.get('/announcements', { params }),
  getRecent: (limit = 5) => api.get(`/announcements/recent?limit=${limit}`),
  get: (id: string) => api.get(`/announcements/${id}`),
  create: (data: any) => api.post('/announcements', data),
  update: (id: string, data: any) => api.put(`/announcements/${id}`, data),
  delete: (id: string) => api.delete(`/announcements/${id}`),
};

// Notifications API
export const notificationsApi = {
  list: (params?: Record<string, any>) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  delete: (id: string) => api.delete(`/notifications/${id}`),
  clearAll: () => api.delete('/notifications'),
};

// Users API
export const usersApi = {
  list: (params?: Record<string, any>) => api.get('/users', { params }),
  getStudents: (params?: Record<string, any>) => api.get('/users/students', { params }),
  getFaculty: () => api.get('/users/faculty'),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  createBulk: (users: any[]) => api.post('/users/bulk', { users }),
};

export default api;
