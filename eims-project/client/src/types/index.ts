export enum Role {
  ADMIN = 'ADMIN',
  FACULTY = 'FACULTY',
  STUDENT = 'STUDENT',
}

export enum ExamStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ExamType {
  QUIZ = 'QUIZ',
  MIDTERM = 'MIDTERM',
  FINAL = 'FINAL',
  PRACTICAL = 'PRACTICAL',
  ORAL = 'ORAL',
}

export interface User {
  id: string;
  _id?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  studentNumber?: string;
  facultyId?: string;
  department?: string;
  program?: string;
  yearLevel?: number;
  section?: string;
}

export interface Course {
  _id: string;
  code: string;
  name: string;
  description?: string;
  semester: string;
  academicYear: string;
  facultyId: User;
  isActive: boolean;
}

export interface ExamSchedule {
  _id: string;
  section: string;
  room?: string;
  meetingLink?: string;
  startTime: string;
  endTime: string;
  instructions?: string;
}

export interface Exam {
  _id: string;
  title: string;
  description?: string;
  courseId: Course;
  createdById: User;
  type: ExamType;
  status: ExamStatus;
  totalPoints: number;
  passingScore?: number;
  schedules: ExamSchedule[];
  guidelines?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExamResult {
  _id: string;
  examId: Exam;
  studentId: User;
  score: number;
  remarks?: string;
  status: 'PENDING' | 'PUBLISHED';
  publishedAt?: string;
}

export interface Announcement {
  _id: string;
  title: string;
  content: string;
  type: string;
  priority: string;
  courseId?: Course;
  createdById: User;
  isPublished: boolean;
  publishedAt: string;
}

export interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
