import { Request, Response, NextFunction } from 'express';
import { validationResult, body, param, query } from 'express-validator';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array().map((err) => ({
          field: 'path' in err ? err.path : 'unknown',
          message: err.msg,
        })),
      },
    });
    return;
  }
  
  next();
};

// ============================================
// Auth Validators
// ============================================

export const loginValidator = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  handleValidationErrors,
];

export const refreshTokenValidator = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required'),
  handleValidationErrors,
];

// ============================================
// Exam Validators
// ============================================

export const createExamValidator = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be 3-200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  body('courseId')
    .isUUID()
    .withMessage('Valid course ID is required'),
  body('type')
    .isIn(['WRITTEN', 'ORAL', 'PRACTICAL', 'ONLINE', 'TAKE_HOME'])
    .withMessage('Invalid exam type'),
  body('totalPoints')
    .isInt({ min: 1 })
    .withMessage('Total points must be a positive integer'),
  body('passingScore')
    .isInt({ min: 0 })
    .withMessage('Passing score must be a non-negative integer'),
  body('guidelines')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Guidelines must be less than 5000 characters'),
  handleValidationErrors,
];

export const updateExamValidator = [
  param('id')
    .isUUID()
    .withMessage('Valid exam ID is required'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be 3-200 characters'),
  body('status')
    .optional()
    .isIn(['DRAFT', 'SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED'])
    .withMessage('Invalid exam status'),
  handleValidationErrors,
];

// ============================================
// Schedule Validators
// ============================================

export const createScheduleValidator = [
  body('examId')
    .isUUID()
    .withMessage('Valid exam ID is required'),
  body('section')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Section must be less than 50 characters'),
  body('room')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Room must be less than 100 characters'),
  body('meetLink')
    .optional()
    .isURL()
    .withMessage('Meet link must be a valid URL'),
  body('startTime')
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  body('endTime')
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startTime)) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),
  handleValidationErrors,
];

// ============================================
// Announcement Validators
// ============================================

export const createAnnouncementValidator = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be 3-200 characters'),
  body('content')
    .trim()
    .isLength({ min: 10, max: 10000 })
    .withMessage('Content must be 10-10000 characters'),
  body('type')
    .isIn(['GENERAL', 'EXAM_UPDATE', 'SCHEDULE_CHANGE', 'RESULT_RELEASE', 'PROCTOR_NOTICE', 'EMERGENCY'])
    .withMessage('Invalid announcement type'),
  body('priority')
    .optional()
    .isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
    .withMessage('Invalid priority level'),
  body('examId')
    .optional()
    .isUUID()
    .withMessage('Invalid exam ID'),
  body('targetRoles')
    .notEmpty()
    .withMessage('Target roles are required'),
  handleValidationErrors,
];

// ============================================
// Result Validators
// ============================================

export const createResultValidator = [
  body('examId')
    .isUUID()
    .withMessage('Valid exam ID is required'),
  body('studentId')
    .isUUID()
    .withMessage('Valid student ID is required'),
  body('score')
    .isFloat({ min: 0 })
    .withMessage('Score must be a non-negative number'),
  body('remarks')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Remarks must be less than 1000 characters'),
  handleValidationErrors,
];

export const regradeRequestValidator = [
  param('id')
    .isUUID()
    .withMessage('Valid result ID is required'),
  body('reason')
    .trim()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Reason must be 20-2000 characters'),
  handleValidationErrors,
];

// ============================================
// Pagination Validators
// ============================================

export const paginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isString()
    .withMessage('Sort field must be a string'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  handleValidationErrors,
];

// ============================================
// ID Param Validator
// ============================================

export const idParamValidator = [
  param('id')
    .isUUID()
    .withMessage('Valid ID is required'),
  handleValidationErrors,
];
