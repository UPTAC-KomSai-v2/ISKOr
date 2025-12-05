import mongoose, { Document, Schema } from 'mongoose';

export enum AnnouncementType {
  GENERAL = 'GENERAL',
  EXAM = 'EXAM',
  SCHEDULE = 'SCHEDULE',
  RESULT = 'RESULT',
  URGENT = 'URGENT',
}

export enum AnnouncementPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export interface IAnnouncement extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  content: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  courseId?: mongoose.Types.ObjectId;
  examId?: mongoose.Types.ObjectId;
  createdById: mongoose.Types.ObjectId;
  targetRoles: string[];
  isPublished: boolean;
  publishedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(AnnouncementType),
      default: AnnouncementType.GENERAL,
    },
    priority: {
      type: String,
      enum: Object.values(AnnouncementPriority),
      default: AnnouncementPriority.NORMAL,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
    },
    examId: {
      type: Schema.Types.ObjectId,
      ref: 'Exam',
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetRoles: [{
      type: String,
      enum: ['ADMIN', 'FACULTY', 'STUDENT'],
    }],
    isPublished: {
      type: Boolean,
      default: true,
    },
    publishedAt: Date,
    expiresAt: Date,
  },
  {
    timestamps: true,
  }
);

announcementSchema.index({ courseId: 1 });
announcementSchema.index({ createdById: 1 });
announcementSchema.index({ isPublished: 1, publishedAt: -1 });
announcementSchema.index({ targetRoles: 1 });

export const Announcement = mongoose.model<IAnnouncement>('Announcement', announcementSchema);
