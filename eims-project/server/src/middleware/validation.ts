import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

/**
 * Handle validation errors
 */
export const handleValidation = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array(),
      },
    });
    return;
  }
  next();
};

// Auth validators
export const loginValidator = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidation,
];

export const refreshTokenValidator = [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  handleValidation,
];

// User validators
export const createUserValidator = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('role').isIn(['ADMIN', 'FACULTY', 'STUDENT']),
  handleValidation,
];

// Course validators
export const createCourseValidator = [
  body('code').trim().notEmpty().toUpperCase(),
  body('name').trim().notEmpty(),
  body('semester').isIn(['1ST', '2ND', 'SUMMER']),
  body('academicYear').matches(/^\d{4}-\d{4}$/),
  handleValidation,
];

// Exam validators
export const createExamValidator = [
  body('title').trim().notEmpty(),
  body('courseId').isMongoId(),
  body('type').isIn(['QUIZ', 'MIDTERM', 'FINAL', 'PRACTICAL', 'ORAL']),
  body('totalPoints').isInt({ min: 1 }),
  handleValidation,
];

export const updateExamValidator = [
  param('id').isMongoId(),
  body('title').optional().trim().notEmpty(),
  body('type').optional().isIn(['QUIZ', 'MIDTERM', 'FINAL', 'PRACTICAL', 'ORAL']),
  body('status').optional().isIn(['DRAFT', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED']),
  handleValidation,
];

// Schedule validators
export const createScheduleValidator = [
  body('section').trim().notEmpty(),
  body('startTime').isISO8601(),
  body('endTime').isISO8601(),
  handleValidation,
];

// Result validators
export const createResultValidator = [
  body('examId').isMongoId(),
  body('studentId').isMongoId(),
  body('score').isFloat({ min: 0 }),
  handleValidation,
];

export const bulkResultValidator = [
  body('examId').isMongoId(),
  body('results').isArray({ min: 1 }),
  body('results.*.studentId').isMongoId(),
  body('results.*.score').isFloat({ min: 0 }),
  handleValidation,
];

// Announcement validators
export const createAnnouncementValidator = [
  body('title').trim().notEmpty(),
  body('content').trim().notEmpty(),
  body('type').optional().isIn(['GENERAL', 'EXAM', 'SCHEDULE', 'RESULT', 'URGENT']),
  body('priority').optional().isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  handleValidation,
];

// Regrade validators
export const regradeRequestValidator = [
  body('reason').trim().notEmpty().isLength({ min: 10 }),
  handleValidation,
];

export const regradeResponseValidator = [
  body('status').isIn(['APPROVED', 'REJECTED']),
  body('response').trim().notEmpty(),
  body('newScore').optional().isFloat({ min: 0 }),
  handleValidation,
];

// Pagination validators
export const paginationValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  handleValidation,
];

// ID param validator
export const mongoIdValidator = [
  param('id').isMongoId().withMessage('Invalid ID format'),
  handleValidation,
];
