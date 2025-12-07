import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { Exam, ExamStatus, ExamType, Course, Enrollment, Question, ExamSubmission } from '../models';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '../models/User';

const router = Router();

// -------------------
// STATIC ROUTES FIRST
// -------------------

// Get available exams for student
router.get('/available', authenticate, authorize(Role.STUDENT), async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;
    const enrollments = await Enrollment.find({ studentId, isActive: true }).select('courseId');
    const courseIds = enrollments.map(e => e.courseId);
    const now = new Date();

    const exams = await Exam.find({
      courseId: { $in: courseIds },
      status: ExamStatus.ACTIVE,
      $or: [{ startDate: null }, { startDate: { $lte: now } }],
    })
      .populate('courseId', 'code name')
      .sort({ endDate: 1 });

    const examsWithStatus = await Promise.all(
      exams.map(async (exam) => {
        const attemptCount = await ExamSubmission.countDocuments({ examId: exam._id, studentId });
        const canAttempt = attemptCount < (exam.settings?.maxAttempts ?? Infinity);
        const inProgress = await ExamSubmission.findOne({ examId: exam._id, studentId, status: 'IN_PROGRESS' });

        return {
          ...exam.toObject(),
          attemptCount,
          canAttempt,
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

// -------------------
// GET ALL EXAMS
// -------------------
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { courseId, status, type } = req.query;
    let filter: any = {};

    if (user.role === Role.STUDENT) {
      const enrollments = await Enrollment.find({ studentId: user.id, isActive: true }).select('courseId');
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

// -------------------
// GET SINGLE EXAM
// -------------------
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid exam ID' });
    }

    const exam = await Exam.findById(id)
      .populate('courseId', 'code name')
      .populate('createdById', 'firstName lastName email');

    if (!exam) return res.status(404).json({ error: 'Exam not found' });

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

// -------------------
// CREATE EXAM
// -------------------
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
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { title, description, instructions, courseId, type, startDate, endDate, settings, allowedSections } = req.body;
      const course = await Course.findById(courseId);
      if (!course) return res.status(404).json({ error: 'Course not found' });

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
        settings: settings || {},
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

// -------------------
// UPDATE EXAM
// -------------------
router.put('/:id', authenticate, authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid exam ID' });

    const exam = await Exam.findById(id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    if (req.user!.role === Role.FACULTY && exam.createdById.toString() !== req.user!.id.toString()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { title, description, instructions, type, startDate, endDate, settings, allowedSections } = req.body;
    if (title) exam.title = title;
    if (description !== undefined) exam.description = description;
    if (instructions !== undefined) exam.instructions = instructions;
    if (type) exam.type = type;
    if (startDate !== undefined) exam.startDate = startDate ? new Date(startDate) : undefined;
    if (endDate !== undefined) exam.endDate = endDate ? new Date(endDate) : undefined;
    if (settings) exam.settings = { ...exam.settings, ...settings };
    if (allowedSections !== undefined) exam.allowedSections = allowedSections;

    await exam.save();
    await exam.populate('courseId', 'code name');
    await exam.populate('createdById', 'firstName lastName');

    res.json(exam);
  } catch (error) {
    console.error('Error updating exam:', error);
    res.status(500).json({ error: 'Failed to update exam' });
  }
});

// -------------------
// PUBLISH / ACTIVATE / CLOSE / DELETE / DUPLICATE
// -------------------
const validateExamId = (id: string) => mongoose.Types.ObjectId.isValid(id);

router.post('/:id/publish', authenticate, authorize(Role.ADMIN, Role.FACULTY), async (req, res) => {
  const { id } = req.params;
  if (!validateExamId(id)) return res.status(400).json({ error: 'Invalid exam ID' });

  try {
    const exam = await Exam.findById(id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.status !== ExamStatus.DRAFT) return res.status(400).json({ error: 'Only draft exams can be published' });

    const questionCount = await Question.countDocuments({ examId: exam._id });
    if (questionCount === 0) return res.status(400).json({ error: 'Cannot publish exam without questions' });

    exam.status = ExamStatus.PUBLISHED;
    await exam.save();

    res.json({ message: 'Exam published successfully', exam });
  } catch (error) {
    console.error('Error publishing exam:', error);
    res.status(500).json({ error: 'Failed to publish exam' });
  }
});

router.post('/:id/activate', authenticate, authorize(Role.ADMIN, Role.FACULTY), async (req, res) => {
  const { id } = req.params;
  if (!validateExamId(id)) return res.status(400).json({ error: 'Invalid exam ID' });

  try {
    const exam = await Exam.findById(id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (exam.status !== ExamStatus.PUBLISHED) return res.status(400).json({ error: 'Only published exams can be activated' });

    exam.status = ExamStatus.ACTIVE;
    await exam.save();

    res.json({ message: 'Exam activated successfully', exam });
  } catch (error) {
    console.error('Error activating exam:', error);
    res.status(500).json({ error: 'Failed to activate exam' });
  }
});

router.post('/:id/close', authenticate, authorize(Role.ADMIN, Role.FACULTY), async (req, res) => {
  const { id } = req.params;
  if (!validateExamId(id)) return res.status(400).json({ error: 'Invalid exam ID' });

  try {
    const exam = await Exam.findById(id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    exam.status = ExamStatus.CLOSED;
    await exam.save();

    await ExamSubmission.updateMany(
      { examId: exam._id, status: 'IN_PROGRESS' },
      { status: 'SUBMITTED', submittedAt: new Date() }
    );

    res.json({ message: 'Exam closed successfully', exam });
  } catch (error) {
    console.error('Error closing exam:', error);
    res.status(500).json({ error: 'Failed to close exam' });
  }
});

router.delete('/:id', authenticate, authorize(Role.ADMIN, Role.FACULTY), async (req, res) => {
  const { id } = req.params;
  if (!validateExamId(id)) return res.status(400).json({ error: 'Invalid exam ID' });

  try {
    const exam = await Exam.findById(id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

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
});

router.post('/:id/duplicate', authenticate, authorize(Role.ADMIN, Role.FACULTY), async (req, res) => {
  const { id } = req.params;
  if (!validateExamId(id)) return res.status(400).json({ error: 'Invalid exam ID' });

  try {
    const exam = await Exam.findById(id);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

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
});

export default router;
