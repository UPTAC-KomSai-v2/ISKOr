// ============================================
// User & Auth Types
// ============================================

export type Role = 'ADMIN' | 'FACULTY' | 'STUDENT';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  profile?: StudentProfile | FacultyProfile;
}

export interface StudentProfile {
  studentNumber: string;
  program: string;
  yearLevel: number;
  section?: string;
}

export interface FacultyProfile {
  facultyId: string;
  department: string;
  designation?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// ============================================
// Exam Types
// ============================================

export type ExamType = 'WRITTEN' | 'ORAL' | 'PRACTICAL' | 'ONLINE' | 'TAKE_HOME';
export type ExamStatus = 'DRAFT' | 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

export interface Exam {
  id: string;
  title: string;
  description?: string;
  courseId: string;
  createdById: string;
  type: ExamType;
  status: ExamStatus;
  totalPoints: number;
  passingScore: number;
  guidelines?: string;
  createdAt: string;
  updatedAt: string;
  course?: {
    code: string;
    name: string;
  };
  createdBy?: {
    firstName: string;
    lastName: string;
  };
  schedules?: ExamSchedule[];
  _count?: {
    results: number;
  };
}

export interface ExamSchedule {
  id: string;
  examId: string;
  section?: string;
  room?: string;
  meetLink?: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Announcement Types
// ============================================

export type AnnouncementType = 
  | 'GENERAL' 
  | 'EXAM_UPDATE' 
  | 'SCHEDULE_CHANGE' 
  | 'RESULT_RELEASE' 
  | 'PROCTOR_NOTICE' 
  | 'EMERGENCY';

export type AnnouncementPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  examId?: string;
  createdById: string;
  targetRoles: string;
  publishedAt: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    firstName: string;
    lastName: string;
  };
  exam?: {
    id: string;
    title: string;
  };
}

// ============================================
// Result Types
// ============================================

export type ResultStatus = 'PENDING' | 'PUBLISHED' | 'UNDER_REVIEW';
export type RegradeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESOLVED';

export interface ExamResult {
  id: string;
  examId: string;
  studentId: string;
  score: number;
  remarks?: string;
  status: ResultStatus;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  exam?: {
    id: string;
    title: string;
    totalPoints: number;
    passingScore: number;
  };
  student?: {
    studentNumber: string;
    user: {
      firstName: string;
      lastName: string;
    };
  };
  regradeRequests?: RegradeRequest[];
}

export interface RegradeRequest {
  id: string;
  resultId: string;
  studentId: string;
  requesterId: string;
  reason: string;
  status: RegradeStatus;
  response?: string;
  responderId?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
  requester?: {
    firstName: string;
    lastName: string;
  };
  responder?: {
    firstName: string;
    lastName: string;
  };
}

// ============================================
// Notification Types
// ============================================

export interface Notification {
  id: string;
  userId: string;
  announcementId?: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  isAcknowledged: boolean;
  createdAt: string;
  readAt?: string;
  announcement?: {
    id: string;
    title: string;
    examId?: string;
  };
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  pagination?: Pagination;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================
// WebSocket Types
// ============================================

export interface WSMessage {
  event: string;
  data: unknown;
  messageId: string;
  timestamp: number;
  requireAck?: boolean;
  retryCount?: number;
}

export type WSConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
