import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { ExamSubmission, SubmissionStatus, Exam, ExamStatus, Question, QuestionType, Enrollment, Notification, NotificationType } from '../models';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '../models/User';
import mongoose from 'mongoose';
import logger from '../utils/logger';

const router = Router();

// Start an exam (student)
router.post(
  '/start/:examId',
  authenticate,
  authorize(Role.STUDENT),
  async (req: Request, res: Response) => {
    try {
      const { examId } = req.params;
      const studentId = req.user!.id;

      const exam = await Exam.findById(examId);
      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      // Check exam is active
      if (exam.status !== ExamStatus.ACTIVE) {
        return res.status(400).json({ error: 'Exam is not currently available' });
      }

      // Check time window
      const now = new Date();
      if (exam.startDate && now < exam.startDate) {
        return res.status(400).json({ error: 'Exam has not started yet' });
      }
      if (exam.endDate && now > exam.endDate && !exam.settings.lateSubmissionAllowed) {
        return res.status(400).json({ error: 'Exam deadline has passed' });
      }

      // Check student is enrolled in course
      const enrollment = await Enrollment.findOne({
        courseId: exam.courseId,
        studentId: new mongoose.Types.ObjectId(studentId),
        isActive: true,
      });
      if (!enrollment) {
        return res.status(403).json({ error: 'You are not enrolled in this course' });
      }

      // Check attempt limit
      const existingAttempts = await ExamSubmission.countDocuments({
        examId: new mongoose.Types.ObjectId(examId),
        studentId: new mongoose.Types.ObjectId(studentId),
      });
      if (existingAttempts >= exam.settings.maxAttempts) {
        return res.status(400).json({ error: 'Maximum attempts reached' });
      }

      // Check for in-progress submission
      const inProgress = await ExamSubmission.findOne({
        examId: new mongoose.Types.ObjectId(examId),
        studentId: new mongoose.Types.ObjectId(studentId),
        status: SubmissionStatus.IN_PROGRESS,
      });
      if (inProgress) {
        // Return existing in-progress submission
        return res.json(inProgress);
      }

      // Safely determine next attempt number
      const lastSubmission = await ExamSubmission.findOne({
        examId: new mongoose.Types.ObjectId(examId),
        studentId: new mongoose.Types.ObjectId(studentId),
      }).sort({ attemptNumber: -1 });

      const attemptNumber = lastSubmission ? lastSubmission.attemptNumber + 1 : 1;

      // Create new submission
      const submission = new ExamSubmission({
        examId: new mongoose.Types.ObjectId(examId),
        studentId: new mongoose.Types.ObjectId(studentId),
        status: SubmissionStatus.IN_PROGRESS,
        attemptNumber,
        startedAt: new Date(),
        maxScore: exam.totalPoints,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      await submission.save();

      res.status(201).json(submission);
    } catch (error) {
      logger.error('Error starting exam:', error);
      res.status(500).json({ error: 'Failed to start exam' });
    }
  }
);


// Save answer (auto-save during exam)
router.put(
  '/:submissionId/answer',
  authenticate,
  authorize(Role.STUDENT),
  async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const { questionId, selectedChoiceId, booleanAnswer, textAnswer, matchingAnswers } = req.body;
      const studentId = req.user!.id;

      const submission = await ExamSubmission.findById(submissionId);
      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      if (submission.studentId.toString() !== studentId) {
        return res.status(403).json({ error: 'Not your submission' });
      }

      if (submission.status !== SubmissionStatus.IN_PROGRESS) {
        return res.status(400).json({ error: 'Submission already submitted' });
      }

      // Find existing answer or create new
      const existingAnswerIndex = submission.answers.findIndex(
        (a) => a.questionId.toString() === questionId
      );

      if (existingAnswerIndex >= 0) {
        // Update existing answer
        const existingAnswer = submission.answers[existingAnswerIndex];
        if (selectedChoiceId !== undefined) {
          existingAnswer.selectedChoiceId = selectedChoiceId ? new mongoose.Types.ObjectId(selectedChoiceId) : undefined;
        }
        if (booleanAnswer !== undefined) {
          existingAnswer.booleanAnswer = booleanAnswer;
        }
        if (textAnswer !== undefined) {
          existingAnswer.textAnswer = textAnswer;
        }
        if (matchingAnswers !== undefined) {
          existingAnswer.matchingAnswers = matchingAnswers;
        }
      } else {
        // Create new answer
        submission.answers.push({
          questionId: new mongoose.Types.ObjectId(questionId),
          selectedChoiceId: selectedChoiceId ? new mongoose.Types.ObjectId(selectedChoiceId) : undefined,
          booleanAnswer,
          textAnswer,
          matchingAnswers,
          pointsEarned: 0,
        } as any);
      }

      submission.markModified('answers');

      await submission.save();

      res.json({ message: 'Answer saved' });
    } catch (error) {
      logger.error('Error saving answer:', error);
      res.status(500).json({ error: 'Failed to save answer' });
    }
  }
);

// Submit exam
router.post(
  '/:submissionId/submit',
  authenticate,
  authorize(Role.STUDENT),
  async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const studentId = req.user!.id;

      const submission = await ExamSubmission.findById(submissionId);
      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      if (submission.studentId.toString() !== studentId) {
        return res.status(403).json({ error: 'Not your submission' });
      }

      if (submission.status !== SubmissionStatus.IN_PROGRESS) {
        return res.status(400).json({ error: 'Already submitted' });
      }

      const exam = await Exam.findById(submission.examId);
      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      // Auto-grade objective questions
      const questions = await Question.find({ examId: submission.examId });
      let totalScore = 0;
      let hasEssayQuestions = false;

      for (const answer of submission.answers) {
        const question = questions.find(
          (q) => q._id.toString() === answer.questionId.toString()
        );

        if (!question) continue;

        let isCorrect = false;
        let pointsEarned = 0;

        switch (question.type) {
          case QuestionType.MULTIPLE_CHOICE:
            if (answer.selectedChoiceId && question.choices) {
              const selectedChoice = question.choices.find(
                (c) => c._id?.toString() === answer.selectedChoiceId?.toString()
              );
              isCorrect = selectedChoice?.isCorrect || false;
              pointsEarned = isCorrect ? question.points : 0;
            }
            break;

          case QuestionType.TRUE_FALSE:
            isCorrect = answer.booleanAnswer === question.correctAnswer;
            pointsEarned = isCorrect ? question.points : 0;
            break;

          case QuestionType.SHORT_ANSWER:
          case QuestionType.FILL_IN_BLANK:
            if (answer.textAnswer && question.acceptedAnswers) {
              const userAnswer = question.caseSensitive
                ? answer.textAnswer.trim()
                : answer.textAnswer.trim().toLowerCase();
              
              isCorrect = question.acceptedAnswers.some((accepted) => {
                const acceptedAnswer = question.caseSensitive
                  ? accepted.trim()
                  : accepted.trim().toLowerCase();
                return userAnswer === acceptedAnswer;
              });
              pointsEarned = isCorrect ? question.points : 0;
            }
            break;

          case QuestionType.MATCHING:
            if (answer.matchingAnswers && question.matchingPairs) {
              let correctCount = 0;
              for (const match of answer.matchingAnswers) {
                const pair = question.matchingPairs.find(
                  (p) => p._id?.toString() === match.leftId
                );
                if (pair && pair._id?.toString() === match.rightId) {
                  correctCount++;
                }
              }
              const matchingRatio = correctCount / question.matchingPairs.length;
              pointsEarned = Math.round(question.points * matchingRatio);
              isCorrect = matchingRatio === 1;
            }
            break;

          case QuestionType.ESSAY:
            // Essay requires manual grading
            hasEssayQuestions = true;
            isCorrect = undefined as any;
            pointsEarned = 0;
            break;
        }

        answer.isCorrect = isCorrect;
        answer.pointsEarned = pointsEarned;
        totalScore += pointsEarned;
      }

      // Check for late submission penalty
      const now = new Date();
      if (exam.endDate && now > exam.endDate && exam.settings.lateSubmissionAllowed) {
        const penalty = exam.settings.lateSubmissionPenalty || 0;
        totalScore = Math.round(totalScore * (1 - penalty / 100));
      }

      submission.totalScore = totalScore;
      submission.percentage = exam.totalPoints > 0 
        ? Math.round((totalScore / exam.totalPoints) * 100) 
        : 0;
      submission.isPassing = submission.percentage >= exam.settings.passingPercentage;
      submission.submittedAt = now;
      submission.status = hasEssayQuestions 
        ? SubmissionStatus.SUBMITTED 
        : SubmissionStatus.GRADED;

      await submission.save();

      // Create notification for faculty if has essay questions
      if (hasEssayQuestions) {
        await Notification.create({
          userId: exam.createdById,
          type: NotificationType.SYSTEM,
          title: 'Exam Submission Requires Grading',
          message: `A student has submitted "${exam.title}" and requires manual grading.`,
          data: { examId: exam._id, submissionId: submission._id },
        });
      }

      res.json(submission);
    } catch (error) {
      logger.error('Error submitting exam:', error);
      res.status(500).json({ error: 'Failed to submit exam' });
    }
  }
);

// Get submission (student sees their own, faculty sees all)
router.get(
  '/:submissionId',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const user = req.user!;

      const submission = await ExamSubmission.findById(submissionId)
        .populate('studentId', 'firstName lastName email studentNumber')
        .populate('examId');

      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      // Check access
      if (user.role === Role.STUDENT) {
        if (submission.studentId._id.toString() !== user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      // Get exam for settings check
      const exam = await Exam.findById(submission.examId);

      // If student and exam settings don't allow review
      if (user.role === Role.STUDENT && exam && !exam.settings.allowReview) {
        if (submission.status !== SubmissionStatus.RETURNED) {
          return res.status(403).json({ error: 'Results not yet available' });
        }
      }

      // Get questions for this submission
      const questions = await Question.find({ examId: submission.examId }).sort({ order: 1 });

      // For students, respect exam settings on what to show
      if (user.role === Role.STUDENT && exam) {
        const response: any = submission.toObject();
        
        if (!exam.settings.showCorrectAnswers) {
          // Don't show correct answers
          questions.forEach((q: any) => {
            if (q.choices) {
              q.choices = q.choices.map((c: any) => ({
                _id: c._id,
                text: c.text,
              }));
            }
            delete q.correctAnswer;
            delete q.acceptedAnswers;
          });
        }

        if (!exam.settings.showFeedback) {
          response.answers = response.answers.map((a: any) => ({
            ...a,
            feedback: undefined,
            explanation: undefined,
          }));
        }

        return res.json({ submission: response, questions });
      }

      res.json({ submission, questions });
    } catch (error) {
      logger.error('Error fetching submission:', error);
      res.status(500).json({ error: 'Failed to fetch submission' });
    }
  }
);

// Get all submissions for an exam (faculty/admin)
router.get(
  '/exam/:examId/all',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const { examId } = req.params;

      const submissions = await ExamSubmission.find({ examId: new mongoose.Types.ObjectId(examId) })
        .populate('studentId', 'firstName lastName email studentNumber section')
        .sort({ submittedAt: -1 });

      res.json(submissions);
    } catch (error) {
      logger.error('Error fetching submissions:', error);
      res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  }
);

// Get student's submissions (their history)
router.get(
  '/student/my-submissions',
  authenticate,
  authorize(Role.STUDENT),
  async (req: Request, res: Response) => {
    try {
      const studentId = req.user!.id;

      const submissions = await ExamSubmission.find({ studentId: new mongoose.Types.ObjectId(studentId) })
        .populate({
          path: 'examId',
          select: 'title type courseId settings',
          populate: { path: 'courseId', select: 'code name' },
        })
        .sort({ submittedAt: -1 });

      res.json(submissions);
    } catch (error) {
      logger.error('Error fetching submissions:', error);
      res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  }
);

// Grade answer (faculty) - FIXED VERSION
router.put(
  '/:submissionId/grade/:questionId',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const { submissionId, questionId } = req.params;
      const { pointsEarned, feedback } = req.body;
      const graderId = req.user!.id;

      logger.info(`Grading attempt - Submission: ${submissionId}, Question: ${questionId}, Points: ${pointsEarned}`);

      // Validate input
      if (pointsEarned === undefined || pointsEarned === null) {
        return res.status(400).json({ error: 'Points earned is required' });
      }

      const submission = await ExamSubmission.findById(submissionId);
      if (!submission) {
        logger.error(`Submission not found: ${submissionId}`);
        return res.status(404).json({ error: 'Submission not found' });
      }

      const question = await Question.findById(questionId);
      if (!question) {
        logger.error(`Question not found: ${questionId}`);
        return res.status(404).json({ error: 'Question not found' });
      }

      // Find the answer
      const answerIndex = submission.answers.findIndex(
        (a) => a.questionId.toString() === questionId
      );

      if (answerIndex < 0) {
        logger.error(`Answer not found for question: ${questionId}`);
        return res.status(404).json({ error: 'Answer not found' });
      }

      const oldPoints = submission.answers[answerIndex].pointsEarned || 0;
      
      // Cap points at question max
      const cappedPoints = Math.min(Math.max(0, pointsEarned), question.points);
      
      // Update the answer
      submission.answers[answerIndex].pointsEarned = cappedPoints;
      submission.answers[answerIndex].feedback = feedback || '';
      submission.answers[answerIndex].gradedAt = new Date();
      submission.answers[answerIndex].gradedById = new mongoose.Types.ObjectId(graderId);

      // Update total score
      submission.totalScore = submission.totalScore - oldPoints + cappedPoints;
      
      // Recalculate percentage
      const exam = await Exam.findById(submission.examId);
      if (exam) {
        submission.percentage = exam.totalPoints > 0
          ? Math.round((submission.totalScore / exam.totalPoints) * 100)
          : 0;
        submission.isPassing = submission.percentage >= exam.settings.passingPercentage;
      }

      // Check if all questions are graded
      const allGraded = submission.answers.every((a) => a.gradedAt || a.isCorrect !== undefined);
      if (allGraded && submission.status === SubmissionStatus.SUBMITTED) {
        submission.status = SubmissionStatus.GRADED;
      }

      // Mark as modified to ensure Mongoose saves it
      submission.markModified('answers');
      submission.markModified('totalScore');
      submission.markModified('percentage');
      submission.markModified('status');

      await submission.save();

      logger.info(`Successfully graded - New score: ${submission.totalScore}, Status: ${submission.status}`);

      res.json(submission);
    } catch (error) {
      logger.error('Error grading answer:', error);
      res.status(500).json({ error: 'Failed to grade answer', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
);

// Return graded exam to student - FIXED VERSION
router.post(
  '/:submissionId/return',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const { overallFeedback } = req.body;

      logger.info(`Returning submission: ${submissionId}`);

      const submission = await ExamSubmission.findById(submissionId)
        .populate('studentId', 'firstName lastName email');

      if (!submission) {
        logger.error(`Submission not found: ${submissionId}`);
        return res.status(404).json({ error: 'Submission not found' });
      }

      // Update status
      submission.status = SubmissionStatus.RETURNED;
      if (overallFeedback) {
        submission.overallFeedback = overallFeedback;
      }

      // Mark as modified
      submission.markModified('status');
      submission.markModified('overallFeedback');

      await submission.save();

      logger.info(`Successfully returned submission: ${submissionId}, Status: ${submission.status}`);

      // Notify student
      const exam = await Exam.findById(submission.examId);
      await Notification.create({
        userId: submission.studentId._id,
        type: NotificationType.RESULT_PUBLISHED,
        title: 'Exam Results Available',
        message: `Your results for "${exam?.title}" are now available.`,
        data: { submissionId: submission._id, examId: exam?._id },
      });

      res.json(submission);
    } catch (error) {
      logger.error('Error returning submission:', error);
      res.status(500).json({ error: 'Failed to return submission', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
);

// Bulk return all graded submissions
router.post(
  '/exam/:examId/return-all',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const { examId } = req.params;

      logger.info(`Bulk returning submissions for exam: ${examId}`);

      const result = await ExamSubmission.updateMany(
        { examId: new mongoose.Types.ObjectId(examId), status: SubmissionStatus.GRADED },
        { $set: { status: SubmissionStatus.RETURNED } }
      );

      logger.info(`Bulk return result: ${result.modifiedCount} submissions updated`);

      // Get all affected submissions and notify students
      const submissions = await ExamSubmission.find({ 
        examId: new mongoose.Types.ObjectId(examId), 
        status: SubmissionStatus.RETURNED 
      });
      
      const exam = await Exam.findById(examId);

      for (const submission of submissions) {
        await Notification.create({
          userId: submission.studentId,
          type: NotificationType.RESULT_PUBLISHED,
          title: 'Exam Results Available',
          message: `Your results for "${exam?.title}" are now available.`,
          data: { submissionId: submission._id, examId: exam?._id },
        });
      }

      res.json({ 
        success: true,
        message: `${result.modifiedCount} submissions returned`,
        count: result.modifiedCount 
      });
    } catch (error) {
      logger.error('Error returning submissions:', error);
      res.status(500).json({ error: 'Failed to return submissions', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
);

export default router;