import { Router, Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth';
import { createScheduleValidator, idParamValidator } from '../middleware/validation';
import { logEntityChange } from '../middleware/audit';
import notificationService from '../services/notification';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/schedules
 * @desc    Get all schedules (optionally filtered)
 * @access  Private
 */
router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { examId, upcoming } = req.query;

    let whereClause: any = {};

    if (examId) {
      whereClause.examId = examId;
    }

    if (upcoming === 'true') {
      whereClause.startTime = { gte: new Date() };
    }

    // For students, only show schedules for their enrolled courses
    if (req.user!.role === Role.STUDENT) {
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
        whereClause.exam = {
          courseId: { in: courseIds },
          status: { not: 'DRAFT' },
        };
      }
    }

    const schedules = await prisma.examSchedule.findMany({
      where: whereClause,
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            type: true,
            course: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    res.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    logger.error('Get schedules error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch schedules' },
    });
  }
});

/**
 * @route   GET /api/v1/schedules/exam/:examId
 * @desc    Get schedules for a specific exam
 * @access  Private
 */
router.get('/exam/:examId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const schedules = await prisma.examSchedule.findMany({
      where: { examId: req.params.examId },
      orderBy: { startTime: 'asc' },
    });

    res.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    logger.error('Get exam schedules error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch schedules' },
    });
  }
});

/**
 * @route   POST /api/v1/schedules
 * @desc    Create exam schedule
 * @access  Private (Faculty, Admin)
 */
router.post(
  '/',
  authenticate,
  authorize(Role.FACULTY, Role.ADMIN),
  createScheduleValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { examId, section, room, meetLink, startTime, endTime } = req.body;

      // Verify exam exists and user has permission
      const exam = await prisma.exam.findUnique({ where: { id: examId } });

      if (!exam) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Exam not found' },
        });
        return;
      }

      if (req.user!.role !== Role.ADMIN && exam.createdById !== req.user!.id) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only add schedules to your own exams' },
        });
        return;
      }

      const schedule = await prisma.examSchedule.create({
        data: {
          examId,
          section,
          room,
          meetLink,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
        },
        include: {
          exam: { select: { title: true, courseId: true } },
        },
      });

      // Log creation
      await logEntityChange(req, 'CREATE', 'ExamSchedule', schedule.id, req.body);

      // Notify students about the new schedule
      await notificationService.notifyScheduleChange(
        examId,
        schedule.exam.title,
        `New schedule added: ${section ? `Section ${section}` : 'All sections'} on ${new Date(startTime).toLocaleDateString()}`
      );

      logger.info(`Schedule created for exam ${examId} by ${req.user!.email}`);

      res.status(201).json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      logger.error('Create schedule error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create schedule' },
      });
    }
  }
);

/**
 * @route   PUT /api/v1/schedules/:id
 * @desc    Update exam schedule
 * @access  Private (Faculty, Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize(Role.FACULTY, Role.ADMIN),
  idParamValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const scheduleId = req.params.id;

      const existingSchedule = await prisma.examSchedule.findUnique({
        where: { id: scheduleId },
        include: { exam: true },
      });

      if (!existingSchedule) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Schedule not found' },
        });
        return;
      }

      if (req.user!.role !== Role.ADMIN && existingSchedule.exam.createdById !== req.user!.id) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only update schedules for your own exams' },
        });
        return;
      }

      const { section, room, meetLink, startTime, endTime } = req.body;

      const schedule = await prisma.examSchedule.update({
        where: { id: scheduleId },
        data: {
          ...(section !== undefined && { section }),
          ...(room !== undefined && { room }),
          ...(meetLink !== undefined && { meetLink }),
          ...(startTime && { startTime: new Date(startTime) }),
          ...(endTime && { endTime: new Date(endTime) }),
        },
        include: {
          exam: { select: { id: true, title: true } },
        },
      });

      // Log update
      await logEntityChange(req, 'UPDATE', 'ExamSchedule', schedule.id, req.body);

      // Notify about schedule change
      await notificationService.notifyScheduleChange(
        schedule.exam.id,
        schedule.exam.title,
        `Schedule updated: ${schedule.section ? `Section ${schedule.section}` : 'All sections'}`
      );

      res.json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      logger.error('Update schedule error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update schedule' },
      });
    }
  }
);

/**
 * @route   DELETE /api/v1/schedules/:id
 * @desc    Delete exam schedule
 * @access  Private (Faculty, Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize(Role.FACULTY, Role.ADMIN),
  idParamValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const scheduleId = req.params.id;

      const schedule = await prisma.examSchedule.findUnique({
        where: { id: scheduleId },
        include: { exam: true },
      });

      if (!schedule) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Schedule not found' },
        });
        return;
      }

      if (req.user!.role !== Role.ADMIN && schedule.exam.createdById !== req.user!.id) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only delete schedules for your own exams' },
        });
        return;
      }

      await prisma.examSchedule.delete({ where: { id: scheduleId } });

      // Log deletion
      await logEntityChange(req, 'DELETE', 'ExamSchedule', scheduleId);

      res.json({
        success: true,
        data: { message: 'Schedule deleted successfully' },
      });
    } catch (error) {
      logger.error('Delete schedule error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete schedule' },
      });
    }
  }
);

export default router;
