import mongoose, { Document, Schema } from 'mongoose';

export enum ExamType {
  QUIZ = 'QUIZ',
  MIDTERM = 'MIDTERM',
  FINAL = 'FINAL',
  PRACTICAL = 'PRACTICAL',
  ASSIGNMENT = 'ASSIGNMENT',
}

export enum ExamStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  GRADING = 'GRADING',
  COMPLETED = 'COMPLETED',
}

export interface IExamSettings {
  shuffleQuestions: boolean;
  shuffleChoices: boolean;
  showResults: boolean;
  showCorrectAnswers: boolean;
  showFeedback: boolean;
  allowReview: boolean;
  maxAttempts: number;
  timeLimitMinutes?: number;
  passingPercentage: number;
  lateSubmissionAllowed: boolean;
  lateSubmissionPenalty: number; // percentage deducted
}

export interface IExam extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  instructions?: string;
  courseId: mongoose.Types.ObjectId;
  createdById: mongoose.Types.ObjectId;
  type: ExamType;
  status: ExamStatus;
  totalPoints: number;
  questionCount: number;
  // Timing
  startDate?: Date;
  endDate?: Date;
  // Settings
  settings: IExamSettings;
  // Access
  allowedSections?: string[];
  // Files/attachments
  attachments?: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const examSettingsSchema = new Schema<IExamSettings>(
  {
    shuffleQuestions: { type: Boolean, default: false },
    shuffleChoices: { type: Boolean, default: false },
    showResults: { type: Boolean, default: true },
    showCorrectAnswers: { type: Boolean, default: false },
    showFeedback: { type: Boolean, default: true },
    allowReview: { type: Boolean, default: true },
    maxAttempts: { type: Number, default: 1 },
    timeLimitMinutes: Number,
    passingPercentage: { type: Number, default: 60 },
    lateSubmissionAllowed: { type: Boolean, default: false },
    lateSubmissionPenalty: { type: Number, default: 0 },
  },
  { _id: false }
);

const examSchema = new Schema<IExam>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    instructions: String,
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(ExamType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ExamStatus),
      default: ExamStatus.DRAFT,
    },
    totalPoints: {
      type: Number,
      default: 0,
    },
    questionCount: {
      type: Number,
      default: 0,
    },
    startDate: Date,
    endDate: Date,
    settings: {
      type: examSettingsSchema,
      default: () => ({}),
    },
    allowedSections: [String],
    attachments: [{
      filename: String,
      originalName: String,
      mimeType: String,
      size: Number,
      url: String,
    }],
  },
  {
    timestamps: true,
  }
);

examSchema.index({ courseId: 1 });
examSchema.index({ createdById: 1 });
examSchema.index({ status: 1 });
examSchema.index({ startDate: 1, endDate: 1 });

export const Exam = mongoose.model<IExam>('Exam', examSchema);
