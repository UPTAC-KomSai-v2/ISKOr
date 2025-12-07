import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export enum Role {
  ADMIN = 'ADMIN',
  FACULTY = 'FACULTY',
  STUDENT = 'STUDENT',
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  // Profile fields
  profilePhoto?: string;
  bio?: string;
  phoneNumber?: string;
  // Student-specific fields
  studentNumber?: string;
  program?: string;
  yearLevel?: number;
  section?: string;
  // Faculty-specific fields
  facultyId?: string;
  department?: string;
  designation?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true, // keeps the unique index
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(Role),
      default: Role.STUDENT,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Profile fields
    profilePhoto: String,
    bio: { type: String, maxlength: 500 },
    phoneNumber: String,
    // Student fields
    studentNumber: { type: String, sparse: true }, // keeps sparse index
    program: String,
    yearLevel: Number,
    section: String,
    // Faculty fields
    facultyId: { type: String, sparse: true }, // keeps sparse index
    department: String,
    designation: String,
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

// Remove duplicate index declarations
// userSchema.index({ email: 1 }); // removed
// userSchema.index({ studentNumber: 1 }); // removed
// userSchema.index({ facultyId: 1 }); // removed
userSchema.index({ role: 1 }); // role index can stay

export const User = mongoose.model<IUser>('User', userSchema);
