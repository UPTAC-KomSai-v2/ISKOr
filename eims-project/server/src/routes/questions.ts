import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { Question, QuestionType, Exam, ExamStatus } from '../models';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '../models/User';

const router = Router();

// Get all questions for an exam
router.get(
  '/exam/:examId',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { examId } = req.params;
      const user = req.user!;

      const exam = await Exam.findById(examId);
      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      // Check access - faculty who created it or admin can see all
      // Students can only see questions if exam is active and they're taking it
      if (user.role === Role.STUDENT) {
        if (exam.status !== ExamStatus.ACTIVE) {
          return res.status(403).json({ error: 'Exam is not currently active' });
        }
      }

      const questions = await Question.find({ examId })
        .sort({ order: 1 });

      // For students, don't reveal correct answers
      if (user.role === Role.STUDENT) {
        const sanitizedQuestions = questions.map(q => {
          const qObj = q.toObject();
          // Remove correct answer indicators
          if (qObj.choices) {
            (qObj as any).choices = qObj.choices.map((c: any) => ({
              _id: c._id,
              text: c.text,
            }));
          }
          delete qObj.correctAnswer;
          delete qObj.acceptedAnswers;
          delete qObj.explanation;
          return qObj;
        });
        return res.json(sanitizedQuestions);
      }

      res.json(questions);
    } catch (error) {
      console.error('Error fetching questions:', error);
      res.status(500).json({ error: 'Failed to fetch questions' });
    }
  }
);

// Get single question
router.get(
  '/:id',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const question = await Question.findById(req.params.id);
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }
      res.json(question);
    } catch (error) {
      console.error('Error fetching question:', error);
      res.status(500).json({ error: 'Failed to fetch question' });
    }
  }
);

// Create question
router.post(
  '/',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  [
    body('examId').isMongoId(),
    body('type').isIn(Object.values(QuestionType)),
    body('questionText').notEmpty().trim(),
    body('points').isInt({ min: 0 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { examId, type, questionText, points, choices, correctAnswer, acceptedAnswers, caseSensitive, matchingPairs, rubric, maxWords, imageUrl, explanation } = req.body;

      // Check exam exists and is editable
      const exam = await Exam.findById(examId);
      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      if (exam.status !== ExamStatus.DRAFT) {
        return res.status(400).json({ error: 'Cannot add questions to a published exam' });
      }

      // Get next order number
      const lastQuestion = await Question.findOne({ examId }).sort({ order: -1 });
      const order = lastQuestion ? lastQuestion.order + 1 : 0;

      const question = new Question({
        examId,
        type,
        questionText,
        points,
        order,
        choices,
        correctAnswer,
        acceptedAnswers,
        caseSensitive,
        matchingPairs,
        rubric,
        maxWords,
        imageUrl,
        explanation,
      });

      await question.save();

      // Update exam totals
      await Exam.findByIdAndUpdate(examId, {
        $inc: { totalPoints: points, questionCount: 1 },
      });

      res.status(201).json(question);
    } catch (error) {
      console.error('Error creating question:', error);
      res.status(500).json({ error: 'Failed to create question' });
    }
  }
);

// Update question
router.put(
  '/:id',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const question = await Question.findById(req.params.id);
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }

      const exam = await Exam.findById(question.examId);
      if (exam && exam.status !== ExamStatus.DRAFT) {
        return res.status(400).json({ error: 'Cannot edit questions of a published exam' });
      }

      const oldPoints = question.points;
      const { type, questionText, points, choices, correctAnswer, acceptedAnswers, caseSensitive, matchingPairs, rubric, maxWords, imageUrl, explanation, order } = req.body;

      if (type) question.type = type;
      if (questionText) question.questionText = questionText;
      if (points !== undefined) question.points = points;
      if (choices !== undefined) question.choices = choices;
      if (correctAnswer !== undefined) question.correctAnswer = correctAnswer;
      if (acceptedAnswers !== undefined) question.acceptedAnswers = acceptedAnswers;
      if (caseSensitive !== undefined) question.caseSensitive = caseSensitive;
      if (matchingPairs !== undefined) question.matchingPairs = matchingPairs;
      if (rubric !== undefined) question.rubric = rubric;
      if (maxWords !== undefined) question.maxWords = maxWords;
      if (imageUrl !== undefined) question.imageUrl = imageUrl;
      if (explanation !== undefined) question.explanation = explanation;
      if (order !== undefined) question.order = order;

      await question.save();

      // Update exam total points if changed
      if (points !== undefined && points !== oldPoints) {
        await Exam.findByIdAndUpdate(question.examId, {
          $inc: { totalPoints: points - oldPoints },
        });
      }

      res.json(question);
    } catch (error) {
      console.error('Error updating question:', error);
      res.status(500).json({ error: 'Failed to update question' });
    }
  }
);

// Delete question
router.delete(
  '/:id',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const question = await Question.findById(req.params.id);
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }

      const exam = await Exam.findById(question.examId);
      if (exam && exam.status !== ExamStatus.DRAFT) {
        return res.status(400).json({ error: 'Cannot delete questions from a published exam' });
      }

      // Update exam totals
      await Exam.findByIdAndUpdate(question.examId, {
        $inc: { totalPoints: -question.points, questionCount: -1 },
      });

      await question.deleteOne();

      res.json({ message: 'Question deleted successfully' });
    } catch (error) {
      console.error('Error deleting question:', error);
      res.status(500).json({ error: 'Failed to delete question' });
    }
  }
);

// Reorder questions
router.put(
  '/exam/:examId/reorder',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  [body('questionIds').isArray()],
  async (req: Request, res: Response) => {
    try {
      const { examId } = req.params;
      const { questionIds } = req.body;

      const exam = await Exam.findById(examId);
      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      if (exam.status !== ExamStatus.DRAFT) {
        return res.status(400).json({ error: 'Cannot reorder questions of a published exam' });
      }

      // Update order for each question
      const updates = questionIds.map((id: string, index: number) =>
        Question.findByIdAndUpdate(id, { order: index })
      );

      await Promise.all(updates);

      const questions = await Question.find({ examId }).sort({ order: 1 });
      res.json(questions);
    } catch (error) {
      console.error('Error reordering questions:', error);
      res.status(500).json({ error: 'Failed to reorder questions' });
    }
  }
);

// Bulk create questions (import)
router.post(
  '/exam/:examId/bulk',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  [body('questions').isArray()],
  async (req: Request, res: Response) => {
    try {
      const { examId } = req.params;
      const { questions } = req.body;

      const exam = await Exam.findById(examId);
      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      if (exam.status !== ExamStatus.DRAFT) {
        return res.status(400).json({ error: 'Cannot add questions to a published exam' });
      }

      // Get current max order
      const lastQuestion = await Question.findOne({ examId }).sort({ order: -1 });
      let currentOrder = lastQuestion ? lastQuestion.order + 1 : 0;

      let totalNewPoints = 0;

      const questionsToCreate = questions.map((q: any) => {
        totalNewPoints += q.points || 1;
        return {
          ...q,
          examId,
          order: currentOrder++,
        };
      });

      const createdQuestions = await Question.insertMany(questionsToCreate);

      // Update exam totals
      await Exam.findByIdAndUpdate(examId, {
        $inc: { totalPoints: totalNewPoints, questionCount: questions.length },
      });

      res.status(201).json(createdQuestions);
    } catch (error) {
      console.error('Error bulk creating questions:', error);
      res.status(500).json({ error: 'Failed to create questions' });
    }
  }
);

export default router;
