import { ExamSubmission, SubmissionStatus, Exam, Question, QuestionType, Notification } from '../models';
import logger from '../utils/logger';
import wsService from '../services/websocket';

export async function checkExpiredExamSubmissions() {
  try {
    const now = new Date();
    
    const expiredSubmissions = await ExamSubmission.find({
      status: SubmissionStatus.IN_PROGRESS,
      timeExpiry: { $lte: now },
    }).populate('examId').populate('studentId', 'firstName lastName email');

    if (expiredSubmissions.length === 0) return;

    logger.info(`Found ${expiredSubmissions.length} expired submissions to auto-submit`);

    for (const submission of expiredSubmissions) {
      try {
        await autoSubmitExpiredSubmission(submission);
        
        wsService.sendToUser(
          submission.studentId._id.toString(),
          'exam:auto-submitted',
          {
            submissionId: submission._id,
            examId: submission.examId,
            message: 'Your exam time has expired and was automatically submitted',
          }
        );
      } catch (error) {
        logger.error(`Failed to auto-submit submission ${submission._id}:`, error);
      }
    }

    logger.info(`Successfully auto-submitted ${expiredSubmissions.length} expired submissions`);
  } catch (error) {
    logger.error('Error in checkExpiredExamSubmissions job:', error);
  }
}

async function autoSubmitExpiredSubmission(submission: any) {
  const exam = await Exam.findById(submission.examId);
  if (!exam) throw new Error('Exam not found');

  const questions = await Question.find({ examId: submission.examId });
  let totalScore = 0;
  let hasEssayQuestions = false;

  for (const answer of submission.answers) {
    const question = questions.find(q => q._id.toString() === answer.questionId.toString());
    if (!question) continue;

    let isCorrect = false;
    let pointsEarned = 0;

    switch (question.type) {
      case QuestionType.MULTIPLE_CHOICE:
        if (answer.selectedChoiceId && question.choices) {
          const selectedChoice = question.choices.find(
            c => c._id?.toString() === answer.selectedChoiceId?.toString()
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
        break;
    }

    answer.isCorrect = isCorrect;
    answer.pointsEarned = pointsEarned;
    totalScore += pointsEarned;
  }

  submission.totalScore = totalScore;
  submission.percentage = exam.totalPoints > 0 
    ? Math.round((totalScore / exam.totalPoints) * 100) 
    : 0;
  submission.isPassing = submission.percentage >= exam.settings.passingPercentage;
  submission.submittedAt = new Date();
  submission.status = SubmissionStatus.AUTO_SUBMITTED;

  await submission.save();

  await Notification.create({
    userId: exam.createdById,
    type: 'EXAM',
    title: 'Exam Auto-Submitted',
    message: `A student's submission for "${exam.title}" was auto-submitted due to time expiry.`,
    data: { submissionId: submission._id, examId: exam._id, studentId: submission.studentId },
  });

  logger.info(`Auto-submitted exam submission ${submission._id}`);
}

export async function sendTimerWarnings() {
  try {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    const sixMinutesFromNow = new Date(now.getTime() + 6 * 60 * 1000);

    const expiringSubmissions = await ExamSubmission.find({
      status: SubmissionStatus.IN_PROGRESS,
      timeExpiry: { $gte: fiveMinutesFromNow, $lt: sixMinutesFromNow },
    }).populate('examId', 'title settings');

    for (const submission of expiringSubmissions) {
      const exam = submission.examId as any;
      
      if (exam.settings?.showTimerWarning) {
        wsService.sendToUser(
          submission.studentId.toString(),
          'exam:timer-warning',
          {
            submissionId: submission._id,
            examTitle: exam.title,
            remainingMinutes: 5,
            message: 'You have 5 minutes remaining!',
          }
        );
      }
    }

    if (expiringSubmissions.length > 0) {
      logger.info(`Sent timer warnings to ${expiringSubmissions.length} students`);
    }
  } catch (error) {
    logger.error('Error in sendTimerWarnings job:', error);
  }
}