import mongoose, { Document, Schema } from 'mongoose';

export enum SubmissionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  GRADED = 'GRADED',
  RETURNED = 'RETURNED',
  AUTO_SUBMITTED = 'AUTO_SUBMITTED',
}

export interface IAnswer {
  _id?: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  selectedChoiceId?: mongoose.Types.ObjectId;
  booleanAnswer?: boolean;
  textAnswer?: string;
  matchingAnswers?: { leftId: string; rightId: string }[];
  pointsEarned: number;
  isCorrect?: boolean;
  feedback?: string;
  gradedAt?: Date;
  gradedById?: mongoose.Types.ObjectId;
}

export interface IExamSubmission extends Document {
  _id: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  status: SubmissionStatus;
  answers: IAnswer[];
  startedAt: Date;
  submittedAt?: Date;
  timeAllottedMinutes?: number;
  timeExpiry?: Date;
  timeExtensionMinutes?: number;
  timeRemainingSeconds?: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
  isPassing: boolean;
  overallFeedback?: string;
  attemptNumber: number;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
  isTimeExpired(): boolean;
  getRemainingTimeSeconds(): number;
}

const answerSchema = new Schema<IAnswer>(
  {
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    selectedChoiceId: Schema.Types.ObjectId,
    booleanAnswer: Boolean,
    textAnswer: String,
    matchingAnswers: [{ leftId: String, rightId: String }],
    pointsEarned: { type: Number, default: 0 },
    isCorrect: Boolean,
    feedback: String,
    gradedAt: Date,
    gradedById: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const examSubmissionSchema = new Schema<IExamSubmission>(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: Object.values(SubmissionStatus), default: SubmissionStatus.IN_PROGRESS },
    answers: [answerSchema],
    startedAt: { type: Date, default: Date.now },
    submittedAt: Date,
    timeAllottedMinutes: Number,
    timeExpiry: Date,
    timeExtensionMinutes: { type: Number, default: 0 },
    timeRemainingSeconds: Number,
    totalScore: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    isPassing: { type: Boolean, default: false },
    overallFeedback: String,
    attemptNumber: { type: Number, default: 1 },
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
);

examSubmissionSchema.methods.isTimeExpired = function(): boolean {
  if (!this.timeExpiry) return false;
  return new Date() > this.timeExpiry;
};

examSubmissionSchema.methods.getRemainingTimeSeconds = function(): number {
  if (!this.timeExpiry) return -1;
  const now = new Date().getTime();
  const expiry = this.timeExpiry.getTime();
  const remaining = Math.floor((expiry - now) / 1000);
  return Math.max(0, remaining);
};

examSubmissionSchema.index({ examId: 1, studentId: 1, attemptNumber: 1 }, { unique: true });
examSubmissionSchema.index({ studentId: 1 });
examSubmissionSchema.index({ status: 1 });
examSubmissionSchema.index({ submittedAt: 1 });
examSubmissionSchema.index({ timeExpiry: 1 });

export const ExamSubmission = mongoose.model<IExamSubmission>('ExamSubmission', examSubmissionSchema);