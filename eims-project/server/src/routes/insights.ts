import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, authorize } from '../middleware/auth';
import { ExamSubmission, SubmissionStatus } from '../models/ExamSubmission';
import { Exam, ExamStatus } from '../models/Exam';
import { Question, QuestionType } from '../models/Question';
import { Enrollment } from '../models/Enrollment';
import { Course } from '../models/Course';
import { Role } from '../models/User';
import logger from '../utils/logger';

const router = express.Router();

// ============================================
// TEACHER INSIGHTS ENDPOINTS
// ============================================

/**
 * Get comprehensive exam-level insights for teachers
 * Includes: average score, passing rate, time taken, score distribution, item analysis
 */
router.get(
  '/exam/:examId',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const { examId } = req.params;

      const exam = await Exam.findById(examId);
      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      // Get all completed submissions
      const submissions = await ExamSubmission.find({
        examId: new mongoose.Types.ObjectId(examId),
        status: { $in: [SubmissionStatus.SUBMITTED, SubmissionStatus.GRADED, SubmissionStatus.RETURNED] },
      }).populate('studentId', 'firstName lastName email studentNumber section');

      if (submissions.length === 0) {
        return res.json({
          examId,
          examTitle: exam.title,
          totalSubmissions: 0,
          metrics: null,
          distribution: null,
          itemAnalysis: null,
          message: 'No submissions yet',
        });
      }

      // Calculate exam-level metrics
      const metrics = calculateExamMetrics(submissions, exam);
      
      // Calculate score distribution
      const distribution = calculateScoreDistribution(submissions);
      
      // Calculate percentiles
      const percentiles = calculatePercentiles(submissions);

      // Get questions for item analysis
      const questions = await Question.find({ examId: exam._id }).sort({ order: 1 });
      
      // Calculate item analysis for each question
      const itemAnalysis = await calculateItemAnalysis(submissions, questions);

      res.json({
        examId,
        examTitle: exam.title,
        courseInfo: exam.courseId,
        totalSubmissions: submissions.length,
        metrics,
        distribution,
        percentiles,
        itemAnalysis,
      });
    } catch (error) {
      logger.error('Error getting exam insights:', error);
      res.status(500).json({ error: 'Failed to get exam insights' });
    }
  }
);

/**
 * Get course-level insights for teachers
 */
router.get(
  '/course/:courseId',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const { courseId } = req.params;

      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      // Get all exams for this course
      const exams = await Exam.find({ courseId: new mongoose.Types.ObjectId(courseId) });
      
      // Get enrollment count
      const enrollmentCount = await Enrollment.countDocuments({
        courseId: new mongoose.Types.ObjectId(courseId),
        status: 'ACTIVE',
      });

      // Aggregate submissions across all exams
      const examIds = exams.map(e => e._id);
      const submissions = await ExamSubmission.find({
        examId: { $in: examIds },
        status: { $in: [SubmissionStatus.SUBMITTED, SubmissionStatus.GRADED, SubmissionStatus.RETURNED] },
      });

      // Calculate course-level metrics
      const coursePassingRate = submissions.length > 0
        ? Math.round((submissions.filter(s => s.isPassing).length / submissions.length) * 100)
        : 0;

      const averageCourseGrade = submissions.length > 0
        ? Math.round(submissions.reduce((sum, s) => sum + s.percentage, 0) / submissions.length)
        : 0;

      // Calculate per-exam comparison
      const examComparison = await Promise.all(
        exams.map(async (exam) => {
          const examSubmissions = submissions.filter(
            s => s.examId.toString() === exam._id.toString()
          );
          
          return {
            examId: exam._id,
            examTitle: exam.title,
            examType: exam.type,
            submissionCount: examSubmissions.length,
            averageScore: examSubmissions.length > 0
              ? Math.round(examSubmissions.reduce((sum, s) => sum + s.percentage, 0) / examSubmissions.length)
              : 0,
            passingRate: examSubmissions.length > 0
              ? Math.round((examSubmissions.filter(s => s.isPassing).length / examSubmissions.length) * 100)
              : 0,
          };
        })
      );

      // Grade distribution across course
      const gradeDistribution = calculateGradeDistribution(submissions);

      res.json({
        courseId,
        courseName: course.name,
        courseCode: course.code,
        enrollmentCount,
        totalExams: exams.length,
        totalSubmissions: submissions.length,
        coursePassingRate,
        averageCourseGrade,
        examComparison,
        gradeDistribution,
      });
    } catch (error) {
      logger.error('Error getting course insights:', error);
      res.status(500).json({ error: 'Failed to get course insights' });
    }
  }
);

/**
 * Get detailed item analysis for a specific question
 */
router.get(
  '/exam/:examId/question/:questionId',
  authenticate,
  authorize(Role.ADMIN, Role.FACULTY),
  async (req: Request, res: Response) => {
    try {
      const { examId, questionId } = req.params;

      const question = await Question.findById(questionId);
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }

      const submissions = await ExamSubmission.find({
        examId: new mongoose.Types.ObjectId(examId),
        status: { $in: [SubmissionStatus.SUBMITTED, SubmissionStatus.GRADED, SubmissionStatus.RETURNED] },
      });

      // Get all answers for this question
      const answers = submissions.map(s => {
        const answer = s.answers.find(a => a.questionId.toString() === questionId);
        return {
          answer,
          totalScore: s.percentage,
          isPassing: s.isPassing,
        };
      }).filter(a => a.answer);

      // Calculate detailed choice analysis for multiple choice
      let choiceAnalysis = null;
      if (question.type === QuestionType.MULTIPLE_CHOICE && question.choices) {
        choiceAnalysis = question.choices.map(choice => {
          const selectedCount = answers.filter(
            a => a.answer?.selectedChoiceId?.toString() === choice._id?.toString()
          ).length;
          
          return {
            choiceId: choice._id,
            choiceText: choice.text,
            isCorrect: choice.isCorrect,
            selectedCount,
            selectedPercentage: answers.length > 0
              ? Math.round((selectedCount / answers.length) * 100)
              : 0,
          };
        });
      }

      // Calculate difficulty and discrimination
      const correctCount = answers.filter(a => a.answer?.isCorrect).length;
      const difficultyIndex = answers.length > 0 ? correctCount / answers.length : 0;

      // Discrimination index (top 27% vs bottom 27%)
      const sortedByScore = [...answers].sort((a, b) => b.totalScore - a.totalScore);
      const topGroupSize = Math.ceil(answers.length * 0.27);
      const topGroup = sortedByScore.slice(0, topGroupSize);
      const bottomGroup = sortedByScore.slice(-topGroupSize);

      const topCorrect = topGroup.filter(a => a.answer?.isCorrect).length / topGroup.length || 0;
      const bottomCorrect = bottomGroup.filter(a => a.answer?.isCorrect).length / bottomGroup.length || 0;
      const discriminationIndex = topCorrect - bottomCorrect;

      // Calculate point-biserial correlation
      const pointBiserial = calculatePointBiserial(answers);

      // Skip rate
      const skipCount = submissions.length - answers.length;
      const skipRate = submissions.length > 0
        ? Math.round((skipCount / submissions.length) * 100)
        : 0;

      res.json({
        questionId,
        questionText: question.questionText,
        questionType: question.type,
        points: question.points,
        totalResponses: answers.length,
        correctCount,
        difficultyIndex: Math.round(difficultyIndex * 100) / 100,
        difficultyLabel: getDifficultyLabel(difficultyIndex),
        discriminationIndex: Math.round(discriminationIndex * 100) / 100,
        discriminationLabel: getDiscriminationLabel(discriminationIndex),
        pointBiserial: Math.round(pointBiserial * 100) / 100,
        skipRate,
        choiceAnalysis,
      });
    } catch (error) {
      logger.error('Error getting question analysis:', error);
      res.status(500).json({ error: 'Failed to get question analysis' });
    }
  }
);

// ============================================
// STUDENT INSIGHTS ENDPOINTS
// ============================================

/**
 * Get student's personal performance insights
 */
router.get(
  '/student/performance',
  authenticate,
  authorize(Role.STUDENT),
  async (req: Request, res: Response) => {
    try {
      const studentId = req.user!.id;

      // Get all submissions for this student
      const submissions = await ExamSubmission.find({
        studentId: new mongoose.Types.ObjectId(studentId),
        status: { $in: [SubmissionStatus.GRADED, SubmissionStatus.RETURNED] },
      })
        .populate({
          path: 'examId',
          select: 'title type courseId totalPoints',
          populate: { path: 'courseId', select: 'code name' },
        })
        .sort({ submittedAt: -1 });

      if (submissions.length === 0) {
        return res.json({
          studentId,
          totalExamsTaken: 0,
          scoreHistory: [],
          coursePerformance: [],
          message: 'No completed exams yet',
        });
      }

      // Score history for trend visualization
      const scoreHistory = submissions.map(s => ({
        examId: (s.examId as any)._id,
        examTitle: (s.examId as any).title,
        examType: (s.examId as any).type,
        courseCode: (s.examId as any).courseId?.code,
        score: s.percentage,
        isPassing: s.isPassing,
        submittedAt: s.submittedAt,
      }));

      // Group by course for course-level performance
      const courseMap = new Map();
      submissions.forEach(s => {
        const courseId = (s.examId as any).courseId?._id?.toString();
        if (!courseId) return;
        
        if (!courseMap.has(courseId)) {
          courseMap.set(courseId, {
            courseId,
            courseCode: (s.examId as any).courseId?.code,
            courseName: (s.examId as any).courseId?.name,
            exams: [],
          });
        }
        courseMap.get(courseId).exams.push({
          examTitle: (s.examId as any).title,
          score: s.percentage,
          isPassing: s.isPassing,
        });
      });

      const coursePerformance = Array.from(courseMap.values()).map(course => ({
        ...course,
        averageScore: Math.round(
          course.exams.reduce((sum: number, e: any) => sum + e.score, 0) / course.exams.length
        ),
        examCount: course.exams.length,
        passingRate: Math.round(
          (course.exams.filter((e: any) => e.isPassing).length / course.exams.length) * 100
        ),
      }));

      // Overall statistics
      const overallStats = {
        totalExamsTaken: submissions.length,
        averageScore: Math.round(
          submissions.reduce((sum, s) => sum + s.percentage, 0) / submissions.length
        ),
        highestScore: Math.max(...submissions.map(s => s.percentage)),
        lowestScore: Math.min(...submissions.map(s => s.percentage)),
        passingRate: Math.round(
          (submissions.filter(s => s.isPassing).length / submissions.length) * 100
        ),
      };

      res.json({
        studentId,
        overallStats,
        scoreHistory,
        coursePerformance,
      });
    } catch (error) {
      logger.error('Error getting student performance:', error);
      res.status(500).json({ error: 'Failed to get student performance' });
    }
  }
);

/**
 * Get student's ranking for a specific exam
 */
router.get(
  '/student/exam/:examId/ranking',
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

      // Get student's submission
      const studentSubmission = await ExamSubmission.findOne({
        examId: new mongoose.Types.ObjectId(examId),
        studentId: new mongoose.Types.ObjectId(studentId),
        status: { $in: [SubmissionStatus.GRADED, SubmissionStatus.RETURNED] },
      });

      if (!studentSubmission) {
        return res.status(404).json({ error: 'No graded submission found' });
      }

      // Get all submissions for ranking calculation
      const allSubmissions = await ExamSubmission.find({
        examId: new mongoose.Types.ObjectId(examId),
        status: { $in: [SubmissionStatus.GRADED, SubmissionStatus.RETURNED] },
      }).sort({ percentage: -1 });

      const totalStudents = allSubmissions.length;
      const studentRank = allSubmissions.findIndex(
        s => s.studentId.toString() === studentId
      ) + 1;

      // Calculate percentile rank
      const percentileRank = Math.round(((totalStudents - studentRank) / totalStudents) * 100);

      // Calculate class average
      const classAverage = Math.round(
        allSubmissions.reduce((sum, s) => sum + s.percentage, 0) / totalStudents
      );

      // Determine if above/below average
      const aboveAverage = studentSubmission.percentage > classAverage;
      const deviationFromAverage = studentSubmission.percentage - classAverage;

      // Determine quartile position
      let quartile: string;
      if (percentileRank >= 75) quartile = 'Top 25%';
      else if (percentileRank >= 50) quartile = 'Upper Middle (50-75%)';
      else if (percentileRank >= 25) quartile = 'Lower Middle (25-50%)';
      else quartile = 'Bottom 25%';

      res.json({
        examId,
        examTitle: exam.title,
        studentScore: studentSubmission.percentage,
        studentRank,
        totalStudents,
        percentileRank,
        classAverage,
        aboveAverage,
        deviationFromAverage,
        quartile,
        isPassing: studentSubmission.isPassing,
        // Privacy: Only show anonymous score distribution, not individual scores
        scoreDistribution: calculateAnonymousDistribution(allSubmissions),
      });
    } catch (error) {
      logger.error('Error getting student ranking:', error);
      res.status(500).json({ error: 'Failed to get student ranking' });
    }
  }
);

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateExamMetrics(submissions: any[], exam: any) {
  const scores = submissions.map(s => s.percentage);
  const totalScores = submissions.map(s => s.totalScore);
  const passingCount = submissions.filter(s => s.isPassing).length;

  // Calculate time taken (in minutes)
  const timeTaken = submissions
    .filter(s => s.startedAt && s.submittedAt)
    .map(s => {
      const start = new Date(s.startedAt).getTime();
      const end = new Date(s.submittedAt).getTime();
      return (end - start) / (1000 * 60); // Convert to minutes
    });

  const avgTimeTaken = timeTaken.length > 0
    ? Math.round(timeTaken.reduce((a, b) => a + b, 0) / timeTaken.length)
    : 0;

  // Standard deviation
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const squaredDiffs = scores.map(s => Math.pow(s - avgScore, 2));
  const standardDeviation = Math.sqrt(
    squaredDiffs.reduce((a, b) => a + b, 0) / scores.length
  );

  return {
    averageScore: Math.round(totalScores.reduce((a, b) => a + b, 0) / totalScores.length * 100) / 100,
    averagePercentage: Math.round(avgScore * 100) / 100,
    passingRate: Math.round((passingCount / submissions.length) * 100),
    passingCount,
    failingCount: submissions.length - passingCount,
    averageTimeTaken: avgTimeTaken,
    minTimeTaken: timeTaken.length > 0 ? Math.round(Math.min(...timeTaken)) : 0,
    maxTimeTaken: timeTaken.length > 0 ? Math.round(Math.max(...timeTaken)) : 0,
    scoreRange: {
      min: Math.min(...scores),
      max: Math.max(...scores),
    },
    standardDeviation: Math.round(standardDeviation * 100) / 100,
    totalPoints: exam.totalPoints,
  };
}

function calculateScoreDistribution(submissions: any[]) {
  // Create 10 buckets (0-10%, 10-20%, ..., 90-100%)
  const buckets = Array(10).fill(0);
  
  submissions.forEach(s => {
    const bucketIndex = Math.min(Math.floor(s.percentage / 10), 9);
    buckets[bucketIndex]++;
  });

  return buckets.map((count, index) => ({
    range: `${index * 10}-${(index + 1) * 10}%`,
    count,
    percentage: Math.round((count / submissions.length) * 100),
  }));
}

function calculatePercentiles(submissions: any[]) {
  const sortedScores = submissions
    .map(s => s.percentage)
    .sort((a, b) => a - b);

  const getPercentile = (p: number) => {
    const index = Math.floor(p * sortedScores.length);
    return sortedScores[Math.min(index, sortedScores.length - 1)] || 0;
  };

  return {
    p25: getPercentile(0.25),
    p50: getPercentile(0.50), // Median
    p75: getPercentile(0.75),
    p90: getPercentile(0.90),
  };
}

async function calculateItemAnalysis(submissions: any[], questions: any[]) {
  return questions.map(question => {
    const questionId = question._id.toString();
    
    // Get all answers for this question
    const answers = submissions
      .map(s => ({
        answer: s.answers.find((a: any) => a.questionId.toString() === questionId),
        totalScore: s.percentage,
      }))
      .filter(a => a.answer);

    if (answers.length === 0) {
      return {
        questionId,
        questionNumber: question.order + 1,
        questionText: question.questionText.substring(0, 100) + (question.questionText.length > 100 ? '...' : ''),
        questionType: question.type,
        points: question.points,
        responseCount: 0,
        difficultyIndex: null,
        discriminationIndex: null,
        skipRate: 100,
        flag: 'NO_RESPONSES',
      };
    }

    // Difficulty Index (p) - proportion who answered correctly
    const correctCount = answers.filter(a => a.answer.isCorrect).length;
    const difficultyIndex = correctCount / answers.length;

    // Discrimination Index (D) - top 27% vs bottom 27%
    const sortedByScore = [...answers].sort((a, b) => b.totalScore - a.totalScore);
    const topGroupSize = Math.max(1, Math.ceil(answers.length * 0.27));
    const topGroup = sortedByScore.slice(0, topGroupSize);
    const bottomGroup = sortedByScore.slice(-topGroupSize);

    const topCorrect = topGroup.filter(a => a.answer.isCorrect).length / topGroup.length;
    const bottomCorrect = bottomGroup.filter(a => a.answer.isCorrect).length / bottomGroup.length;
    const discriminationIndex = topCorrect - bottomCorrect;

    // Skip rate
    const skipCount = submissions.length - answers.length;
    const skipRate = Math.round((skipCount / submissions.length) * 100);

    // Flag problematic questions
    let flag = 'OK';
    if (difficultyIndex < 0.2) flag = 'TOO_HARD';
    else if (difficultyIndex > 0.9) flag = 'TOO_EASY';
    else if (discriminationIndex < 0) flag = 'NEGATIVE_DISCRIMINATION';
    else if (discriminationIndex < 0.2) flag = 'POOR_DISCRIMINATION';

    return {
      questionId,
      questionNumber: question.order + 1,
      questionText: question.questionText.substring(0, 100) + (question.questionText.length > 100 ? '...' : ''),
      questionType: question.type,
      points: question.points,
      responseCount: answers.length,
      correctCount,
      difficultyIndex: Math.round(difficultyIndex * 100) / 100,
      difficultyLabel: getDifficultyLabel(difficultyIndex),
      discriminationIndex: Math.round(discriminationIndex * 100) / 100,
      discriminationLabel: getDiscriminationLabel(discriminationIndex),
      skipRate,
      flag,
    };
  });
}

function calculateGradeDistribution(submissions: any[]) {
  const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  
  submissions.forEach(s => {
    if (s.percentage >= 90) grades.A++;
    else if (s.percentage >= 80) grades.B++;
    else if (s.percentage >= 70) grades.C++;
    else if (s.percentage >= 60) grades.D++;
    else grades.F++;
  });

  return Object.entries(grades).map(([grade, count]) => ({
    grade,
    count,
    percentage: submissions.length > 0
      ? Math.round((count / submissions.length) * 100)
      : 0,
  }));
}

function calculateAnonymousDistribution(submissions: any[]) {
  // Return score ranges without identifying students
  const ranges = [
    { label: '90-100%', min: 90, max: 100 },
    { label: '80-89%', min: 80, max: 89 },
    { label: '70-79%', min: 70, max: 79 },
    { label: '60-69%', min: 60, max: 69 },
    { label: 'Below 60%', min: 0, max: 59 },
  ];

  return ranges.map(range => ({
    label: range.label,
    count: submissions.filter(s => s.percentage >= range.min && s.percentage <= range.max).length,
  }));
}

function calculatePointBiserial(answers: any[]) {
  if (answers.length < 2) return 0;

  const correct = answers.filter(a => a.answer?.isCorrect);
  const incorrect = answers.filter(a => !a.answer?.isCorrect);

  if (correct.length === 0 || incorrect.length === 0) return 0;

  const meanCorrect = correct.reduce((sum, a) => sum + a.totalScore, 0) / correct.length;
  const meanIncorrect = incorrect.reduce((sum, a) => sum + a.totalScore, 0) / incorrect.length;

  const allScores = answers.map(a => a.totalScore);
  const overallMean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const variance = allScores.reduce((sum, s) => sum + Math.pow(s - overallMean, 2), 0) / allScores.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  const p = correct.length / answers.length;
  const q = 1 - p;

  return ((meanCorrect - meanIncorrect) / stdDev) * Math.sqrt(p * q);
}

function getDifficultyLabel(index: number): string {
  if (index >= 0.7) return 'Easy';
  if (index >= 0.3) return 'Moderate';
  return 'Difficult';
}

function getDiscriminationLabel(index: number): string {
  if (index >= 0.4) return 'Excellent';
  if (index >= 0.3) return 'Good';
  if (index >= 0.2) return 'Acceptable';
  if (index >= 0) return 'Poor';
  return 'Negative (Review)';
}

export default router;