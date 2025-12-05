import mongoose, { Document, Schema } from 'mongoose';

export enum ExamType {
  QUIZ = 'QUIZ',
  MIDTERM = 'MIDTERM',
  FINAL = 'FINAL',
  PRACTICAL = 'PRACTICAL',
  ORAL = 'ORAL',
}

export enum ExamStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  ONGOING = 'ONGOING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface IExamSchedule {
  _id?: mongoose.Types.ObjectId;
  section: string;
  room?: string;
  meetingLink?: string;
  startTime: Date;
  endTime: Date;
  instructions?: string;
}

export interface IExamFile {
  _id?: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedAt: Date;
}

export interface IExam extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  courseId: mongoose.Types.ObjectId;
  createdById: mongoose.Types.ObjectId;
  type: ExamType;
  status: ExamStatus;
  totalPoints: number;
  passingScore?: number;
  schedules: IExamSchedule[];
  files: IExamFile[];
  guidelines?: string;
  createdAt: Date;
  updatedAt: Date;
}

const examScheduleSchema = new Schema<IExamSchedule>(
  {
    section: { type: String, required: true },
    room: String,
    meetingLink: String,
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    instructions: String,
  },
  { _id: true }
);

const examFileSchema = new Schema<IExamFile>(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    path: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const examSchema = new Schema<IExam>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
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
      required: true,
      min: 0,
    },
    passingScore: {
      type: Number,
      min: 0,
    },
    schedules: [examScheduleSchema],
    files: [examFileSchema],
    guidelines: String,
  },
  {
    timestamps: true,
  }
);

examSchema.index({ courseId: 1 });
examSchema.index({ createdById: 1 });
examSchema.index({ status: 1 });
examSchema.index({ 'schedules.startTime': 1 });

export const Exam = mongoose.model<IExam>('Exam', examSchema);
