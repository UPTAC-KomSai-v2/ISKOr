import mongoose, { Document, Schema } from 'mongoose';

export enum SubmissionStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  GRADED = 'GRADED',
  RETURNED = 'RETURNED',
}

export interface IAnswer {
  _id?: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  // For multiple choice - selected choice ID
  selectedChoiceId?: mongoose.Types.ObjectId;
  // For true/false
  booleanAnswer?: boolean;
  // For short answer / fill in blank / essay
  textAnswer?: string;
  // For matching - array of {leftId, rightId}
  matchingAnswers?: { leftId: string; rightId: string }[];
  // Grading
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
  // Timing
  startedAt: Date;
  submittedAt?: Date;
  // Scores
  totalScore: number;
  maxScore: number;
  percentage: number;
  isPassing: boolean;
  // Feedback
  overallFeedback?: string;
  // Attempt tracking
  attemptNumber: number;
  // IP and browser info for proctoring
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const answerSchema = new Schema<IAnswer>(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    selectedChoiceId: Schema.Types.ObjectId,
    booleanAnswer: Boolean,
    textAnswer: String,
    matchingAnswers: [{
      leftId: String,
      rightId: String,
    }],
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
    examId: {
      type: Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SubmissionStatus),
      default: SubmissionStatus.IN_PROGRESS,
    },
    answers: [answerSchema],
    startedAt: {
      type: Date,
      default: Date.now,
    },
    submittedAt: Date,
    totalScore: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    isPassing: { type: Boolean, default: false },
    overallFeedback: String,
    attemptNumber: { type: Number, default: 1 },
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
  }
);

// Compound index for unique submissions per student per exam per attempt
examSubmissionSchema.index({ examId: 1, studentId: 1, attemptNumber: 1 }, { unique: true });
examSubmissionSchema.index({ studentId: 1 });
examSubmissionSchema.index({ status: 1 });
examSubmissionSchema.index({ submittedAt: 1 });

export const ExamSubmission = mongoose.model<IExamSubmission>('ExamSubmission', examSubmissionSchema);
