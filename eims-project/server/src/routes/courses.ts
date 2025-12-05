import { Router, Request, Response } from 'express';
import { Course, Enrollment, User, Role, EnrollmentStatus } from '../models';
import { authenticate, authorize } from '../middleware/auth';
import { createCourseValidator, mongoIdValidator, paginationValidator } from '../middleware/validation';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/courses
 * List all courses (with filters)
 */
router.get('/', authenticate, paginationValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    let filter: any = { isActive: true };

    // Faculty sees only their courses
    if (req.user!.role === Role.FACULTY) {
      filter.facultyId = req.user!.id;
    }

    // Students see only enrolled courses
    if (req.user!.role === Role.STUDENT) {
      const enrollments = await Enrollment.find({ 
        studentId: req.user!.id, 
        status: EnrollmentStatus.ENROLLED 
      }).select('courseId');
      filter._id = { $in: enrollments.map(e => e.courseId) };
    }

    // Optional filters
    if (req.query.semester) filter.semester = req.query.semester;
    if (req.query.academicYear) filter.academicYear = req.query.academicYear;
    if (req.query.search) {
      filter.$or = [
        { code: { $regex: req.query.search, $options: 'i' } },
        { name: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [courses, total] = await Promise.all([
      Course.find(filter)
        .populate('facultyId', 'firstName lastName email')
        .sort({ code: 1 })
        .skip(skip)
        .limit(limit),
      Course.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        courses,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('List courses error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch courses' },
    });
  }
});

/**
 * GET /api/v1/courses/:id
 * Get course details
 */
router.get('/:id', authenticate, mongoIdValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('facultyId', 'firstName lastName email department');

    if (!course) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Course not found' },
      });
      return;
    }

    // Get enrolled students count
    const enrolledCount = await Enrollment.countDocuments({ 
      courseId: course._id, 
      status: EnrollmentStatus.ENROLLED 
    });

    res.json({
      success: true,
      data: {
        course: {
          ...course.toObject(),
          enrolledCount,
        },
      },
    });
  } catch (error) {
    logger.error('Get course error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch course' },
    });
  }
});

/**
 * POST /api/v1/courses
 * Create a new course (Faculty/Admin)
 */
router.post(
  '/',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  createCourseValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, name, description, semester, academicYear } = req.body;

      // Check for duplicate
      const existing = await Course.findOne({ code, semester, academicYear });
      if (existing) {
        res.status(400).json({
          success: false,
          error: { code: 'DUPLICATE', message: 'Course already exists for this semester' },
        });
        return;
      }

      const course = await Course.create({
        code,
        name,
        description,
        semester,
        academicYear,
        facultyId: req.user!.id,
      });

      await course.populate('facultyId', 'firstName lastName email');

      logger.info(`Course created: ${course.code} by ${req.user!.email}`);

      res.status(201).json({
        success: true,
        data: { course },
      });
    } catch (error) {
      logger.error('Create course error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create course' },
      });
    }
  }
);

/**
 * PUT /api/v1/courses/:id
 * Update a course
 */
router.put(
  '/:id',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  mongoIdValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description, isActive } = req.body;

      const course = await Course.findById(req.params.id);
      if (!course) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Course not found' },
        });
        return;
      }

      // Check ownership (Faculty can only update their own courses)
      if (req.user!.role === Role.FACULTY && course.facultyId.toString() !== req.user!.id) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Not authorized to update this course' },
        });
        return;
      }

      if (name) course.name = name;
      if (description !== undefined) course.description = description;
      if (isActive !== undefined) course.isActive = isActive;

      await course.save();
      await course.populate('facultyId', 'firstName lastName email');

      res.json({
        success: true,
        data: { course },
      });
    } catch (error) {
      logger.error('Update course error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update course' },
      });
    }
  }
);

/**
 * DELETE /api/v1/courses/:id
 * Delete a course (soft delete)
 */
router.delete(
  '/:id',
  authenticate,
  authorize(Role.ADMIN),
  mongoIdValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const course = await Course.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );

      if (!course) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Course not found' },
        });
        return;
      }

      res.json({
        success: true,
        data: { message: 'Course deleted successfully' },
      });
    } catch (error) {
      logger.error('Delete course error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete course' },
      });
    }
  }
);

/**
 * GET /api/v1/courses/:id/students
 * Get students enrolled in a course
 */
router.get(
  '/:id/students',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  mongoIdValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const enrollments = await Enrollment.find({
        courseId: req.params.id,
        status: EnrollmentStatus.ENROLLED,
      }).populate('studentId', 'firstName lastName email studentNumber program yearLevel section');

      const students = enrollments.map(e => e.studentId);

      res.json({
        success: true,
        data: { students },
      });
    } catch (error) {
      logger.error('Get course students error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch students' },
      });
    }
  }
);

/**
 * POST /api/v1/courses/:id/enroll
 * Enroll students in a course
 */
router.post(
  '/:id/enroll',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { studentIds } = req.body;

      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'studentIds array is required' },
        });
        return;
      }

      const course = await Course.findById(req.params.id);
      if (!course) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Course not found' },
        });
        return;
      }

      // Create enrollments (upsert to avoid duplicates)
      const operations = studentIds.map((studentId: string) => ({
        updateOne: {
          filter: { studentId, courseId: course._id },
          update: { $setOnInsert: { studentId, courseId: course._id, status: EnrollmentStatus.ENROLLED } },
          upsert: true,
        },
      }));

      await Enrollment.bulkWrite(operations);

      res.json({
        success: true,
        data: { message: `Enrolled ${studentIds.length} students` },
      });
    } catch (error) {
      logger.error('Enroll students error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to enroll students' },
      });
    }
  }
);

/**
 * DELETE /api/v1/courses/:id/enroll/:studentId
 * Remove student from course
 */
router.delete(
  '/:id/enroll/:studentId',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await Enrollment.findOneAndUpdate(
        { courseId: req.params.id, studentId: req.params.studentId },
        { status: EnrollmentStatus.DROPPED },
        { new: true }
      );

      if (!result) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Enrollment not found' },
        });
        return;
      }

      res.json({
        success: true,
        data: { message: 'Student removed from course' },
      });
    } catch (error) {
      logger.error('Remove student error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to remove student' },
      });
    }
  }
);

export default router;
