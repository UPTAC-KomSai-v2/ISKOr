import mongoose, { Document, Schema } from 'mongoose';

export enum ResultStatus {
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
}

export enum RegradeStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface IRegradeRequest {
  _id?: mongoose.Types.ObjectId;
  reason: string;
  status: RegradeStatus;
  response?: string;
  respondedById?: mongoose.Types.ObjectId;
  respondedAt?: Date;
  requestedAt: Date;
}

export interface IExamResult extends Document {
  _id: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  score: number;
  remarks?: string;
  status: ResultStatus;
  publishedAt?: Date;
  regradeRequests: IRegradeRequest[];
  createdAt: Date;
  updatedAt: Date;
}

const regradeRequestSchema = new Schema<IRegradeRequest>(
  {
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(RegradeStatus),
      default: RegradeStatus.PENDING,
    },
    response: String,
    respondedById: { type: Schema.Types.ObjectId, ref: 'User' },
    respondedAt: Date,
    requestedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const examResultSchema = new Schema<IExamResult>(
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
    score: {
      type: Number,
      required: true,
      min: 0,
    },
    remarks: String,
    status: {
      type: String,
      enum: Object.values(ResultStatus),
      default: ResultStatus.PENDING,
    },
    publishedAt: Date,
    regradeRequests: [regradeRequestSchema],
  },
  {
    timestamps: true,
  }
);

examResultSchema.index({ examId: 1, studentId: 1 }, { unique: true });
examResultSchema.index({ studentId: 1 });
examResultSchema.index({ status: 1 });

export const ExamResult = mongoose.model<IExamResult>('ExamResult', examResultSchema);
