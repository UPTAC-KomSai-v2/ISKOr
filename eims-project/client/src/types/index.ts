export enum Role {
  ADMIN = 'ADMIN',
  FACULTY = 'FACULTY',
  STUDENT = 'STUDENT',
}

export enum ExamStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  GRADING = 'GRADING',
  COMPLETED = 'COMPLETED',
}

export enum ExamType {
  QUIZ = 'QUIZ',
  MIDTERM = 'MIDTERM',
  FINAL = 'FINAL',
  PRACTICAL = 'PRACTICAL',
  ASSIGNMENT = 'ASSIGNMENT',
}

export interface User {
  id: string;
  _id?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  profilePhoto?: string;
  bio?: string;
  phoneNumber?: string;
  studentNumber?: string;
  facultyId?: string;
  department?: string;
  designation?: string;
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

export interface Exam {
  _id: string;
  title: string;
  description?: string;
  instructions?: string;
  courseId: Course;
  createdById: User;
  type: ExamType;
  status: ExamStatus;
  totalPoints: number;
  questionCount: number;
  startDate?: string;
  endDate?: string;
  settings: {
    shuffleQuestions: boolean;
    shuffleChoices: boolean;
    showResults: boolean;
    showCorrectAnswers: boolean;
    showFeedback: boolean;
    allowReview: boolean;
    maxAttempts: number;
    timeLimitMinutes?: number;
    passingPercentage: number;
  };
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
