import mongoose, { Document, Schema } from 'mongoose';

export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
  SHORT_ANSWER = 'SHORT_ANSWER',
  ESSAY = 'ESSAY',
  MATCHING = 'MATCHING',
  FILL_IN_BLANK = 'FILL_IN_BLANK',
}

export interface IChoice {
  _id?: mongoose.Types.ObjectId;
  text: string;
  isCorrect: boolean;
}

export interface IMatchingPair {
  _id?: mongoose.Types.ObjectId;
  left: string;
  right: string;
}

export interface IQuestion extends Document {
  _id: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  type: QuestionType;
  questionText: string;
  points: number;
  order: number;
  // For multiple choice
  choices?: IChoice[];
  // For true/false
  correctAnswer?: boolean;
  // For short answer / fill in blank
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  // For matching
  matchingPairs?: IMatchingPair[];
  // For essay
  rubric?: string;
  maxWords?: number;
  // Media
  imageUrl?: string;
  // Feedback
  explanation?: string;
  createdAt: Date;
  updatedAt: Date;
}

const choiceSchema = new Schema<IChoice>(
  {
    text: { type: String, required: true },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: true }
);

const matchingPairSchema = new Schema<IMatchingPair>(
  {
    left: { type: String, required: true },
    right: { type: String, required: true },
  },
  { _id: true }
);

const questionSchema = new Schema<IQuestion>(
  {
    examId: {
      type: Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(QuestionType),
      required: true,
    },
    questionText: {
      type: String,
      required: true,
    },
    points: {
      type: Number,
      required: true,
      min: 0,
      default: 1,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
    // Multiple choice options
    choices: [choiceSchema],
    // True/false answer
    correctAnswer: Boolean,
    // Short answer accepted answers
    acceptedAnswers: [String],
    caseSensitive: { type: Boolean, default: false },
    // Matching pairs
    matchingPairs: [matchingPairSchema],
    // Essay fields
    rubric: String,
    maxWords: Number,
    // Media
    imageUrl: String,
    // Feedback explanation
    explanation: String,
  },
  {
    timestamps: true,
  }
);

questionSchema.index({ examId: 1, order: 1 });

export const Question = mongoose.model<IQuestion>('Question', questionSchema);
