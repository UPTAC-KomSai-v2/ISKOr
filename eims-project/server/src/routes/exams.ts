import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { Exam, ExamStatus, ExamType, Course, Enrollment, Question, ExamSubmission } from '../models';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '../models/User';
import mongoose from 'mongoose';

const router = Router();

// Get all exams
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { courseId, status, type } = req.query;

    let filter: any = {};

    if (user.role === Role.STUDENT) {
      const enrollments = await Enrollment.find({
        studentId: user.id,
        isActive: true,
      }).select('courseId');
      
      filter.courseId = { $in: enrollments.map(e => e.courseId) };
      filter.status = { $in: [ExamStatus.PUBLISHED, ExamStatus.ACTIVE, ExamStatus.CLOSED, ExamStatus.COMPLETED] };
    } else if (user.role === Role.FACULTY) {
      filter.createdById = user.id;
    }

    if (courseId) filter.courseId = courseId;
    if (status) filter.status = status;
    if (type) filter.type = type;

    const exams = await Exam.find(filter)
      .populate('courseId', 'code name')
      .populate('createdById', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(exams);
  } catch (error) {
    console.error('Error fetching exams:', error);
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
});

// Get upcoming exams for dashboard - FIXED
router.get('/upcoming', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const limit = parseInt(req.query.limit as string) || 5;
    const now = new Date();

    let filter: any = {};

    if (user.role === Role.STUDENT) {
      // Get student's enrolled courses
      const enrollments = await Enrollment.find({
        studentId: new mongoose.Types.ObjectId(user.id),
        isActive: true,
      }).select('courseId');
      
      const courseIds = enrollments.map(e => e.courseId);
      
      filter = {
        courseId: { $in: courseIds },
        status: ExamStatus.ACTIVE,
        $or: [
          { endDate: { $gte: now } },
          { endDate: null },
          { endDate: { $exists: false } },
        ],
      };
    } else if (user.role === Role.FACULTY) {
      filter = {
        createdById: user.id,
        status: { $in: [ExamStatus.ACTIVE, ExamStatus.PUBLISHED] },
      };
    } else {
      // Admin sees all active exams
      filter = {
        status: { $in: [ExamStatus.ACTIVE, ExamStatus.PUBLISHED] },
      };
    }

    const exams = await Exam.find(filter)
      .populate('courseId', 'code name')
      .populate('createdById', 'firstName lastName')
      .sort({ endDate: 1, startDate: 1 })
      .limit(limit);

    res.json({ success: true, data: { exams } });
  } catch (error) {
    console.error('Error fetching upcoming exams:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming exams' });
  }
});

// Get available exams for student
router.get('/available', authenticate, authorize(Role.STUDENT), async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;

    const enrollments = await Enrollment.find({
      studentId: new mongoose.Types.ObjectId(studentId),
      isActive: true,
    }).select('courseId');

    const courseIds = enrollments.map(e => e.courseId);
    const now = new Date();

    const exams = await Exam.find({
      courseId: { $in: courseIds },
      status: ExamStatus.ACTIVE,
      $or: [
        { startDate: null },
        { startDate: { $lte: now } },
      ],
    })
      .populate('courseId', 'code name')
      .sort({ endDate: 1 });

    // FIXED: Properly calculate attempt counts
    const examsWithStatus = await Promise.all(
      exams.map(async (exam) => {
        // Count only COMPLETED attempts (submitted, graded, returned)
        const completedAttempts = await ExamSubmission.countDocuments({
          examId: exam._id,
          studentId: new mongoose.Types.ObjectId(studentId),
          status: { $in: ['SUBMITTED', 'GRADED', 'RETURNED'] },
        });

        const canAttempt = completedAttempts < exam.settings.maxAttempts;
        
        const inProgress = await ExamSubmission.findOne({
          examId: exam._id,
          studentId: new mongoose.Types.ObjectId(studentId),
          status: 'IN_PROGRESS',
        });

        return {
          ...exam.toObject(),
          attemptCount: completedAttempts,
          canAttempt: canAttempt || !!inProgress, // Can attempt if has remaining attempts OR has in-progress
          hasInProgress: !!inProgress,
          inProgressId: inProgress?._id,
        };
      })
    );

    res.json(examsWithStatus);
  } catch (error) {
    console.error('Error fetching available exams:', error);
    res.status(500).json({ error: 'Failed to fetch available exams' });
  }
});

// Get single exam
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('courseId', 'code name')
      .populate('createdById', 'firstName lastName email');

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    if (req.user!.role !== Role.STUDENT) {
      const questionCount = await Question.countDocuments({ examId: exam._id });
      return res.json({ ...exam.toObject(), questionCount });
    }

    res.json(exam);
  } catch (error) {
    console.error('Error fetching exam:', error);
    res.status(500).json({ error: 'Failed to fetch exam' });
  }
});

// Create exam
router.post(
  '/',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  [
    body('title').notEmpty().trim(),
    body('courseId').isMongoId(),
    body('type').isIn(Object.values(ExamType)),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { title, description, instructions, courseId, type, startDate, endDate, settings, allowedSections } = req.body;

      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const exam = new Exam({
        title,
        description,
        instructions,
        courseId,
        createdById: req.user!.id,
        type,
        status: ExamStatus.DRAFT,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        settings: settings || {
          timeLimitMinutes: null,
          maxAttempts: 1,
          shuffleQuestions: false,
          shuffleChoices: false,
          showResults: true,
          showCorrectAnswers: false,
          showFeedback: true,
          allowReview: true,
          passingPercentage: 60,
          lateSubmissionAllowed: false,
          lateSubmissionPenalty: 0,
        },
        allowedSections,
      });

      await exam.save();
      await exam.populate('courseId', 'code name');
      await exam.populate('createdById', 'firstName lastName');

      res.status(201).json(exam);
    } catch (error) {
      console.error('Error creating exam:', error);
      res.status(500).json({ error: 'Failed to create exam' });
    }
  }
);

// Update exam
router.put(
  '/:id',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const exam = await Exam.findById(req.params.id);
      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      // Only allow editing draft exams or limited fields for published exams
      const { title, description, instructions, startDate, endDate, settings, allowedSections, type } = req.body;

      if (exam.status === ExamStatus.DRAFT) {
        if (title) exam.title = title;
        if (description !== undefined) exam.description = description;
        if (instructions !== undefined) exam.instructions = instructions;
        if (type) exam.type = type;
      }

      // These can be changed anytime
      if (startDate !== undefined) exam.startDate = startDate ? new Date(startDate) : undefined;
      if (endDate !== undefined) exam.endDate = endDate ? new Date(endDate) : undefined;
      if (settings) exam.settings = { ...exam.settings, ...settings };
      if (allowedSections) exam.allowedSections = allowedSections;

      await exam.save();
      await exam.populate('courseId', 'code name');
      await exam.populate('createdById', 'firstName lastName');

      res.json(exam);
    } catch (error) {
      console.error('Error updating exam:', error);
      res.status(500).json({ error: 'Failed to update exam' });
    }
  }
);

// Publish exam
router.post(
  '/:id/publish',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const exam = await Exam.findById(req.params.id);
      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      if (exam.status !== ExamStatus.DRAFT) {
        return res.status(400).json({ error: 'Only draft exams can be published' });
      }

      // Check if exam has questions
      const questionCount = await Question.countDocuments({ examId: exam._id });
      if (questionCount === 0) {
        return res.status(400).json({ error: 'Cannot publish exam without questions' });
      }

      exam.status = ExamStatus.PUBLISHED;
      await exam.save();

      res.json({ message: 'Exam published successfully', exam });
    } catch (error) {
      console.error('Error publishing exam:', error);
      res.status(500).json({ error: 'Failed to publish exam' });
    }
  }
);

// Activate exam
router.post(
  '/:id/activate',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const exam = await Exam.findById(req.params.id);
      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      if (exam.status !== ExamStatus.PUBLISHED && exam.status !== ExamStatus.DRAFT) {
        return res.status(400).json({ error: 'Only published or draft exams can be activated' });
      }

      // Check if exam has questions
      const questionCount = await Question.countDocuments({ examId: exam._id });
      if (questionCount === 0) {
        return res.status(400).json({ error: 'Cannot activate exam without questions' });
      }

      exam.status = ExamStatus.ACTIVE;
      await exam.save();

      res.json({ message: 'Exam activated successfully', exam });
    } catch (error) {
      console.error('Error activating exam:', error);
      res.status(500).json({ error: 'Failed to activate exam' });
    }
  }
);

// Close exam
router.post(
  '/:id/close',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const exam = await Exam.findById(req.params.id);
      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      exam.status = ExamStatus.CLOSED;
      await exam.save();

      // Auto-submit any in-progress submissions
      await ExamSubmission.updateMany(
        { examId: exam._id, status: 'IN_PROGRESS' },
        { status: 'SUBMITTED', submittedAt: new Date() }
      );

      res.json({ message: 'Exam closed successfully', exam });
    } catch (error) {
      console.error('Error closing exam:', error);
      res.status(500).json({ error: 'Failed to close exam' });
    }
  }
);

// Delete exam
router.delete(
  '/:id',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const exam = await Exam.findById(req.params.id);
      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      if (req.user!.role !== Role.ADMIN && exam.status !== ExamStatus.DRAFT) {
        return res.status(400).json({ error: 'Only draft exams can be deleted' });
      }

      await Question.deleteMany({ examId: exam._id });
      await ExamSubmission.deleteMany({ examId: exam._id });
      await exam.deleteOne();

      res.json({ message: 'Exam deleted successfully' });
    } catch (error) {
      console.error('Error deleting exam:', error);
      res.status(500).json({ error: 'Failed to delete exam' });
    }
  }
);

// Get exam statistics
router.get(
  '/:id/statistics',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const exam = await Exam.findById(req.params.id);
      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      const submissions = await ExamSubmission.find({
        examId: exam._id,
        status: { $in: ['SUBMITTED', 'GRADED', 'RETURNED'] },
      });

      if (submissions.length === 0) {
        return res.json({
          totalSubmissions: 0,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          passingCount: 0,
          passingRate: 0,
        });
      }

      const scores = submissions.map((s) => s.percentage);
      const passingCount = submissions.filter((s) => s.isPassing).length;

      res.json({
        totalSubmissions: submissions.length,
        averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        highestScore: Math.max(...scores),
        lowestScore: Math.min(...scores),
        passingCount,
        passingRate: Math.round((passingCount / submissions.length) * 100),
      });
    } catch (error) {
      console.error('Error getting exam statistics:', error);
      res.status(500).json({ error: 'Failed to get exam statistics' });
    }
  }
);

// Duplicate exam
router.post(
  '/:id/duplicate',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const exam = await Exam.findById(req.params.id);
      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      const newExam = new Exam({
        title: `${exam.title} (Copy)`,
        description: exam.description,
        instructions: exam.instructions,
        courseId: exam.courseId,
        createdById: req.user!.id,
        type: exam.type,
        status: ExamStatus.DRAFT,
        settings: exam.settings,
        allowedSections: exam.allowedSections,
      });

      await newExam.save();

      const questions = await Question.find({ examId: exam._id });
      const newQuestions = questions.map(q => ({
        examId: newExam._id,
        type: q.type,
        questionText: q.questionText,
        points: q.points,
        order: q.order,
        choices: q.choices,
        correctAnswer: q.correctAnswer,
        acceptedAnswers: q.acceptedAnswers,
        caseSensitive: q.caseSensitive,
        matchingPairs: q.matchingPairs,
        rubric: q.rubric,
        maxWords: q.maxWords,
        imageUrl: q.imageUrl,
        explanation: q.explanation,
      }));

      if (newQuestions.length > 0) {
        await Question.insertMany(newQuestions);
        newExam.questionCount = newQuestions.length;
        newExam.totalPoints = newQuestions.reduce((sum, q) => sum + q.points, 0);
        await newExam.save();
      }

      await newExam.populate('courseId', 'code name');
      await newExam.populate('createdById', 'firstName lastName');

      res.status(201).json(newExam);
    } catch (error) {
      console.error('Error duplicating exam:', error);
      res.status(500).json({ error: 'Failed to duplicate exam' });
    }
  }
);

export default router;
