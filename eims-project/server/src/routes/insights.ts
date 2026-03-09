import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '../models/User';
import { Exam, ExamSubmission, Question, Course, Enrollment, EnrollmentStatus, User } from '../models';
import logger from '../utils/logger';
import mongoose from 'mongoose';

const router = Router();

/**
 * Calculate Point-Biserial Correlation
 * Formula: rpb = (Mp - Mq) / S * sqrt(p * q)
 * Where:
 * - Mp = mean total score for those who got item correct
 * - Mq = mean total score for those who got item incorrect
 * - S = standard deviation of all total scores
 * - p = proportion correct
 * - q = proportion incorrect
 */
function calculatePointBiserial(
  correctScores: number[],
  incorrectScores: number[],
  allScores: number[]
): number {
  if (correctScores.length === 0 || incorrectScores.length === 0 || allScores.length < 2) {
    return 0;
  }

  const Mp = correctScores.reduce((a, b) => a + b, 0) / correctScores.length;
  const Mq = incorrectScores.reduce((a, b) => a + b, 0) / incorrectScores.length;
  
  const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const variance = allScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / allScores.length;
  const S = Math.sqrt(variance);
  
  if (S === 0) return 0;
  
  const p = correctScores.length / allScores.length;
  const q = incorrectScores.length / allScores.length;
  
  const rpb = ((Mp - Mq) / S) * Math.sqrt(p * q);
  return Math.round(rpb * 100) / 100;
}

/**
 * Calculate KR-20 (Kuder-Richardson Formula 20) for test reliability
 * Formula: r = (k / (k-1)) * (1 - Σpq / σ²)
 */
function calculateKR20(
  itemDifficulties: number[],
  totalScoreVariance: number,
  itemCount: number
): number {
  if (itemCount < 2 || totalScoreVariance === 0) return 0;
  
  const sumPQ = itemDifficulties.reduce((sum, p) => sum + (p * (1 - p)), 0);
  const kr20 = (itemCount / (itemCount - 1)) * (1 - (sumPQ / totalScoreVariance));
  
  return Math.round(Math.max(0, Math.min(1, kr20)) * 100) / 100;
}

/**
 * GET /api/v1/insights/exam/:examId/item-analysis
 * Comprehensive item analysis based on ExamSoft/Classical Test Theory methodology
 */
router.get('/exam/:examId/item-analysis', authenticate, authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response): Promise<void> => {
  try {
    const examId = new mongoose.Types.ObjectId(req.params.examId);
    
    // Get exam with questions
    const exam = await Exam.findById(examId);
    if (!exam) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } });
      return;
    }

    const questions = await Question.find({ examId }).sort({ order: 1 });
    
    // Get all completed submissions
    const submissions = await ExamSubmission.find({
      examId,
      status: { $in: ['SUBMITTED', 'GRADED', 'RETURNED'] }
    }).populate('studentId', 'firstName lastName studentNumber');

    if (submissions.length < 5) {
      res.json({
        success: true,
        data: {
          exam: { title: exam.title, totalPoints: exam.totalPoints },
          message: 'Insufficient submissions for reliable item analysis. Minimum 5 submissions required.',
          submissionCount: submissions.length,
          items: [],
          examReliability: null
        }
      });
      return;
    }

    // Calculate total scores for all submissions
    const totalScores = submissions.map(s => s.percentage);
    const sortedScores = [...totalScores].sort((a, b) => b - a);
    
    // Upper 27% and Lower 27%
    const upperCount = Math.ceil(submissions.length * 0.27);
    const lowerCount = Math.ceil(submissions.length * 0.27);
    
    const upperThreshold = sortedScores[upperCount - 1] || 0;
    const lowerThreshold = sortedScores[sortedScores.length - lowerCount] || 0;
    
    const upperSubmissions = submissions.filter(s => s.percentage >= upperThreshold);
    const lowerSubmissions = submissions.filter(s => s.percentage <= lowerThreshold);

    // Calculate mean and variance for total scores
    const meanScore = totalScores.reduce((a, b) => a + b, 0) / totalScores.length;
    const variance = totalScores.reduce((sum, score) => sum + Math.pow(score - meanScore, 2), 0) / totalScores.length;

    // Analyze each question
    const itemDifficulties: number[] = [];
    const itemAnalysis = questions.map((question, index) => {
      // Skip essay questions for automated analysis
      if (question.type === 'ESSAY') {
        return {
          questionId: question._id,
          questionNumber: index + 1,
          questionText: question.questionText.substring(0, 100) + (question.questionText.length > 100 ? '...' : ''),
          type: question.type,
          points: question.points,
          isEssay: true,
          message: 'Essay questions require manual review'
        };
      }

      // Get responses for this question
      const responses = submissions.map(sub => {
        const answer = sub.answers.find(a => a.questionId.toString() === question._id.toString());
        return {
          submission: sub,
          answer,
          isCorrect: answer?.isCorrect || false,
          totalScore: sub.percentage
        };
      });

      // Difficulty Index (p-value)
      const correctCount = responses.filter(r => r.isCorrect).length;
      const difficultyIndex = correctCount / submissions.length;
      itemDifficulties.push(difficultyIndex);

      // Upper 27% Difficulty
      const upperResponses = responses.filter(r => 
        upperSubmissions.some(us => us._id.toString() === r.submission._id.toString())
      );
      const upperCorrect = upperResponses.filter(r => r.isCorrect).length;
      const upper27Difficulty = upperResponses.length > 0 ? upperCorrect / upperResponses.length : 0;

      // Lower 27% Difficulty
      const lowerResponses = responses.filter(r => 
        lowerSubmissions.some(ls => ls._id.toString() === r.submission._id.toString())
      );
      const lowerCorrect = lowerResponses.filter(r => r.isCorrect).length;
      const lower27Difficulty = lowerResponses.length > 0 ? lowerCorrect / lowerResponses.length : 0;

      // Discrimination Index
      const discriminationIndex = upper27Difficulty - lower27Difficulty;

      // Point-Biserial Correlation
      const correctScores = responses.filter(r => r.isCorrect).map(r => r.totalScore);
      const incorrectScores = responses.filter(r => !r.isCorrect).map(r => r.totalScore);
      const pointBiserial = calculatePointBiserial(correctScores, incorrectScores, totalScores);

      // Distractor Analysis (for multiple choice)
      let distractorAnalysis: any[] = [];
      if (question.type === 'MULTIPLE_CHOICE' && question.choices) {
        distractorAnalysis = question.choices.map((choice, ci) => {
          const chosenBy = responses.filter(r => {
            const selectedIndex = r.answer?.selectedChoiceIndex;
            return selectedIndex === ci;
          }).length;
          
          const proportion = chosenBy / submissions.length;
          
          // Upper/Lower selection rates
          const upperChosen = upperResponses.filter(r => r.answer?.selectedChoiceIndex === ci).length;
          const lowerChosen = lowerResponses.filter(r => r.answer?.selectedChoiceIndex === ci).length;
          
          const upperRate = upperResponses.length > 0 ? upperChosen / upperResponses.length : 0;
          const lowerRate = lowerResponses.length > 0 ? lowerChosen / lowerResponses.length : 0;
          
          // Distractor discrimination
          const distractorDisc = upperRate - lowerRate;
          
          // Point-biserial for this option
          const optionScores = responses.filter(r => r.answer?.selectedChoiceIndex === ci).map(r => r.totalScore);
          const otherScores = responses.filter(r => r.answer?.selectedChoiceIndex !== ci).map(r => r.totalScore);
          const optionPB = calculatePointBiserial(optionScores, otherScores, totalScores);

          return {
            choiceIndex: ci,
            text: choice.text.substring(0, 50) + (choice.text.length > 50 ? '...' : ''),
            isCorrect: choice.isCorrect,
            selectedCount: chosenBy,
            proportion: Math.round(proportion * 100) / 100,
            upper27Rate: Math.round(upperRate * 100) / 100,
            lower27Rate: Math.round(lowerRate * 100) / 100,
            discrimination: Math.round(distractorDisc * 100) / 100,
            pointBiserial: optionPB
          };
        });
      }

      // Interpretation based on ExamSoft guidelines
      let difficultyInterpretation = 'Moderate';
      if (difficultyIndex >= 0.90) difficultyInterpretation = 'Very Easy (Mastery)';
      else if (difficultyIndex >= 0.70) difficultyInterpretation = 'Easy';
      else if (difficultyIndex <= 0.30) difficultyInterpretation = 'Difficult';
      else if (difficultyIndex <= 0.10) difficultyInterpretation = 'Very Difficult';

      let discriminationInterpretation = 'Good';
      let discriminationQuality = 'good';
      if (discriminationIndex >= 0.30) {
        discriminationInterpretation = 'Good discrimination';
        discriminationQuality = 'good';
      } else if (discriminationIndex >= 0.10) {
        discriminationInterpretation = 'Fair discrimination - review may be necessary';
        discriminationQuality = 'fair';
      } else if (discriminationIndex === 0) {
        discriminationInterpretation = 'No discrimination - may indicate mastery item';
        discriminationQuality = 'neutral';
      } else {
        discriminationInterpretation = 'Negative discrimination - REVIEW REQUIRED (possible miskey or flawed item)';
        discriminationQuality = 'poor';
      }

      let pointBiserialInterpretation = 'Good';
      let pbQuality = 'good';
      if (pointBiserial >= 0.30) {
        pointBiserialInterpretation = 'Good correlation';
        pbQuality = 'good';
      } else if (pointBiserial >= 0.10) {
        pointBiserialInterpretation = 'Fair correlation - review may be necessary';
        pbQuality = 'fair';
      } else if (pointBiserial >= 0) {
        pointBiserialInterpretation = 'Uncertain correlation - review for mastery';
        pbQuality = 'neutral';
      } else {
        pointBiserialInterpretation = 'Negative correlation - REVIEW REQUIRED';
        pbQuality = 'poor';
      }

      // Generate recommendations
      const recommendations: string[] = [];
      if (discriminationIndex < 0) {
        recommendations.push('Check if answer key is correct');
        recommendations.push('Review item for ambiguous wording');
      }
      if (difficultyIndex > 0.90) {
        recommendations.push('Consider if this is a mastery/warm-up item');
        recommendations.push('May not discriminate well between students');
      }
      if (difficultyIndex < 0.30) {
        recommendations.push('Item may be too difficult');
        recommendations.push('Review if content was adequately covered');
      }
      if (pointBiserial < 0.10) {
        recommendations.push('Item may not align with overall test objectives');
      }
      
      // Check distractor effectiveness
      if (question.type === 'MULTIPLE_CHOICE') {
        const ineffectiveDistractors = distractorAnalysis.filter(d => 
          !d.isCorrect && d.proportion < 0.05
        );
        if (ineffectiveDistractors.length > 0) {
          recommendations.push(`${ineffectiveDistractors.length} distractor(s) chosen by <5% - consider revision`);
        }
        
        const attractiveDistractors = distractorAnalysis.filter(d =>
          !d.isCorrect && d.upper27Rate > d.lower27Rate
        );
        if (attractiveDistractors.length > 0) {
          recommendations.push('Some distractors attract high performers - review for ambiguity');
        }
      }

      return {
        questionId: question._id,
        questionNumber: index + 1,
        questionText: question.questionText.substring(0, 100) + (question.questionText.length > 100 ? '...' : ''),
        type: question.type,
        points: question.points,
        
        // Core Statistics
        statistics: {
          difficultyIndex: Math.round(difficultyIndex * 100) / 100,
          upper27Difficulty: Math.round(upper27Difficulty * 100) / 100,
          lower27Difficulty: Math.round(lower27Difficulty * 100) / 100,
          discriminationIndex: Math.round(discriminationIndex * 100) / 100,
          pointBiserial,
          correctCount,
          totalResponses: submissions.length
        },
        
        // Interpretations
        interpretation: {
          difficulty: difficultyInterpretation,
          discrimination: discriminationInterpretation,
          discriminationQuality,
          pointBiserial: pointBiserialInterpretation,
          pbQuality
        },
        
        // Distractor Analysis
        distractorAnalysis,
        
        // Recommendations
        recommendations,
        
        // Overall Quality Score (0-100)
        qualityScore: calculateItemQualityScore(difficultyIndex, discriminationIndex, pointBiserial)
      };
    });

    // Calculate KR-20 for exam reliability
    const kr20 = calculateKR20(itemDifficulties, variance, questions.filter(q => q.type !== 'ESSAY').length);
    
    let reliabilityInterpretation = 'Good';
    if (kr20 >= 0.80) reliabilityInterpretation = 'High reliability - suitable for high-stakes assessment';
    else if (kr20 >= 0.70) reliabilityInterpretation = 'Acceptable reliability for classroom exams';
    else if (kr20 >= 0.60) reliabilityInterpretation = 'Moderate reliability - consider revising weak items';
    else reliabilityInterpretation = 'Low reliability - significant revision needed';

    // Summary statistics
    const objectiveItems = itemAnalysis.filter(i => !i.isEssay);
    const goodItems = objectiveItems.filter(i => (i as any).interpretation?.discriminationQuality === 'good').length;
    const fairItems = objectiveItems.filter(i => (i as any).interpretation?.discriminationQuality === 'fair').length;
    const poorItems = objectiveItems.filter(i => (i as any).interpretation?.discriminationQuality === 'poor').length;

    res.json({
      success: true,
      data: {
        exam: {
          title: exam.title,
          totalPoints: exam.totalPoints,
          questionCount: questions.length
        },
        submissionCount: submissions.length,
        
        // Exam-level statistics
        examStatistics: {
          meanScore: Math.round(meanScore * 100) / 100,
          standardDeviation: Math.round(Math.sqrt(variance) * 100) / 100,
          kr20,
          reliabilityInterpretation,
          upper27Threshold: Math.round(upperThreshold * 100) / 100,
          lower27Threshold: Math.round(lowerThreshold * 100) / 100
        },
        
        // Item quality summary
        summary: {
          totalObjectiveItems: objectiveItems.length,
          goodItems,
          fairItems,
          poorItems,
          essayItems: itemAnalysis.filter(i => i.isEssay).length,
          averageDifficulty: Math.round((itemDifficulties.reduce((a, b) => a + b, 0) / itemDifficulties.length) * 100) / 100,
          averageDiscrimination: Math.round((objectiveItems.reduce((sum, i) => sum + ((i as any).statistics?.discriminationIndex || 0), 0) / objectiveItems.length) * 100) / 100
        },
        
        // Individual item analysis
        items: itemAnalysis,
        
        // Reference guide
        interpretationGuide: {
          difficultyIndex: {
            description: 'Proportion of students who answered correctly (p-value)',
            ideal: '0.30 - 0.70',
            ranges: [
              { range: '0.90 - 1.00', meaning: 'Very Easy (Mastery Item)' },
              { range: '0.70 - 0.89', meaning: 'Easy' },
              { range: '0.30 - 0.69', meaning: 'Moderate (Ideal)' },
              { range: '0.10 - 0.29', meaning: 'Difficult' },
              { range: '0.00 - 0.09', meaning: 'Very Difficult' }
            ]
          },
          discriminationIndex: {
            description: 'Difference between upper 27% and lower 27% performance',
            ideal: '≥ 0.30',
            ranges: [
              { range: '≥ 0.30', meaning: 'Good discrimination' },
              { range: '0.10 - 0.29', meaning: 'Fair - review may be needed' },
              { range: '0.00', meaning: 'No discrimination' },
              { range: '< 0.00', meaning: 'Negative - REVIEW REQUIRED' }
            ]
          },
          pointBiserial: {
            description: 'Correlation between item response and total score',
            ideal: '≥ 0.30',
            ranges: [
              { range: '≥ 0.30', meaning: 'Good correlation' },
              { range: '0.10 - 0.29', meaning: 'Fair correlation' },
              { range: '0.00 - 0.09', meaning: 'Poor correlation' },
              { range: '< 0.00', meaning: 'Negative - REVIEW REQUIRED' }
            ]
          },
          kr20: {
            description: 'Kuder-Richardson Formula 20 - Exam reliability coefficient',
            ideal: '≥ 0.70 for classroom exams',
            ranges: [
              { range: '≥ 0.80', meaning: 'High reliability' },
              { range: '0.70 - 0.79', meaning: 'Acceptable reliability' },
              { range: '0.60 - 0.69', meaning: 'Moderate reliability' },
              { range: '< 0.60', meaning: 'Low reliability' }
            ]
          }
        },
        
        // Source attribution
        methodology: {
          source: 'ExamSoft White Paper - Exam Quality Through the Use of Psychometric Analysis',
          institution: 'Ohio State University College of Medicine, Department of Assessment and Evaluation',
          framework: 'Classical Test Theory (CTT)'
        }
      }
    });
  } catch (error) {
    logger.error('Item analysis error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to perform item analysis' } });
  }
});

/**
 * Calculate overall item quality score (0-100)
 */
function calculateItemQualityScore(difficulty: number, discrimination: number, pointBiserial: number): number {
  let score = 0;
  
  // Difficulty score (max 30 points) - ideal is 0.3-0.7
  if (difficulty >= 0.30 && difficulty <= 0.70) {
    score += 30;
  } else if (difficulty >= 0.20 && difficulty <= 0.80) {
    score += 20;
  } else if (difficulty >= 0.10 && difficulty <= 0.90) {
    score += 10;
  }
  
  // Discrimination score (max 40 points)
  if (discrimination >= 0.30) {
    score += 40;
  } else if (discrimination >= 0.20) {
    score += 30;
  } else if (discrimination >= 0.10) {
    score += 20;
  } else if (discrimination >= 0) {
    score += 10;
  }
  // Negative discrimination = 0 points
  
  // Point-biserial score (max 30 points)
  if (pointBiserial >= 0.30) {
    score += 30;
  } else if (pointBiserial >= 0.20) {
    score += 20;
  } else if (pointBiserial >= 0.10) {
    score += 10;
  } else if (pointBiserial >= 0) {
    score += 5;
  }
  // Negative point-biserial = 0 points
  
  return score;
}

/**
 * GET /api/v1/insights/comprehensive
 * Comprehensive insights dashboard with highest scorers, rankings, and trends
 */
router.get('/comprehensive', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: userId, role } = req.user!;
    const courseId = req.query.courseId as string;
    
    let filter: any = { status: { $in: ['GRADED', 'RETURNED'] } };
    
    if (role === Role.STUDENT) {
      // Students see their own comprehensive insights
      filter.studentId = new mongoose.Types.ObjectId(userId);
    } else if (role === Role.FACULTY) {
      // Faculty see insights for their exams
      const myExams = await Exam.find({ createdById: userId }).select('_id');
      filter.examId = { $in: myExams.map(e => e._id) };
    }
    
    if (courseId) {
      const courseExams = await Exam.find({ courseId: new mongoose.Types.ObjectId(courseId) }).select('_id');
      filter.examId = { $in: courseExams.map(e => e._id) };
    }

    const submissions = await ExamSubmission.find(filter)
      .populate('examId', 'title type courseId totalPoints passingScore')
      .populate('studentId', 'firstName lastName studentNumber email section')
      .sort({ submittedAt: -1 });

    if (submissions.length === 0) {
      res.json({
        success: true,
        data: {
          message: 'No submissions found',
          statistics: null,
          highestScorers: [],
          performanceByCategory: [],
          trends: []
        }
      });
      return;
    }

    // Overall statistics
    const scores = submissions.map(s => s.percentage);
    const overallStats = {
      totalSubmissions: submissions.length,
      averageScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      medianScore: calculateMedian(scores),
      standardDeviation: calculateStdDev(scores),
      passingRate: Math.round((submissions.filter(s => s.isPassing).length / submissions.length) * 100)
    };

    // Get unique exams
    const examIds = [...new Set(submissions.map(s => (s.examId as any)?._id?.toString()).filter(Boolean))];
    
    // Highest scorer for each exam/category
    const highestScorers: any[] = [];
    for (const examIdStr of examIds) {
      const examSubmissions = submissions.filter(s => 
        (s.examId as any)?._id?.toString() === examIdStr
      );
      
      if (examSubmissions.length > 0) {
        const topSubmission = examSubmissions.reduce((best, curr) => 
          curr.percentage > best.percentage ? curr : best
        );
        
        const exam = topSubmission.examId as any;
        const student = topSubmission.studentId as any;
        
        highestScorers.push({
          examId: exam._id,
          examTitle: exam.title,
          examType: exam.type,
          courseId: exam.courseId,
          highestScore: topSubmission.percentage,
          totalPoints: topSubmission.totalScore,
          maxPoints: topSubmission.maxScore,
          student: {
            id: student._id,
            name: `${student.firstName} ${student.lastName}`,
            studentNumber: student.studentNumber,
            section: student.section
          },
          submittedAt: topSubmission.submittedAt,
          // Additional stats for this exam
          examStats: {
            totalSubmissions: examSubmissions.length,
            averageScore: Math.round((examSubmissions.reduce((sum, s) => sum + s.percentage, 0) / examSubmissions.length) * 100) / 100,
            passingCount: examSubmissions.filter(s => s.isPassing).length
          }
        });
      }
    }

    // Performance by exam type
    const examTypes = ['QUIZ', 'MIDTERM', 'FINAL', 'ASSIGNMENT'];
    const performanceByCategory = examTypes.map(type => {
      const typeSubmissions = submissions.filter(s => (s.examId as any)?.type === type);
      if (typeSubmissions.length === 0) return null;
      
      const typeScores = typeSubmissions.map(s => s.percentage);
      const topSubmission = typeSubmissions.reduce((best, curr) => 
        curr.percentage > best.percentage ? curr : best
      );
      
      return {
        category: type,
        count: typeSubmissions.length,
        averageScore: Math.round((typeScores.reduce((a, b) => a + b, 0) / typeScores.length) * 100) / 100,
        highestScore: Math.max(...typeScores),
        lowestScore: Math.min(...typeScores),
        passingRate: Math.round((typeSubmissions.filter(s => s.isPassing).length / typeSubmissions.length) * 100),
        topPerformer: {
          name: `${(topSubmission.studentId as any).firstName} ${(topSubmission.studentId as any).lastName}`,
          score: topSubmission.percentage,
          examTitle: (topSubmission.examId as any).title
        }
      };
    }).filter(Boolean);

    // Performance trends (by month)
    const monthlyTrends = submissions.reduce((acc: any, sub) => {
      const month = new Date(sub.submittedAt).toISOString().slice(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = { scores: [], count: 0, passing: 0 };
      }
      acc[month].scores.push(sub.percentage);
      acc[month].count++;
      if (sub.isPassing) acc[month].passing++;
      return acc;
    }, {});

    const trends = Object.entries(monthlyTrends)
      .map(([month, data]: [string, any]) => ({
        month,
        averageScore: Math.round((data.scores.reduce((a: number, b: number) => a + b, 0) / data.scores.length) * 100) / 100,
        submissionCount: data.count,
        passingRate: Math.round((data.passing / data.count) * 100)
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Class rankings (for faculty view)
    let classRankings: any[] = [];
    if (role === Role.FACULTY || role === Role.ADMIN) {
      const studentScores = submissions.reduce((acc: any, sub) => {
        const studentId = (sub.studentId as any)?._id?.toString();
        if (!studentId) return acc;
        
        if (!acc[studentId]) {
          acc[studentId] = {
            student: sub.studentId,
            scores: [],
            exams: 0
          };
        }
        acc[studentId].scores.push(sub.percentage);
        acc[studentId].exams++;
        return acc;
      }, {});

      classRankings = Object.values(studentScores)
        .map((data: any) => ({
          studentId: data.student._id,
          name: `${data.student.firstName} ${data.student.lastName}`,
          studentNumber: data.student.studentNumber,
          section: data.student.section,
          examsTaken: data.exams,
          averageScore: Math.round((data.scores.reduce((a: number, b: number) => a + b, 0) / data.scores.length) * 100) / 100,
          highestScore: Math.max(...data.scores),
          lowestScore: Math.min(...data.scores)
        }))
        .sort((a, b) => b.averageScore - a.averageScore)
        .map((student, index) => ({ ...student, rank: index + 1 }));
    }

    // Student-specific insights
    let studentInsights: any = null;
    if (role === Role.STUDENT) {
      const mySubmissions = submissions;
      const myScores = mySubmissions.map(s => s.percentage);
      
      // Get all submissions for comparison (same exams)
      const comparisonFilter: any = {
        examId: { $in: mySubmissions.map(s => (s.examId as any)?._id) },
        status: { $in: ['GRADED', 'RETURNED'] }
      };
      
      const allSubmissions = await ExamSubmission.find(comparisonFilter);
      
      // Calculate percentile
      const allScores = allSubmissions.map(s => s.percentage);
      const myAverage = myScores.reduce((a, b) => a + b, 0) / myScores.length;
      const percentile = Math.round((allScores.filter(s => s < myAverage).length / allScores.length) * 100);
      
      studentInsights = {
        totalExamsTaken: mySubmissions.length,
        averageScore: Math.round(myAverage * 100) / 100,
        highestScore: Math.max(...myScores),
        lowestScore: Math.min(...myScores),
        passingRate: Math.round((mySubmissions.filter(s => s.isPassing).length / mySubmissions.length) * 100),
        percentileRank: percentile,
        improvement: mySubmissions.length >= 2 ? 
          Math.round((myScores[0] - myScores[myScores.length - 1]) * 100) / 100 : null,
        strengthAreas: performanceByCategory
          .filter(p => p && p.averageScore >= 80)
          .map(p => p?.category),
        improvementAreas: performanceByCategory
          .filter(p => p && p.averageScore < 60)
          .map(p => p?.category)
      };
    }

    res.json({
      success: true,
      data: {
        statistics: overallStats,
        highestScorers,
        performanceByCategory,
        trends,
        classRankings: classRankings.slice(0, 50), // Top 50
        studentInsights
      }
    });
  } catch (error) {
    logger.error('Comprehensive insights error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch insights' } });
  }
});

/**
 * GET /api/v1/insights/my-performance
 * Get performance insights for the currently logged-in student
 */
router.get('/my-performance', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    
    if (!userId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      return;
    }

    const student = await User.findById(userId).select('firstName lastName studentNumber email section program yearLevel role');
    if (!student) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    // Get all graded/returned submissions for this student
    const submissions = await ExamSubmission.find({
      studentId: userId,
      status: { $in: ['GRADED', 'RETURNED'] }
    })
      .populate('examId', 'title type courseId totalPoints passingScore')
      .sort({ submittedAt: -1 });

    if (submissions.length === 0) {
      res.json({
        success: true,
        data: {
          student: {
            _id: student._id,
            firstName: student.firstName,
            lastName: student.lastName,
            studentNumber: student.studentNumber,
            email: student.email
          },
          message: 'No graded submissions found yet',
          statistics: {
            totalExams: 0,
            averageScore: 0,
            highestScore: 0,
            lowestScore: 0,
            medianScore: 0,
            passingRate: 0,
            percentileRank: 0,
            comparedToClass: 0
          },
          typePerformance: [],
          submissions: [],
          recentExams: []
        }
      });
      return;
    }

    const scores = submissions.map(s => s.percentage);
    const studentAverage = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Get class comparison data (all students who took the same exams)
    const examIds = submissions.map(s => (s.examId as any)?._id).filter(Boolean);
    const allSubmissions = await ExamSubmission.find({
      examId: { $in: examIds },
      status: { $in: ['GRADED', 'RETURNED'] }
    });

    const classAverage = allSubmissions.length > 0 
      ? allSubmissions.reduce((sum, s) => sum + s.percentage, 0) / allSubmissions.length 
      : 0;

    // Percentile calculation
    const allScores = allSubmissions.map(s => s.percentage);
    const percentile = allScores.length > 0 
      ? Math.round((allScores.filter(s => s < studentAverage).length / allScores.length) * 100)
      : 0;

    // Performance by question type
    const questionTypePerformance: Record<string, { correct: number; total: number }> = {};
    for (const sub of submissions) {
      const examId = (sub.examId as any)?._id;
      if (!examId) continue;
      
      const questions = await Question.find({ examId });
      for (const question of questions) {
        const answer = sub.answers.find(a => a.questionId.toString() === question._id.toString());
        if (!questionTypePerformance[question.type]) {
          questionTypePerformance[question.type] = { correct: 0, total: 0 };
        }
        questionTypePerformance[question.type].total++;
        if (answer?.isCorrect) {
          questionTypePerformance[question.type].correct++;
        }
      }
    }

    const typePerformance = Object.entries(questionTypePerformance).map(([type, data]) => ({
      type,
      accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      totalQuestions: data.total,
      correctAnswers: data.correct
    }));

    // Get courses the student is enrolled in for context
    const courseIds = [...new Set(submissions.map(s => (s.examId as any)?.courseId?.toString()).filter(Boolean))];

    res.json({
      success: true,
      data: {
        student: {
          _id: student._id,
          firstName: student.firstName,
          lastName: student.lastName,
          studentNumber: student.studentNumber,
          email: student.email,
          section: student.section,
          program: student.program,
          yearLevel: student.yearLevel
        },
        statistics: {
          totalExams: submissions.length,
          averageScore: Math.round(studentAverage * 100) / 100,
          highestScore: Math.max(...scores),
          lowestScore: Math.min(...scores),
          medianScore: calculateMedian(scores),
          passingRate: Math.round((submissions.filter(s => s.isPassing).length / submissions.length) * 100),
          percentileRank: percentile,
          comparedToClass: Math.round((studentAverage - classAverage) * 100) / 100
        },
        typePerformance,
        submissions: submissions.map(s => ({
          _id: s._id,
          exam: {
            _id: (s.examId as any)?._id,
            title: (s.examId as any)?.title || 'Unknown',
            type: (s.examId as any)?.type || 'QUIZ'
          },
          score: s.totalScore,
          maxScore: s.maxScore,
          percentage: s.percentage,
          isPassing: s.isPassing,
          submittedAt: s.submittedAt,
          gradedAt: s.gradedAt
        })),
        recentExams: submissions.slice(0, 5).map(s => ({
          examId: (s.examId as any)?._id,
          title: (s.examId as any)?.title || 'Unknown',
          type: (s.examId as any)?.type || 'QUIZ',
          score: s.percentage,
          isPassing: s.isPassing,
          date: s.submittedAt
        }))
      }
    });
  } catch (error) {
    logger.error('My performance insights error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch performance insights' } });
  }
});

/**
 * GET /api/v1/insights/student/:studentId
 * Get detailed insights for a specific student (Faculty/Admin only)
 */
router.get('/student/:studentId', authenticate, authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = new mongoose.Types.ObjectId(req.params.studentId);
    const courseId = req.query.courseId as string;
    
    const student = await User.findById(studentId).select('firstName lastName studentNumber email section program yearLevel');
    if (!student) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Student not found' } });
      return;
    }

    let filter: any = {
      studentId,
      status: { $in: ['GRADED', 'RETURNED'] }
    };

    if (courseId) {
      const courseExams = await Exam.find({ courseId: new mongoose.Types.ObjectId(courseId) }).select('_id');
      filter.examId = { $in: courseExams.map(e => e._id) };
    }

    const submissions = await ExamSubmission.find(filter)
      .populate('examId', 'title type courseId totalPoints passingScore')
      .sort({ submittedAt: -1 });

    if (submissions.length === 0) {
      res.json({
        success: true,
        data: {
          student,
          message: 'No submissions found for this student',
          statistics: null,
          submissions: []
        }
      });
      return;
    }

    const scores = submissions.map(s => s.percentage);
    
    // Get class comparison data
    const examIds = submissions.map(s => (s.examId as any)?._id);
    const allSubmissions = await ExamSubmission.find({
      examId: { $in: examIds },
      status: { $in: ['GRADED', 'RETURNED'] }
    });

    const classAverage = allSubmissions.reduce((sum, s) => sum + s.percentage, 0) / allSubmissions.length;
    const studentAverage = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    // Percentile calculation
    const allScores = allSubmissions.map(s => s.percentage);
    const percentile = Math.round((allScores.filter(s => s < studentAverage).length / allScores.length) * 100);

    // Performance by question type (aggregated from all submissions)
    const questionTypePerformance: any = {};
    for (const sub of submissions) {
      const questions = await Question.find({ examId: (sub.examId as any)?._id });
      for (const question of questions) {
        const answer = sub.answers.find(a => a.questionId.toString() === question._id.toString());
        if (!questionTypePerformance[question.type]) {
          questionTypePerformance[question.type] = { correct: 0, total: 0 };
        }
        questionTypePerformance[question.type].total++;
        if (answer?.isCorrect) {
          questionTypePerformance[question.type].correct++;
        }
      }
    }

    const typePerformance = Object.entries(questionTypePerformance).map(([type, data]: [string, any]) => ({
      type,
      accuracy: Math.round((data.correct / data.total) * 100),
      totalQuestions: data.total,
      correctAnswers: data.correct
    }));

    res.json({
      success: true,
      data: {
        student,
        statistics: {
          totalExams: submissions.length,
          averageScore: Math.round(studentAverage * 100) / 100,
          highestScore: Math.max(...scores),
          lowestScore: Math.min(...scores),
          medianScore: calculateMedian(scores),
          passingRate: Math.round((submissions.filter(s => s.isPassing).length / submissions.length) * 100),
          percentileRank: percentile,
          comparedToClass: Math.round((studentAverage - classAverage) * 100) / 100
        },
        typePerformance,
        submissions: submissions.map(s => ({
          _id: s._id,
          exam: {
            title: (s.examId as any).title,
            type: (s.examId as any).type
          },
          score: s.totalScore,
          maxScore: s.maxScore,
          percentage: s.percentage,
          isPassing: s.isPassing,
          submittedAt: s.submittedAt
        }))
      }
    });
  } catch (error) {
    logger.error('Student insights error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch student insights' } });
  }
});

// Helper functions
function calculateMedian(scores: number[]): number {
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateStdDev(scores: number[]): number {
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

/**
 * GET /api/v1/insights/course/:courseId
 * Get comprehensive insights for a specific course
 */
router.get('/course/:courseId', authenticate, authorize(Role.ADMIN, Role.FACULTY), async (req: Request, res: Response): Promise<void> => {
  try {
    const courseId = new mongoose.Types.ObjectId(req.params.courseId);
    
    // Get course details
    const course = await Course.findById(courseId);
    if (!course) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Course not found' } });
      return;
    }

    // Get enrollment count
    const enrollmentCount = await Enrollment.countDocuments({
      courseId,
      status: EnrollmentStatus.ENROLLED
    });

    // Get all exams for this course
    const exams = await Exam.find({ courseId }).select('_id title type totalPoints');
    const examIds = exams.map(e => e._id);

    // Get all submissions for these exams
    const submissions = await ExamSubmission.find({
      examId: { $in: examIds },
      status: { $in: ['SUBMITTED', 'GRADED', 'RETURNED'] }
    }).populate('studentId', 'firstName lastName studentNumber');

    if (submissions.length === 0) {
      res.json({
        courseId: course._id,
        courseName: course.name,
        courseCode: course.code,
        enrollmentCount,
        totalExams: exams.length,
        totalSubmissions: 0,
        coursePassingRate: 0,
        averageCourseGrade: 0,
        examComparison: [],
        gradeDistribution: [],
        topPerformers: [],
        recentActivity: []
      });
      return;
    }

    // Calculate course-wide statistics
    const allScores = submissions.map(s => s.percentage);
    const averageCourseGrade = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
    const passingSubmissions = submissions.filter(s => s.isPassing).length;
    const coursePassingRate = Math.round((passingSubmissions / submissions.length) * 100);

    // Exam comparison data with highest scorer
    const examComparison = exams.map(exam => {
      const examSubmissions = submissions.filter(s => 
        s.examId.toString() === exam._id.toString()
      );
      
      if (examSubmissions.length === 0) {
        return {
          examId: exam._id,
          examTitle: exam.title,
          examType: exam.type,
          submissionCount: 0,
          averageScore: 0,
          passingRate: 0,
          highestScore: 0,
          lowestScore: 0,
          highestScorer: null
        };
      }

      const scores = examSubmissions.map(s => s.percentage);
      const passing = examSubmissions.filter(s => s.isPassing).length;
      
      // Find highest scorer for this exam
      const topSubmission = examSubmissions.reduce((best, curr) => 
        curr.percentage > best.percentage ? curr : best
      );
      const topStudent = topSubmission.studentId as any;

      return {
        examId: exam._id,
        examTitle: exam.title,
        examType: exam.type,
        submissionCount: examSubmissions.length,
        averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        passingRate: Math.round((passing / examSubmissions.length) * 100),
        highestScore: Math.max(...scores),
        lowestScore: Math.min(...scores),
        highestScorer: {
          name: `${topStudent.firstName} ${topStudent.lastName}`,
          studentNumber: topStudent.studentNumber,
          score: topSubmission.percentage
        }
      };
    }).filter(e => e.submissionCount > 0);

    // Grade distribution (A, B, C, D, F)
    const gradeRanges = [
      { grade: 'A', min: 90, max: 100 },
      { grade: 'B', min: 80, max: 89 },
      { grade: 'C', min: 70, max: 79 },
      { grade: 'D', min: 60, max: 69 },
      { grade: 'F', min: 0, max: 59 }
    ];

    const gradeDistribution = gradeRanges.map(range => {
      const count = allScores.filter(score => score >= range.min && score <= range.max).length;
      return {
        grade: range.grade,
        count,
        percentage: Math.round((count / allScores.length) * 100)
      };
    });

    // Top performers in the course (aggregate across all exams)
    const studentScores: Record<string, { student: any; scores: number[]; totalExams: number }> = {};
    
    submissions.forEach(sub => {
      const studentId = (sub.studentId as any)?._id?.toString();
      if (!studentId) return;
      
      if (!studentScores[studentId]) {
        studentScores[studentId] = {
          student: sub.studentId,
          scores: [],
          totalExams: 0
        };
      }
      studentScores[studentId].scores.push(sub.percentage);
      studentScores[studentId].totalExams++;
    });

    const topPerformers = Object.values(studentScores)
      .map(data => ({
        studentId: data.student._id,
        name: `${data.student.firstName} ${data.student.lastName}`,
        studentNumber: data.student.studentNumber,
        examsTaken: data.totalExams,
        averageScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
        highestScore: Math.max(...data.scores)
      }))
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10);

    // Recent activity
    const recentActivity = submissions
      .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
      .slice(0, 10)
      .map(sub => {
        const exam = exams.find(e => e._id.toString() === sub.examId.toString());
        const student = sub.studentId as any;
        return {
          submissionId: sub._id,
          studentName: `${student.firstName} ${student.lastName}`,
          examTitle: exam?.title || 'Unknown',
          score: sub.percentage,
          isPassing: sub.isPassing,
          submittedAt: sub.submittedAt
        };
      });

    res.json({
      courseId: course._id,
      courseName: course.name,
      courseCode: course.code,
      enrollmentCount,
      totalExams: exams.length,
      totalSubmissions: submissions.length,
      coursePassingRate,
      averageCourseGrade,
      examComparison,
      gradeDistribution,
      topPerformers,
      recentActivity
    });
  } catch (error) {
    logger.error('Course insights error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch course insights' } });
  }
});

export default router;