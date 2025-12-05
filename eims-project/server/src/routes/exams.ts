import { Router, Request, Response } from 'express';
import { Exam, ExamStatus, Course, Enrollment, Role, EnrollmentStatus, NotificationType } from '../models';
import { authenticate, authorize } from '../middleware/auth';
import { createExamValidator, updateExamValidator, createScheduleValidator, mongoIdValidator, paginationValidator } from '../middleware/validation';
import notificationService from '../services/notification';
import wsService from '../services/websocket';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/exams
 */
router.get('/', authenticate, paginationValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    let filter: any = {};

    if (req.user!.role === Role.STUDENT) {
      const enrollments = await Enrollment.find({
        studentId: req.user!.id,
        status: EnrollmentStatus.ENROLLED,
      }).select('courseId');
      filter.courseId = { $in: enrollments.map(e => e.courseId) };
      filter.status = { $ne: ExamStatus.DRAFT };
    }

    if (req.user!.role === Role.FACULTY) {
      filter.createdById = req.user!.id;
    }

    if (req.query.courseId) filter.courseId = req.query.courseId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.upcoming === 'true') {
      filter['schedules.startTime'] = { $gte: new Date() };
    }

    const [exams, total] = await Promise.all([
      Exam.find(filter)
        .populate('courseId', 'code name')
        .populate('createdById', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Exam.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { exams, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    logger.error('List exams error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch exams' } });
  }
});

/**
 * GET /api/v1/exams/upcoming
 */
router.get('/upcoming', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    let filter: any = {
      'schedules.startTime': { $gte: new Date() },
      status: { $in: [ExamStatus.SCHEDULED, ExamStatus.ONGOING] },
    };

    if (req.user!.role === Role.STUDENT) {
      const enrollments = await Enrollment.find({
        studentId: req.user!.id,
        status: EnrollmentStatus.ENROLLED,
      }).select('courseId');
      filter.courseId = { $in: enrollments.map(e => e.courseId) };
    } else if (req.user!.role === Role.FACULTY) {
      filter.createdById = req.user!.id;
    }

    const exams = await Exam.find(filter)
      .populate('courseId', 'code name')
      .sort({ 'schedules.startTime': 1 })
      .limit(limit);

    res.json({ success: true, data: { exams } });
  } catch (error) {
    logger.error('Get upcoming exams error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch upcoming exams' } });
  }
});

/**
 * GET /api/v1/exams/:id
 */
router.get('/:id', authenticate, mongoIdValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('courseId', 'code name facultyId')
      .populate('createdById', 'firstName lastName email');

    if (!exam) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } });
      return;
    }

    if (req.user!.role === Role.STUDENT) {
      const enrollment = await Enrollment.findOne({
        studentId: req.user!.id,
        courseId: exam.courseId,
        status: EnrollmentStatus.ENROLLED,
      });
      if (!enrollment || exam.status === ExamStatus.DRAFT) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
        return;
      }
    }

    res.json({ success: true, data: { exam } });
  } catch (error) {
    logger.error('Get exam error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch exam' } });
  }
});

/**
 * POST /api/v1/exams
 */
router.post('/', authenticate, authorize(Role.ADMIN, Role.FACULTY), createExamValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, courseId, type, totalPoints, passingScore, guidelines } = req.body;

    const course = await Course.findById(courseId);
    if (!course) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Course not found' } });
      return;
    }

    if (req.user!.role === Role.FACULTY && course.facultyId.toString() !== req.user!.id) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized for this course' } });
      return;
    }

    const exam = await Exam.create({
      title, description, courseId, createdById: req.user!.id, type, totalPoints, passingScore, guidelines, status: ExamStatus.DRAFT,
    });

    await exam.populate('courseId', 'code name');
    await exam.populate('createdById', 'firstName lastName');

    logger.info(`Exam created: ${exam.title} by ${req.user!.email}`);
    res.status(201).json({ success: true, data: { exam } });
  } catch (error) {
    logger.error('Create exam error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create exam' } });
  }
});

/**
 * PUT /api/v1/exams/:id
 */
router.put('/:id', authenticate, authorize(Role.ADMIN, Role.FACULTY), updateExamValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } });
      return;
    }

    if (req.user!.role === Role.FACULTY && exam.createdById.toString() !== req.user!.id) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
      return;
    }

    const { title, description, type, status, totalPoints, passingScore, guidelines } = req.body;
    if (title) exam.title = title;
    if (description !== undefined) exam.description = description;
    if (type) exam.type = type;
    if (status) exam.status = status;
    if (totalPoints) exam.totalPoints = totalPoints;
    if (passingScore !== undefined) exam.passingScore = passingScore;
    if (guidelines !== undefined) exam.guidelines = guidelines;

    await exam.save();
    await exam.populate('courseId', 'code name');
    await exam.populate('createdById', 'firstName lastName');

    if (status === ExamStatus.SCHEDULED) {
      const enrollments = await Enrollment.find({ courseId: exam.courseId, status: EnrollmentStatus.ENROLLED }).select('studentId');
      const studentIds = enrollments.map(e => e.studentId.toString());
      await notificationService.notifyMany(studentIds, NotificationType.EXAM_SCHEDULED, 'New Exam Scheduled', `${exam.title} has been scheduled`, { examId: exam._id });
      wsService.sendToChannel('announcements', 'exam:scheduled', { examId: exam._id, title: exam.title });
    }

    res.json({ success: true, data: { exam } });
  } catch (error) {
    logger.error('Update exam error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update exam' } });
  }
});

/**
 * DELETE /api/v1/exams/:id
 */
router.delete('/:id', authenticate, authorize(Role.ADMIN, Role.FACULTY), mongoIdValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } });
      return;
    }

    if (req.user!.role !== Role.ADMIN && exam.status !== ExamStatus.DRAFT) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Only draft exams can be deleted' } });
      return;
    }

    await exam.deleteOne();
    res.json({ success: true, data: { message: 'Exam deleted successfully' } });
  } catch (error) {
    logger.error('Delete exam error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete exam' } });
  }
});

/**
 * POST /api/v1/exams/:id/schedules
 */
router.post('/:id/schedules', authenticate, authorize(Role.ADMIN, Role.FACULTY), createScheduleValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } });
      return;
    }

    const { section, room, meetingLink, startTime, endTime, instructions } = req.body;
    exam.schedules.push({ section, room, meetingLink, startTime: new Date(startTime), endTime: new Date(endTime), instructions });
    await exam.save();
    await exam.populate('courseId', 'code name');

    const enrollments = await Enrollment.find({ courseId: exam.courseId, status: EnrollmentStatus.ENROLLED }).select('studentId');
    const studentIds = enrollments.map(e => e.studentId.toString());
    await notificationService.notifyMany(studentIds, NotificationType.EXAM_UPDATED, 'Exam Schedule Added', `New schedule for ${exam.title}: ${section}`, { examId: exam._id });

    res.status(201).json({ success: true, data: { exam } });
  } catch (error) {
    logger.error('Add schedule error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to add schedule' } });
  }
});

/**
 * PUT /api/v1/exams/:id/schedules/:scheduleId
 */
router.put('/:id/schedules/:scheduleId', authenticate, authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } });
      return;
    }

    const schedule = exam.schedules.id(req.params.scheduleId);
    if (!schedule) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Schedule not found' } });
      return;
    }

    const { section, room, meetingLink, startTime, endTime, instructions } = req.body;
    if (section) schedule.section = section;
    if (room !== undefined) schedule.room = room;
    if (meetingLink !== undefined) schedule.meetingLink = meetingLink;
    if (startTime) schedule.startTime = new Date(startTime);
    if (endTime) schedule.endTime = new Date(endTime);
    if (instructions !== undefined) schedule.instructions = instructions;

    await exam.save();
    wsService.sendToChannel('announcements', 'schedule:updated', { examId: exam._id, scheduleId: schedule._id });

    res.json({ success: true, data: { exam } });
  } catch (error) {
    logger.error('Update schedule error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update schedule' } });
  }
});

/**
 * DELETE /api/v1/exams/:id/schedules/:scheduleId
 */
router.delete('/:id/schedules/:scheduleId', authenticate, authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } });
      return;
    }

    const schedule = exam.schedules.id(req.params.scheduleId);
    if (!schedule) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Schedule not found' } });
      return;
    }

    schedule.deleteOne();
    await exam.save();
    res.json({ success: true, data: { message: 'Schedule deleted successfully' } });
  } catch (error) {
    logger.error('Delete schedule error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete schedule' } });
  }
});

export default router;
