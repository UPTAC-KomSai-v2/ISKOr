import mongoose, { Document, Schema } from 'mongoose';

export interface ICourse extends Document {
  _id: mongoose.Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  semester: string;
  academicYear: string;
  facultyId: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<ICourse>(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    semester: {
      type: String,
      required: true,
      enum: ['1ST', '2ND', 'SUMMER'],
    },
    academicYear: {
      type: String,
      required: true,
    },
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

courseSchema.index({ code: 1, semester: 1, academicYear: 1 }, { unique: true });
courseSchema.index({ facultyId: 1 });

export const Course = mongoose.model<ICourse>('Course', courseSchema);
