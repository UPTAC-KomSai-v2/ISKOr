import { Router, Request, Response } from 'express';
import { PrismaClient, Role, ExamStatus } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  createExamValidator,
  updateExamValidator,
  paginationValidator,
  idParamValidator,
} from '../middleware/validation.js';
import { logEntityChange } from '../middleware/audit.js';
import notificationService from '../services/notification.js';
import logger from '../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/exams
 * @desc    Get all exams (filtered by role)
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  paginationValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      // Build filter based on role
      let whereClause: any = {};

      if (req.user!.role === Role.STUDENT) {
        // Students only see exams for their enrolled courses
        const student = await prisma.student.findFirst({
          where: { userId: req.user!.id },
          include: {
            enrollments: {
              where: { status: 'ENROLLED' },
              select: { courseId: true },
            },
          },
        });

        if (student) {
          const courseIds = student.enrollments.map((e) => e.courseId);
          whereClause = {
            courseId: { in: courseIds },
            status: { not: ExamStatus.DRAFT }, // Students don't see drafts
          };
        }
      } else if (req.user!.role === Role.FACULTY) {
        // Faculty see their own exams
        whereClause = { createdById: req.user!.id };
      }
      // Admin sees all exams

      const [exams, total] = await Promise.all([
        prisma.exam.findMany({
          where: whereClause,
          include: {
            course: { select: { code: true, name: true } },
            createdBy: { select: { firstName: true, lastName: true } },
            schedules: true,
            _count: { select: { results: true } },
          },
          orderBy: { [sortBy as string]: sortOrder },
          skip,
          take: Number(limit),
        }),
        prisma.exam.count({ where: whereClause }),
      ]);

      res.json({
        success: true,
        data: exams,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error('Get exams error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch exams' },
      });
    }
  }
);

/**
 * @route   GET /api/v1/exams/:id
 * @desc    Get exam by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  idParamValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const exam = await prisma.exam.findUnique({
        where: { id: req.params.id },
        include: {
          course: {
            select: { code: true, name: true, semester: true },
          },
          createdBy: {
            select: { firstName: true, lastName: true, email: true },
          },
          schedules: {
            orderBy: { startTime: 'asc' },
          },
          files: {
            select: { id: true, originalName: true, mimeType: true, size: true, uploadedAt: true },
          },
          announcements: {
            orderBy: { publishedAt: 'desc' },
            take: 5,
          },
        },
      });

      if (!exam) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Exam not found' },
        });
        return;
      }

      // Check access for students
      if (req.user!.role === Role.STUDENT && exam.status === ExamStatus.DRAFT) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Cannot view draft exams' },
        });
        return;
      }

      res.json({
        success: true,
        data: exam,
      });
    } catch (error) {
      logger.error('Get exam error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch exam' },
      });
    }
  }
);

/**
 * @route   POST /api/v1/exams
 * @desc    Create new exam
 * @access  Private (Faculty, Admin)
 */
router.post(
  '/',
  authenticate,
  authorize(Role.FACULTY, Role.ADMIN),
  createExamValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, description, courseId, type, totalPoints, passingScore, guidelines } = req.body;

      // Verify course exists
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_COURSE', message: 'Course not found' },
        });
        return;
      }

      const exam = await prisma.exam.create({
        data: {
          title,
          description,
          courseId,
          createdById: req.user!.id,
          type,
          totalPoints,
          passingScore,
          guidelines,
          status: ExamStatus.DRAFT,
        },
        include: {
          course: { select: { code: true, name: true } },
        },
      });

      // Log the creation
      await logEntityChange(req, 'CREATE', 'Exam', exam.id, { title, courseId });

      logger.info(`Exam created: ${exam.title} by ${req.user!.email}`);

      res.status(201).json({
        success: true,
        data: exam,
      });
    } catch (error) {
      logger.error('Create exam error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create exam' },
      });
    }
  }
);

/**
 * @route   PUT /api/v1/exams/:id
 * @desc    Update exam
 * @access  Private (Faculty owner, Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize(Role.FACULTY, Role.ADMIN),
  updateExamValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const examId = req.params.id;

      // Check if exam exists and user has permission
      const existingExam = await prisma.exam.findUnique({ where: { id: examId } });

      if (!existingExam) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Exam not found' },
        });
        return;
      }

      // Only owner or admin can update
      if (req.user!.role !== Role.ADMIN && existingExam.createdById !== req.user!.id) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only update your own exams' },
        });
        return;
      }

      const { title, description, type, totalPoints, passingScore, guidelines, status } = req.body;

      const exam = await prisma.exam.update({
        where: { id: examId },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(type && { type }),
          ...(totalPoints && { totalPoints }),
          ...(passingScore && { passingScore }),
          ...(guidelines !== undefined && { guidelines }),
          ...(status && { status }),
        },
        include: {
          course: { select: { code: true, name: true } },
          schedules: true,
        },
      });

      // Log the update
      await logEntityChange(req, 'UPDATE', 'Exam', exam.id, req.body);

      // If status changed to SCHEDULED, notify students
      if (status === ExamStatus.SCHEDULED && existingExam.status === ExamStatus.DRAFT) {
        await notificationService.notifyCourseStudents(exam.courseId, {
          type: 'exam_scheduled',
          title: `New Exam Scheduled: ${exam.title}`,
          message: `A new exam has been scheduled for ${exam.course.code}. Check the schedule for details.`,
          examId: exam.id,
        });
      }

      res.json({
        success: true,
        data: exam,
      });
    } catch (error) {
      logger.error('Update exam error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update exam' },
      });
    }
  }
);

/**
 * @route   DELETE /api/v1/exams/:id
 * @desc    Delete exam
 * @access  Private (Faculty owner, Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize(Role.FACULTY, Role.ADMIN),
  idParamValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const examId = req.params.id;

      const exam = await prisma.exam.findUnique({ where: { id: examId } });

      if (!exam) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Exam not found' },
        });
        return;
      }

      // Only owner or admin can delete
      if (req.user!.role !== Role.ADMIN && exam.createdById !== req.user!.id) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only delete your own exams' },
        });
        return;
      }

      // Cannot delete if exam has results
      const resultsCount = await prisma.examResult.count({ where: { examId } });
      if (resultsCount > 0) {
        res.status(400).json({
          success: false,
          error: { code: 'HAS_RESULTS', message: 'Cannot delete exam with existing results' },
        });
        return;
      }

      await prisma.exam.delete({ where: { id: examId } });

      // Log deletion
      await logEntityChange(req, 'DELETE', 'Exam', examId, { title: exam.title });

      logger.info(`Exam deleted: ${exam.title} by ${req.user!.email}`);

      res.json({
        success: true,
        data: { message: 'Exam deleted successfully' },
      });
    } catch (error) {
      logger.error('Delete exam error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete exam' },
      });
    }
  }
);

export default router;
