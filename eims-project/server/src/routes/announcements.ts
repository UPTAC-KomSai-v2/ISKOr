import { Router, Request, Response } from 'express';
import { Announcement, AnnouncementType, AnnouncementPriority, Role, Enrollment, EnrollmentStatus, NotificationType } from '../models';
import { authenticate, authorize } from '../middleware/auth';
import { createAnnouncementValidator, mongoIdValidator, paginationValidator } from '../middleware/validation';
import notificationService from '../services/notification';
import wsService from '../services/websocket';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/announcements
 * List announcements
 */
router.get('/', authenticate, paginationValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    let filter: any = { isPublished: true };

    // Filter by role
    if (req.user!.role !== Role.ADMIN) {
      filter.$or = [
        { targetRoles: { $size: 0 } }, // No specific target = everyone
        { targetRoles: req.user!.role },
      ];
    }

    // For students, also filter by enrolled courses
    if (req.user!.role === Role.STUDENT) {
      const enrollments = await Enrollment.find({
        studentId: req.user!.id,
        status: EnrollmentStatus.ENROLLED,
      }).select('courseId');
      
      filter.$or = [
        { courseId: { $exists: false } }, // General announcements
        { courseId: null },
        { courseId: { $in: enrollments.map(e => e.courseId) } }, // Course-specific
      ];
    }

    // Filter by course if specified
    if (req.query.courseId) filter.courseId = req.query.courseId;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.priority) filter.priority = req.query.priority;

    // Exclude expired announcements
    filter.$or = filter.$or || [];
    filter.$and = [
      { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: new Date() } }] },
    ];

    const [announcements, total] = await Promise.all([
      Announcement.find(filter)
        .populate('courseId', 'code name')
        .populate('createdById', 'firstName lastName')
        .sort({ priority: -1, publishedAt: -1 })
        .skip(skip)
        .limit(limit),
      Announcement.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { announcements, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    logger.error('List announcements error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch announcements' } });
  }
});

/**
 * GET /api/v1/announcements/recent
 * Get recent announcements (for dashboard)
 */
router.get('/recent', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;

    let filter: any = { isPublished: true };

    if (req.user!.role === Role.STUDENT) {
      const enrollments = await Enrollment.find({
        studentId: req.user!.id,
        status: EnrollmentStatus.ENROLLED,
      }).select('courseId');
      
      filter.$or = [
        { courseId: null },
        { courseId: { $in: enrollments.map(e => e.courseId) } },
      ];
    }

    const announcements = await Announcement.find(filter)
      .populate('courseId', 'code name')
      .populate('createdById', 'firstName lastName')
      .sort({ publishedAt: -1 })
      .limit(limit);

    res.json({ success: true, data: { announcements } });
  } catch (error) {
    logger.error('Get recent announcements error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch announcements' } });
  }
});

/**
 * GET /api/v1/announcements/:id
 * Get announcement details
 */
router.get('/:id', authenticate, mongoIdValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('courseId', 'code name')
      .populate('examId', 'title type')
      .populate('createdById', 'firstName lastName email');

    if (!announcement) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Announcement not found' } });
      return;
    }

    res.json({ success: true, data: { announcement } });
  } catch (error) {
    logger.error('Get announcement error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch announcement' } });
  }
});

/**
 * POST /api/v1/announcements
 * Create announcement
 */
router.post('/', authenticate, authorize(Role.ADMIN, Role.FACULTY), createAnnouncementValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, content, type, priority, courseId, examId, targetRoles, expiresAt } = req.body;

    const announcement = await Announcement.create({
      title,
      content,
      type: type || AnnouncementType.GENERAL,
      priority: priority || AnnouncementPriority.NORMAL,
      courseId,
      examId,
      createdById: req.user!.id,
      targetRoles: targetRoles || [],
      isPublished: true,
      publishedAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    await announcement.populate('courseId', 'code name');
    await announcement.populate('createdById', 'firstName lastName');

    // Broadcast via WebSocket
    wsService.broadcast('announcement:new', {
      id: announcement._id,
      title: announcement.title,
      type: announcement.type,
      priority: announcement.priority,
      courseCode: (announcement.courseId as any)?.code,
    });

    // Send notifications based on target
    if (courseId) {
      // Notify students in the course
      const enrollments = await Enrollment.find({
        courseId,
        status: EnrollmentStatus.ENROLLED,
      }).select('studentId');
      
      const studentIds = enrollments.map(e => e.studentId.toString());
      await notificationService.notifyMany(
        studentIds,
        NotificationType.ANNOUNCEMENT,
        title,
        content.substring(0, 100) + (content.length > 100 ? '...' : ''),
        { announcementId: announcement._id }
      );
    }

    logger.info(`Announcement created: ${title} by ${req.user!.email}`);

    res.status(201).json({ success: true, data: { announcement } });
  } catch (error) {
    logger.error('Create announcement error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create announcement' } });
  }
});

/**
 * PUT /api/v1/announcements/:id
 * Update announcement
 */
router.put('/:id', authenticate, authorize(Role.ADMIN, Role.FACULTY), mongoIdValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Announcement not found' } });
      return;
    }

    // Check ownership (Faculty can only update their own)
    if (req.user!.role === Role.FACULTY && announcement.createdById.toString() !== req.user!.id) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
      return;
    }

    const { title, content, type, priority, targetRoles, isPublished, expiresAt } = req.body;

    if (title) announcement.title = title;
    if (content) announcement.content = content;
    if (type) announcement.type = type;
    if (priority) announcement.priority = priority;
    if (targetRoles !== undefined) announcement.targetRoles = targetRoles;
    if (isPublished !== undefined) {
      announcement.isPublished = isPublished;
      if (isPublished && !announcement.publishedAt) {
        announcement.publishedAt = new Date();
      }
    }
    if (expiresAt !== undefined) announcement.expiresAt = expiresAt ? new Date(expiresAt) : undefined;

    await announcement.save();
    await announcement.populate('courseId', 'code name');
    await announcement.populate('createdById', 'firstName lastName');

    // Broadcast update
    wsService.broadcast('announcement:updated', { id: announcement._id, title: announcement.title });

    res.json({ success: true, data: { announcement } });
  } catch (error) {
    logger.error('Update announcement error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update announcement' } });
  }
});

/**
 * DELETE /api/v1/announcements/:id
 * Delete announcement
 */
router.delete('/:id', authenticate, authorize(Role.ADMIN, Role.FACULTY), mongoIdValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Announcement not found' } });
      return;
    }

    if (req.user!.role === Role.FACULTY && announcement.createdById.toString() !== req.user!.id) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
      return;
    }

    await announcement.deleteOne();

    wsService.broadcast('announcement:deleted', { id: announcement._id });

    res.json({ success: true, data: { message: 'Announcement deleted successfully' } });
  } catch (error) {
    logger.error('Delete announcement error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete announcement' } });
  }
});

export default router;
