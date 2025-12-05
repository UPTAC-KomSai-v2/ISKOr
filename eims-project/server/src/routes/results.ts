import { Router, Request, Response } from 'express';
import { ExamResult, ResultStatus, RegradeStatus, Exam, Enrollment, Role, EnrollmentStatus, NotificationType } from '../models';
import { authenticate, authorize } from '../middleware/auth';
import { createResultValidator, bulkResultValidator, regradeRequestValidator, regradeResponseValidator, mongoIdValidator, paginationValidator } from '../middleware/validation';
import notificationService from '../services/notification';
import wsService from '../services/websocket';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/results
 * List results with filters
 */
router.get('/', authenticate, paginationValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    let filter: any = {};

    // Students only see their own published results
    if (req.user!.role === Role.STUDENT) {
      filter.studentId = req.user!.id;
      filter.status = ResultStatus.PUBLISHED;
    }

    if (req.query.examId) filter.examId = req.query.examId;
    if (req.query.studentId && req.user!.role !== Role.STUDENT) filter.studentId = req.query.studentId;
    if (req.query.status && req.user!.role !== Role.STUDENT) filter.status = req.query.status;

    const [results, total] = await Promise.all([
      ExamResult.find(filter)
        .populate('examId', 'title type totalPoints passingScore courseId')
        .populate('studentId', 'firstName lastName email studentNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ExamResult.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { results, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    logger.error('List results error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch results' } });
  }
});

/**
 * GET /api/v1/results/exam/:examId
 * Get all results for an exam (Faculty/Admin)
 */
router.get('/exam/:examId', authenticate, authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response): Promise<void> => {
  try {
    const results = await ExamResult.find({ examId: req.params.examId })
      .populate('studentId', 'firstName lastName email studentNumber section')
      .sort({ score: -1 });

    const exam = await Exam.findById(req.params.examId).select('title totalPoints passingScore');

    // Calculate statistics
    const scores = results.map(r => r.score);
    const stats = {
      count: results.length,
      average: scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0,
      highest: scores.length ? Math.max(...scores) : 0,
      lowest: scores.length ? Math.min(...scores) : 0,
      passed: exam?.passingScore ? results.filter(r => r.score >= exam.passingScore!).length : 0,
    };

    res.json({ success: true, data: { results, exam, stats } });
  } catch (error) {
    logger.error('Get exam results error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch results' } });
  }
});

/**
 * GET /api/v1/results/:id
 * Get result details
 */
router.get('/:id', authenticate, mongoIdValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await ExamResult.findById(req.params.id)
      .populate('examId', 'title type totalPoints passingScore courseId')
      .populate('studentId', 'firstName lastName email studentNumber')
      .populate('regradeRequests.respondedById', 'firstName lastName');

    if (!result) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Result not found' } });
      return;
    }

    // Students can only see their own results
    if (req.user!.role === Role.STUDENT) {
      if (result.studentId._id.toString() !== req.user!.id || result.status !== ResultStatus.PUBLISHED) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
        return;
      }
    }

    res.json({ success: true, data: { result } });
  } catch (error) {
    logger.error('Get result error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch result' } });
  }
});

/**
 * POST /api/v1/results
 * Create a single result
 */
router.post('/', authenticate, authorize(Role.ADMIN, Role.FACULTY), createResultValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const { examId, studentId, score, remarks } = req.body;

    // Check if exam exists
    const exam = await Exam.findById(examId);
    if (!exam) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } });
      return;
    }

    // Check if student is enrolled
    const enrollment = await Enrollment.findOne({ studentId, courseId: exam.courseId, status: EnrollmentStatus.ENROLLED });
    if (!enrollment) {
      res.status(400).json({ success: false, error: { code: 'NOT_ENROLLED', message: 'Student not enrolled in this course' } });
      return;
    }

    // Check for existing result
    const existing = await ExamResult.findOne({ examId, studentId });
    if (existing) {
      res.status(400).json({ success: false, error: { code: 'DUPLICATE', message: 'Result already exists for this student' } });
      return;
    }

    const result = await ExamResult.create({ examId, studentId, score, remarks });
    await result.populate('studentId', 'firstName lastName studentNumber');

    res.status(201).json({ success: true, data: { result } });
  } catch (error) {
    logger.error('Create result error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create result' } });
  }
});

/**
 * POST /api/v1/results/bulk
 * Create multiple results at once
 */
router.post('/bulk', authenticate, authorize(Role.ADMIN, Role.FACULTY), bulkResultValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const { examId, results: resultData } = req.body;

    const exam = await Exam.findById(examId);
    if (!exam) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } });
      return;
    }

    // Create results using upsert
    const operations = resultData.map((r: { studentId: string; score: number; remarks?: string }) => ({
      updateOne: {
        filter: { examId, studentId: r.studentId },
        update: { $set: { score: r.score, remarks: r.remarks } },
        upsert: true,
      },
    }));

    const bulkResult = await ExamResult.bulkWrite(operations);

    res.status(201).json({
      success: true,
      data: {
        message: `Created/updated ${bulkResult.upsertedCount + bulkResult.modifiedCount} results`,
        created: bulkResult.upsertedCount,
        updated: bulkResult.modifiedCount,
      },
    });
  } catch (error) {
    logger.error('Bulk create results error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create results' } });
  }
});

/**
 * PUT /api/v1/results/:id
 * Update a result
 */
router.put('/:id', authenticate, authorize(Role.ADMIN, Role.FACULTY), mongoIdValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const { score, remarks } = req.body;

    const result = await ExamResult.findById(req.params.id);
    if (!result) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Result not found' } });
      return;
    }

    if (score !== undefined) result.score = score;
    if (remarks !== undefined) result.remarks = remarks;

    await result.save();
    await result.populate('studentId', 'firstName lastName studentNumber');

    res.json({ success: true, data: { result } });
  } catch (error) {
    logger.error('Update result error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update result' } });
  }
});

/**
 * PUT /api/v1/results/:id/publish
 * Publish a result (make visible to student)
 */
router.put('/:id/publish', authenticate, authorize(Role.ADMIN, Role.FACULTY), mongoIdValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await ExamResult.findById(req.params.id).populate('examId', 'title');
    if (!result) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Result not found' } });
      return;
    }

    result.status = ResultStatus.PUBLISHED;
    result.publishedAt = new Date();
    await result.save();

    // Notify student
    await notificationService.notify(
      result.studentId.toString(),
      NotificationType.RESULT_PUBLISHED,
      'Result Published',
      `Your result for ${(result.examId as any).title} is now available`,
      { resultId: result._id, examId: result.examId }
    );

    wsService.sendToUser(result.studentId.toString(), 'result:published', { resultId: result._id });

    res.json({ success: true, data: { result } });
  } catch (error) {
    logger.error('Publish result error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to publish result' } });
  }
});

/**
 * PUT /api/v1/results/publish-bulk
 * Publish multiple results
 */
router.put('/publish-bulk', authenticate, authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response): Promise<void> => {
  try {
    const { resultIds } = req.body;

    if (!Array.isArray(resultIds) || resultIds.length === 0) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'resultIds array required' } });
      return;
    }

    await ExamResult.updateMany(
      { _id: { $in: resultIds } },
      { status: ResultStatus.PUBLISHED, publishedAt: new Date() }
    );

    // Get updated results for notifications
    const results = await ExamResult.find({ _id: { $in: resultIds } }).populate('examId', 'title');
    
    for (const result of results) {
      await notificationService.notify(
        result.studentId.toString(),
        NotificationType.RESULT_PUBLISHED,
        'Result Published',
        `Your result for ${(result.examId as any).title} is now available`,
        { resultId: result._id }
      );
    }

    res.json({ success: true, data: { message: `Published ${resultIds.length} results` } });
  } catch (error) {
    logger.error('Bulk publish results error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to publish results' } });
  }
});

/**
 * POST /api/v1/results/:id/regrade
 * Request a regrade (Student)
 */
router.post('/:id/regrade', authenticate, authorize(Role.STUDENT), regradeRequestValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const { reason } = req.body;

    const result = await ExamResult.findById(req.params.id).populate('examId', 'title courseId');
    if (!result) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Result not found' } });
      return;
    }

    if (result.studentId.toString() !== req.user!.id) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your result' } });
      return;
    }

    if (result.status !== ResultStatus.PUBLISHED) {
      res.status(400).json({ success: false, error: { code: 'NOT_PUBLISHED', message: 'Result not yet published' } });
      return;
    }

    // Check if there's already a pending regrade
    const hasPending = result.regradeRequests.some(r => r.status === RegradeStatus.PENDING);
    if (hasPending) {
      res.status(400).json({ success: false, error: { code: 'PENDING_EXISTS', message: 'You already have a pending regrade request' } });
      return;
    }

    result.regradeRequests.push({ reason, status: RegradeStatus.PENDING, requestedAt: new Date() });
    await result.save();

    // Notify faculty
    const exam = result.examId as any;
    const course = await (await import('../models')).Course.findById(exam.courseId);
    if (course) {
      await notificationService.notify(
        course.facultyId.toString(),
        NotificationType.SYSTEM,
        'Regrade Request',
        `New regrade request for ${exam.title}`,
        { resultId: result._id, studentId: req.user!.id }
      );
    }

    res.status(201).json({ success: true, data: { message: 'Regrade request submitted' } });
  } catch (error) {
    logger.error('Request regrade error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to submit regrade request' } });
  }
});

/**
 * PUT /api/v1/results/:id/regrade/:regradeId
 * Respond to a regrade request (Faculty/Admin)
 */
router.put('/:id/regrade/:regradeId', authenticate, authorize(Role.ADMIN, Role.FACULTY), regradeResponseValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, response, newScore } = req.body;

    const result = await ExamResult.findById(req.params.id);
    if (!result) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Result not found' } });
      return;
    }

    const regrade = result.regradeRequests.id(req.params.regradeId);
    if (!regrade) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Regrade request not found' } });
      return;
    }

    regrade.status = status;
    regrade.response = response;
    regrade.respondedById = req.user!.id as any;
    regrade.respondedAt = new Date();

    // Update score if approved and new score provided
    if (status === RegradeStatus.APPROVED && newScore !== undefined) {
      result.score = newScore;
    }

    await result.save();

    // Notify student
    await notificationService.notify(
      result.studentId.toString(),
      NotificationType.REGRADE_RESPONSE,
      `Regrade Request ${status}`,
      response,
      { resultId: result._id, status }
    );

    res.json({ success: true, data: { result } });
  } catch (error) {
    logger.error('Respond to regrade error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to respond to regrade' } });
  }
});

/**
 * GET /api/v1/results/regrades/pending
 * Get pending regrade requests (Faculty/Admin)
 */
router.get('/regrades/pending', authenticate, authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response): Promise<void> => {
  try {
    const results = await ExamResult.find({
      'regradeRequests.status': RegradeStatus.PENDING,
    })
      .populate('examId', 'title courseId')
      .populate('studentId', 'firstName lastName studentNumber');

    // Filter to only include pending requests
    const pendingRequests = results.flatMap(result => 
      result.regradeRequests
        .filter(r => r.status === RegradeStatus.PENDING)
        .map(r => ({
          resultId: result._id,
          examId: result.examId,
          studentId: result.studentId,
          score: result.score,
          regradeId: r._id,
          reason: r.reason,
          requestedAt: r.requestedAt,
        }))
    );

    res.json({ success: true, data: { requests: pendingRequests } });
  } catch (error) {
    logger.error('Get pending regrades error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch regrade requests' } });
  }
});

export default router;
