import { Router, Request, Response } from 'express';
import { PrismaClient, Role, ResultStatus, RegradeStatus } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import {
  createResultValidator,
  regradeRequestValidator,
  paginationValidator,
  idParamValidator,
} from '../middleware/validation';
import { logEntityChange } from '../middleware/audit';
import notificationService from '../services/notification';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/results
 * @desc    Get results (role-filtered)
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  paginationValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 10, examId, status } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      let whereClause: any = {};

      // Filter by exam if provided
      if (examId) {
        whereClause.examId = examId;
      }

      // Filter by status if provided
      if (status) {
        whereClause.status = status;
      }

      // Role-based filtering
      if (req.user!.role === Role.STUDENT) {
        // Students only see their own published results
        const student = await prisma.student.findFirst({
          where: { userId: req.user!.id },
        });

        if (!student) {
          res.json({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
          return;
        }

        whereClause.studentId = student.id;
        whereClause.status = ResultStatus.PUBLISHED;
      } else if (req.user!.role === Role.FACULTY) {
        // Faculty see results for their exams
        whereClause.exam = { createdById: req.user!.id };
      }
      // Admin sees all

      const [results, total] = await Promise.all([
        prisma.examResult.findMany({
          where: whereClause,
          include: {
            exam: {
              select: { id: true, title: true, totalPoints: true, passingScore: true },
            },
            student: {
              select: {
                studentNumber: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit),
        }),
        prisma.examResult.count({ where: whereClause }),
      ]);

      res.json({
        success: true,
        data: results,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error('Get results error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch results' },
      });
    }
  }
);

/**
 * @route   GET /api/v1/results/:id
 * @desc    Get result by ID
 * @access  Private
 */
router.get('/:id', authenticate, idParamValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await prisma.examResult.findUnique({
      where: { id: req.params.id },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            totalPoints: true,
            passingScore: true,
            course: { select: { code: true, name: true } },
            createdBy: { select: { firstName: true, lastName: true } },
          },
        },
        student: {
          select: {
            id: true,
            studentNumber: true,
            program: true,
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        regradeRequests: {
          orderBy: { createdAt: 'desc' },
          include: {
            requester: { select: { firstName: true, lastName: true } },
            responder: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!result) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Result not found' },
      });
      return;
    }

    // Check access
    if (req.user!.role === Role.STUDENT) {
      if (result.student.user.id !== req.user!.id || result.status !== ResultStatus.PUBLISHED) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have access to this result' },
        });
        return;
      }
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Get result error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch result' },
    });
  }
});

/**
 * @route   POST /api/v1/results
 * @desc    Create/publish exam result
 * @access  Private (Faculty, Admin)
 */
router.post(
  '/',
  authenticate,
  authorize(Role.FACULTY, Role.ADMIN),
  createResultValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { examId, studentId, score, remarks } = req.body;

      // Verify exam exists and user has permission
      const exam = await prisma.exam.findUnique({ where: { id: examId } });
      if (!exam) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_EXAM', message: 'Exam not found' },
        });
        return;
      }

      if (req.user!.role !== Role.ADMIN && exam.createdById !== req.user!.id) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only add results to your own exams' },
        });
        return;
      }

      // Check for existing result
      const existingResult = await prisma.examResult.findFirst({
        where: { examId, studentId },
      });

      if (existingResult) {
        res.status(400).json({
          success: false,
          error: { code: 'DUPLICATE', message: 'Result already exists for this student' },
        });
        return;
      }

      const result = await prisma.examResult.create({
        data: {
          examId,
          studentId,
          score,
          remarks,
          status: ResultStatus.PENDING,
        },
        include: {
          exam: { select: { title: true } },
          student: {
            select: {
              studentNumber: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      // Log creation
      await logEntityChange(req, 'CREATE', 'ExamResult', result.id, { examId, studentId, score });

      logger.info(`Result created for exam ${examId}, student ${studentId}`);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Create result error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create result' },
      });
    }
  }
);

/**
 * @route   POST /api/v1/results/bulk
 * @desc    Create multiple results at once
 * @access  Private (Faculty, Admin)
 */
router.post(
  '/bulk',
  authenticate,
  authorize(Role.FACULTY, Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { examId, results } = req.body;

      if (!examId || !Array.isArray(results) || results.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'examId and results array required' },
        });
        return;
      }

      // Verify exam
      const exam = await prisma.exam.findUnique({ where: { id: examId } });
      if (!exam) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_EXAM', message: 'Exam not found' },
        });
        return;
      }

      if (req.user!.role !== Role.ADMIN && exam.createdById !== req.user!.id) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only add results to your own exams' },
        });
        return;
      }

      // Create results
      const createdResults = await prisma.$transaction(
        results.map((r: { studentId: string; score: number; remarks?: string }) =>
          prisma.examResult.create({
            data: {
              examId,
              studentId: r.studentId,
              score: r.score,
              remarks: r.remarks,
              status: ResultStatus.PENDING,
            },
          })
        )
      );

      // Log bulk creation
      await logEntityChange(req, 'CREATE', 'ExamResult', examId, { count: createdResults.length });

      res.status(201).json({
        success: true,
        data: {
          created: createdResults.length,
          results: createdResults,
        },
      });
    } catch (error) {
      logger.error('Bulk create results error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create results' },
      });
    }
  }
);

/**
 * @route   PUT /api/v1/results/:id/publish
 * @desc    Publish result (make visible to student)
 * @access  Private (Faculty, Admin)
 */
router.put(
  '/:id/publish',
  authenticate,
  authorize(Role.FACULTY, Role.ADMIN),
  idParamValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const resultId = req.params.id;

      const result = await prisma.examResult.findUnique({
        where: { id: resultId },
        include: {
          exam: { select: { title: true, createdById: true } },
          student: { select: { id: true } },
        },
      });

      if (!result) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Result not found' },
        });
        return;
      }

      if (req.user!.role !== Role.ADMIN && result.exam.createdById !== req.user!.id) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only publish results for your own exams' },
        });
        return;
      }

      const updatedResult = await prisma.examResult.update({
        where: { id: resultId },
        data: {
          status: ResultStatus.PUBLISHED,
          publishedAt: new Date(),
        },
      });

      // Log and notify
      await logEntityChange(req, 'UPDATE', 'ExamResult', resultId, { status: 'PUBLISHED' });
      await notificationService.notifyResultPublished(
        result.exam.title,
        result.exam.title,
        result.student.id,
        resultId
      );

      res.json({
        success: true,
        data: updatedResult,
      });
    } catch (error) {
      logger.error('Publish result error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to publish result' },
      });
    }
  }
);

/**
 * @route   POST /api/v1/results/:id/regrade
 * @desc    Request regrade
 * @access  Private (Student)
 */
router.post(
  '/:id/regrade',
  authenticate,
  authorize(Role.STUDENT),
  regradeRequestValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const resultId = req.params.id;
      const { reason } = req.body;

      // Get student
      const student = await prisma.student.findFirst({
        where: { userId: req.user!.id },
      });

      if (!student) {
        res.status(403).json({
          success: false,
          error: { code: 'NOT_STUDENT', message: 'Student profile not found' },
        });
        return;
      }

      // Get result and verify ownership
      const result = await prisma.examResult.findUnique({
        where: { id: resultId },
        include: {
          exam: { select: { title: true, createdById: true } },
        },
      });

      if (!result) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Result not found' },
        });
        return;
      }

      if (result.studentId !== student.id) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only request regrade for your own results' },
        });
        return;
      }

      // Check for existing pending request
      const existingRequest = await prisma.regradeRequest.findFirst({
        where: {
          resultId,
          studentId: student.id,
          status: RegradeStatus.PENDING,
        },
      });

      if (existingRequest) {
        res.status(400).json({
          success: false,
          error: { code: 'DUPLICATE', message: 'You already have a pending regrade request' },
        });
        return;
      }

      // Create regrade request
      const regradeRequest = await prisma.regradeRequest.create({
        data: {
          resultId,
          studentId: student.id,
          requesterId: req.user!.id,
          reason,
        },
      });

      // Update result status
      await prisma.examResult.update({
        where: { id: resultId },
        data: { status: ResultStatus.UNDER_REVIEW },
      });

      // Log and notify faculty
      await logEntityChange(req, 'CREATE', 'RegradeRequest', regradeRequest.id, { resultId, reason });

      // Notify the exam creator
      await notificationService.notifyUser(result.exam.createdById, {
        type: 'regrade_request',
        title: 'New Regrade Request',
        message: `A student has requested a regrade for ${result.exam.title}`,
        resultId,
      });

      res.status(201).json({
        success: true,
        data: regradeRequest,
      });
    } catch (error) {
      logger.error('Create regrade request error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create regrade request' },
      });
    }
  }
);

/**
 * @route   PUT /api/v1/results/regrade/:id/respond
 * @desc    Respond to regrade request
 * @access  Private (Faculty, Admin)
 */
router.put(
  '/regrade/:id/respond',
  authenticate,
  authorize(Role.FACULTY, Role.ADMIN),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const requestId = req.params.id;
      const { status, response, newScore } = req.body;

      if (!['APPROVED', 'REJECTED', 'RESOLVED'].includes(status)) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: 'Invalid status' },
        });
        return;
      }

      const regradeRequest = await prisma.regradeRequest.findUnique({
        where: { id: requestId },
        include: {
          result: {
            include: { exam: { select: { createdById: true, title: true } } },
          },
          student: { include: { user: { select: { id: true } } } },
        },
      });

      if (!regradeRequest) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Regrade request not found' },
        });
        return;
      }

      if (req.user!.role !== Role.ADMIN && regradeRequest.result.exam.createdById !== req.user!.id) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only respond to requests for your own exams' },
        });
        return;
      }

      // Update regrade request
      const updatedRequest = await prisma.regradeRequest.update({
        where: { id: requestId },
        data: {
          status,
          response,
          responderId: req.user!.id,
          respondedAt: new Date(),
        },
      });

      // If approved and new score provided, update the result
      if (status === 'APPROVED' && newScore !== undefined) {
        await prisma.examResult.update({
          where: { id: regradeRequest.resultId },
          data: {
            score: newScore,
            status: ResultStatus.PUBLISHED,
          },
        });
      } else {
        // Reset status to published
        await prisma.examResult.update({
          where: { id: regradeRequest.resultId },
          data: { status: ResultStatus.PUBLISHED },
        });
      }

      // Log and notify student
      await logEntityChange(req, 'UPDATE', 'RegradeRequest', requestId, { status, response });

      await notificationService.notifyUser(regradeRequest.student.user.id, {
        type: 'regrade_response',
        title: 'Regrade Request ' + status.charAt(0) + status.slice(1).toLowerCase(),
        message: `Your regrade request for ${regradeRequest.result.exam.title} has been ${status.toLowerCase()}`,
        resultId: regradeRequest.resultId,
      });

      res.json({
        success: true,
        data: updatedRequest,
      });
    } catch (error) {
      logger.error('Respond to regrade error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to respond to regrade request' },
      });
    }
  }
);

export default router;
