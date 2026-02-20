import cron from 'node-cron';
import mongoose from 'mongoose';
import { ExamSubmission, SubmissionStatus } from '../models/ExamSubmission';
import { Exam, ExamStatus } from '../models/Exam';
import { Question, QuestionType } from '../models/Question';
import { Notification, NotificationType } from '../models/Notification';
import logger from '../utils/logger';

/**
 * Exam Scheduler Job
 * Handles:
 * 1. Auto-submit expired exam attempts
 * 2. Update exam status based on schedule
 * 3. Send reminder notifications
 */

// Auto-submit expired exams - runs every minute
export const startExamTimerJob = () => {
  cron.schedule('* * * * *', async () => {
    try {
      await autoSubmitExpiredExams();
    } catch (error) {
      logger.error('Error in exam timer job:', error);
    }
  });

  logger.info('Exam timer background job started');
};

// Update exam statuses based on schedule - runs every 5 minutes
export const startExamStatusJob = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      await updateExamStatuses();
    } catch (error) {
      logger.error('Error in exam status job:', error);
    }
  });

  logger.info('Exam status update job started');
};

// Send exam reminders - runs every hour
export const startExamReminderJob = () => {
  cron.schedule('0 * * * *', async () => {
    try {
      await sendExamReminders();
    } catch (error) {
      logger.error('Error in exam reminder job:', error);
    }
  });

  logger.info('Exam reminder job started');
};

/**
 * Auto-submit exams that have exceeded their time limit
 */
async function autoSubmitExpiredExams() {
  const now = new Date();

  // Find all in-progress submissions where time has expired
  const expiredSubmissions = await ExamSubmission.find({
    status: SubmissionStatus.IN_PROGRESS,
    timeExpiry: { $lt: now },
  }).populate('examId');

  if (expiredSubmissions.length === 0) return;

  logger.info(`Found ${expiredSubmissions.length} expired exam submissions to auto-submit`);

  for (const submission of expiredSubmissions) {
    try {
      const exam = submission.examId as any;
      
      // Check if auto-submit is enabled
      if (!exam?.settings?.autoSubmitOnTimeExpire) {
        // Just mark as expired without submitting
        submission.status = SubmissionStatus.SUBMITTED;
        submission.submittedAt = now;
        await submission.save();
        continue;
      }

      // Get questions for auto-grading
      const questions = await Question.find({ examId: exam._id });
      const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

      let totalScore = 0;
      let hasEssayQuestions = false;

      // Auto-grade each answer
      for (const answer of submission.answers) {
        const question = questionMap.get(answer.questionId.toString());
        if (!question) continue;

        let isCorrect: boolean | undefined;
        let pointsEarned = 0;

        switch (question.type) {
          case QuestionType.MULTIPLE_CHOICE:
            if (answer.selectedChoiceId && question.choices) {
              const selectedChoice = question.choices.find(
                (c: any) => c._id.toString() === answer.selectedChoiceId?.toString()
              );
              isCorrect = selectedChoice?.isCorrect === true;
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
              
              isCorrect = question.acceptedAnswers.some(accepted => {
                const acceptedAnswer = question.caseSensitive
                  ? accepted.trim()
                  : accepted.trim().toLowerCase();
                return userAnswer === acceptedAnswer;
              });
              pointsEarned = isCorrect ? question.points : 0;
            }
            break;

          case QuestionType.ESSAY:
            hasEssayQuestions = true;
            isCorrect = undefined as any;
            pointsEarned = 0;
            break;
        }

        answer.isCorrect = isCorrect;
        answer.pointsEarned = pointsEarned;
        totalScore += pointsEarned;
      }

      // Update submission
      submission.totalScore = totalScore;
      submission.percentage = exam.totalPoints > 0
        ? Math.round((totalScore / exam.totalPoints) * 100)
        : 0;
      submission.isPassing = submission.percentage >= exam.settings.passingPercentage;
      submission.submittedAt = now;
      submission.status = hasEssayQuestions
        ? SubmissionStatus.SUBMITTED
        : SubmissionStatus.GRADED;

      submission.markModified('answers');
      await submission.save();

      // Notify student
      await Notification.create({
        userId: submission.studentId,
        type: NotificationType.SYSTEM,
        title: 'Exam Auto-Submitted',
        message: `Your exam "${exam.title}" has been automatically submitted due to time expiration.`,
        data: { examId: exam._id, submissionId: submission._id },
      });

      // Notify teacher if manual grading needed
      if (hasEssayQuestions) {
        await Notification.create({
          userId: exam.createdById,
          type: NotificationType.SYSTEM,
          title: 'Auto-Submitted Exam Requires Grading',
          message: `An exam "${exam.title}" was auto-submitted and requires manual grading.`,
          data: { examId: exam._id, submissionId: submission._id },
        });
      }

      logger.info(`Auto-submitted exam submission ${submission._id}`);
    } catch (error) {
      logger.error(`Error auto-submitting submission ${submission._id}:`, error);
    }
  }
}

/**
 * Update exam statuses based on start/end dates
 */
async function updateExamStatuses() {
  const now = new Date();

  // Activate published exams that have reached their start date
  const toActivate = await Exam.updateMany(
    {
      status: ExamStatus.PUBLISHED,
      startDate: { $lte: now },
      $or: [
        { endDate: { $gt: now } },
        { endDate: null },
      ],
    },
    { $set: { status: ExamStatus.ACTIVE } }
  );

  if (toActivate.modifiedCount > 0) {
    logger.info(`Activated ${toActivate.modifiedCount} exams`);
  }

  // Close active exams that have passed their end date
  const toClose = await Exam.updateMany(
    {
      status: ExamStatus.ACTIVE,
      endDate: { $lt: now },
    },
    { $set: { status: ExamStatus.CLOSED } }
  );

  if (toClose.modifiedCount > 0) {
    logger.info(`Closed ${toClose.modifiedCount} exams`);
  }
}

/**
 * Send reminder notifications for upcoming exams
 */
async function sendExamReminders() {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Find exams starting in the next hour
  const hourlyReminders = await Exam.find({
    status: ExamStatus.PUBLISHED,
    startDate: { $gte: now, $lte: oneHourFromNow },
  }).populate({
    path: 'courseId',
    populate: {
      path: 'enrollments',
      match: { status: 'ACTIVE' },
      select: 'studentId',
    },
  });

  // Find exams starting in the next day (but not in the next hour)
  const dailyReminders = await Exam.find({
    status: ExamStatus.PUBLISHED,
    startDate: { $gt: oneHourFromNow, $lte: oneDayFromNow },
  }).populate({
    path: 'courseId',
    populate: {
      path: 'enrollments',
      match: { status: 'ACTIVE' },
      select: 'studentId',
    },
  });

  // Send hourly reminders
  for (const exam of hourlyReminders) {
    const enrollments = (exam.courseId as any)?.enrollments || [];
    for (const enrollment of enrollments) {
      await Notification.create({
        userId: enrollment.studentId,
        type: NotificationType.EXAM_REMINDER,
        title: 'Exam Starting Soon',
        message: `"${exam.title}" starts in less than an hour!`,
        data: { examId: exam._id },
      });
    }
  }

  // Send daily reminders
  for (const exam of dailyReminders) {
    const enrollments = (exam.courseId as any)?.enrollments || [];
    for (const enrollment of enrollments) {
      await Notification.create({
        userId: enrollment.studentId,
        type: NotificationType.EXAM_REMINDER,
        title: 'Upcoming Exam Tomorrow',
        message: `Don't forget: "${exam.title}" starts tomorrow!`,
        data: { examId: exam._id },
      });
    }
  }

  const totalReminders = hourlyReminders.length + dailyReminders.length;
  if (totalReminders > 0) {
    logger.info(`Sent reminders for ${totalReminders} upcoming exams`);
  }
}

/**
 * Initialize all background jobs
 */
export function initializeExamJobs() {
  startExamTimerJob();
  startExamStatusJob();
  startExamReminderJob();
  logger.info('All exam background jobs initialized');
}

export default {
  initializeExamJobs,
  startExamTimerJob,
  startExamStatusJob,
  startExamReminderJob,
};
