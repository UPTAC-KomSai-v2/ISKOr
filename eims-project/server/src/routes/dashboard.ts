import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { Role } from '../models/User';
import { User, Course, Exam, ExamStatus, ExamSubmission, ExamResult, ResultStatus, Enrollment, EnrollmentStatus, Announcement } from '../models';
import logger from '../utils/logger';
import mongoose from 'mongoose';

const router = Router();

/**
 * GET /api/v1/dashboard/stats
 * Get dashboard statistics based on user role
 */
router.get('/stats', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: userId, role } = req.user!;
    let stats: any = {};

    if (role === Role.ADMIN) {
      const [totalUsers, totalCourses, totalExams, activeExams] = await Promise.all([
        User.countDocuments({ isActive: true }),
        Course.countDocuments(),
        Exam.countDocuments(),
        Exam.countDocuments({ status: ExamStatus.ACTIVE }),
      ]);

      stats = {
        totalUsers,
        totalCourses,
        totalExams,
        activeExams,
      };
    } else if (role === Role.FACULTY) {
      const [myCourses, myExams, pendingResults, totalStudents] = await Promise.all([
        Course.countDocuments({ facultyId: userId }),
        Exam.countDocuments({ createdById: userId }),
        ExamSubmission.countDocuments({
          examId: { $in: (await Exam.find({ createdById: userId }).select('_id')).map(e => e._id) },
          status: 'SUBMITTED',
        }),
        Enrollment.countDocuments({
          courseId: { $in: (await Course.find({ facultyId: userId }).select('_id')).map(c => c._id) },
          status: EnrollmentStatus.ENROLLED,
        }),
      ]);

      stats = {
        myCourses,
        myExams,
        pendingResults,
        totalStudents,
      };
    } else if (role === Role.STUDENT) {
      // Get enrolled courses for student
      const enrollments = await Enrollment.find({ 
        studentId: new mongoose.Types.ObjectId(userId), 
        status: EnrollmentStatus.ENROLLED 
      }).select('courseId');
      
      const courseIds = enrollments.map(e => e.courseId);
      const enrolledCourses = enrollments.length;

      // Count upcoming exams - FIXED: properly count active exams for enrolled courses
      const now = new Date();
      const upcomingExams = await Exam.countDocuments({
        courseId: { $in: courseIds },
        status: ExamStatus.ACTIVE,
        $or: [
          { endDate: { $gte: now } },
          { endDate: null },
          { endDate: { $exists: false } },
        ],
      });

      // Count completed submissions (results)
      const myResults = await ExamSubmission.countDocuments({ 
        studentId: new mongoose.Types.ObjectId(userId), 
        status: { $in: ['GRADED', 'RETURNED'] }
      });

      // Calculate average score from submissions
      const avgScoreResult = await ExamSubmission.aggregate([
        { 
          $match: { 
            studentId: new mongoose.Types.ObjectId(userId), 
            status: { $in: ['GRADED', 'RETURNED'] }
          } 
        },
        { $group: { _id: null, avgScore: { $avg: '$percentage' } } },
      ]);

      stats = {
        enrolledCourses,
        upcomingExams,
        myResults,
        averageScore: avgScoreResult[0]?.avgScore?.toFixed(1) || '0',
      };
    }

    res.json({ success: true, data: { stats } });
  } catch (error) {
    logger.error('Get dashboard stats error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stats' } });
  }
});

/**
 * GET /api/v1/dashboard/recent-activity
 * Get recent activity for the dashboard
 */
router.get('/recent-activity', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const { id: userId, role } = req.user!;

    let activities: any[] = [];

    if (role === Role.ADMIN) {
      // Get recent submissions across all exams
      const recentSubmissions = await ExamSubmission.find({
        status: { $ne: 'IN_PROGRESS' },
      })
        .populate('studentId', 'firstName lastName')
        .populate({
          path: 'examId',
          select: 'title',
        })
        .sort({ submittedAt: -1 })
        .limit(limit);

      activities = recentSubmissions.map((s) => ({
        type: 'submission',
        message: `${(s.studentId as any)?.firstName} ${(s.studentId as any)?.lastName} submitted ${(s.examId as any)?.title}`,
        timestamp: s.submittedAt,
      }));
    } else if (role === Role.FACULTY) {
      // Get recent submissions for faculty's exams
      const myExams = await Exam.find({ createdById: userId }).select('_id');
      const examIds = myExams.map((e) => e._id);

      const recentSubmissions = await ExamSubmission.find({
        examId: { $in: examIds },
        status: { $ne: 'IN_PROGRESS' },
      })
        .populate('studentId', 'firstName lastName')
        .populate('examId', 'title')
        .sort({ submittedAt: -1 })
        .limit(limit);

      activities = recentSubmissions.map((s) => ({
        type: 'submission',
        message: `${(s.studentId as any)?.firstName} ${(s.studentId as any)?.lastName} submitted ${(s.examId as any)?.title}`,
        timestamp: s.submittedAt,
      }));
    } else {
      // Student - get their recent submissions
      const recentSubmissions = await ExamSubmission.find({
        studentId: new mongoose.Types.ObjectId(userId),
        status: { $ne: 'IN_PROGRESS' },
      })
        .populate('examId', 'title')
        .sort({ submittedAt: -1 })
        .limit(limit);

      activities = recentSubmissions.map((s) => ({
        type: 'submission',
        message: `You submitted ${(s.examId as any)?.title}`,
        timestamp: s.submittedAt,
        score: s.percentage,
      }));
    }

    res.json({ success: true, data: { activities } });
  } catch (error) {
    logger.error('Get recent activity error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch activity' } });
  }
});

export default router;
