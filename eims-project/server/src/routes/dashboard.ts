import { Router, Request, Response } from 'express';
import { User, Course, Exam, ExamResult, Announcement, Enrollment, Role, EnrollmentStatus, ExamStatus, ResultStatus } from '../models';
import { authenticate } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/dashboard/stats
 * Get dashboard statistics based on user role
 */
router.get('/stats', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    let stats: any = {};

    if (role === Role.ADMIN) {
      const [totalUsers, totalStudents, totalFaculty, totalCourses, totalExams, activeExams] = await Promise.all([
        User.countDocuments({ isActive: true }),
        User.countDocuments({ role: Role.STUDENT, isActive: true }),
        User.countDocuments({ role: Role.FACULTY, isActive: true }),
        Course.countDocuments({ isActive: true }),
        Exam.countDocuments(),
        Exam.countDocuments({ status: { $in: [ExamStatus.SCHEDULED, ExamStatus.ONGOING] } }),
      ]);

      stats = {
        totalUsers,
        totalStudents,
        totalFaculty,
        totalCourses,
        totalExams,
        activeExams,
      };
    } else if (role === Role.FACULTY) {
      const [myCourses, myExams, pendingResults, totalStudents] = await Promise.all([
        Course.countDocuments({ facultyId: userId, isActive: true }),
        Exam.countDocuments({ createdById: userId }),
        ExamResult.countDocuments({ status: ResultStatus.PENDING }),
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
      const enrollments = await Enrollment.find({ studentId: userId, status: EnrollmentStatus.ENROLLED }).select('courseId');
      const courseIds = enrollments.map(e => e.courseId);

      const [enrolledCourses, upcomingExams, myResults, averageScore] = await Promise.all([
        enrollments.length,
        Exam.countDocuments({
          courseId: { $in: courseIds },
          status: ExamStatus.SCHEDULED,
          'schedules.startTime': { $gte: new Date() },
        }),
        ExamResult.countDocuments({ studentId: userId, status: ResultStatus.PUBLISHED }),
        ExamResult.aggregate([
          { $match: { studentId: userId, status: ResultStatus.PUBLISHED } },
          { $group: { _id: null, avgScore: { $avg: '$score' } } },
        ]),
      ]);

      stats = {
        enrolledCourses,
        upcomingExams,
        myResults,
        averageScore: averageScore[0]?.avgScore?.toFixed(2) || 0,
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
    const userId = req.user!.id;
    const role = req.user!.role;

    let filter: any = {};

    if (role === Role.STUDENT) {
      const enrollments = await Enrollment.find({ studentId: userId, status: EnrollmentStatus.ENROLLED }).select('courseId');
      filter.courseId = { $in: enrollments.map(e => e.courseId) };
    } else if (role === Role.FACULTY) {
      filter.createdById = userId;
    }

    const [recentExams, recentAnnouncements] = await Promise.all([
      Exam.find(filter)
        .populate('courseId', 'code name')
        .sort({ updatedAt: -1 })
        .limit(limit / 2),
      Announcement.find({ isPublished: true })
        .populate('courseId', 'code')
        .sort({ publishedAt: -1 })
        .limit(limit / 2),
    ]);

    // Combine and sort by date
    const activity = [
      ...recentExams.map(e => ({
        type: 'exam',
        id: e._id,
        title: e.title,
        course: (e.courseId as any)?.code,
        status: e.status,
        date: e.updatedAt,
      })),
      ...recentAnnouncements.map(a => ({
        type: 'announcement',
        id: a._id,
        title: a.title,
        course: (a.courseId as any)?.code,
        priority: a.priority,
        date: a.publishedAt,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit);

    res.json({ success: true, data: { activity } });
  } catch (error) {
    logger.error('Get recent activity error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch activity' } });
  }
});

export default router;
