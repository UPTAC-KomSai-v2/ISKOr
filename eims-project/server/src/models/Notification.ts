import mongoose, { Document, Schema } from 'mongoose';

export enum NotificationType {
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  EXAM_SCHEDULED = 'EXAM_SCHEDULED',
  EXAM_UPDATED = 'EXAM_UPDATED',
  EXAM_REMINDER = 'EXAM_REMINDER',
  RESULT_PUBLISHED = 'RESULT_PUBLISHED',
  REGRADE_RESPONSE = 'REGRADE_RESPONSE',
  SYSTEM = 'SYSTEM',
}

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
