import { Router, Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { createAnnouncementValidator, paginationValidator, idParamValidator } from '../middleware/validation.js';
import { logEntityChange } from '../middleware/audit.js';
import notificationService from '../services/notification.js';
import wsService from '../services/websocket.js';
import logger from '../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/v1/announcements
 * @desc    Get announcements (filtered by role)
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  paginationValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 10, examId, type } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      let whereClause: any = {
        targetRoles: { contains: req.user!.role },
      };

      if (examId) {
        whereClause.examId = examId;
      }

      if (type) {
        whereClause.type = type;
      }

      const [announcements, total] = await Promise.all([
        prisma.announcement.findMany({
          where: whereClause,
          include: {
            createdBy: { select: { firstName: true, lastName: true } },
            exam: { select: { id: true, title: true } },
          },
          orderBy: { publishedAt: 'desc' },
          skip,
          take: Number(limit),
        }),
        prisma.announcement.count({ where: whereClause }),
      ]);

      res.json({
        success: true,
        data: announcements,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      logger.error('Get announcements error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch announcements' },
      });
    }
  }
);

/**
 * @route   GET /api/v1/announcements/:id
 * @desc    Get announcement by ID
 * @access  Private
 */
router.get('/:id', authenticate, idParamValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const announcement = await prisma.announcement.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        exam: { select: { id: true, title: true, course: { select: { code: true } } } },
      },
    });

    if (!announcement) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Announcement not found' },
      });
      return;
    }

    // Check if user's role is in target roles
    if (!announcement.targetRoles.includes(req.user!.role)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have access to this announcement' },
      });
      return;
    }

    res.json({
      success: true,
      data: announcement,
    });
  } catch (error) {
    logger.error('Get announcement error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch announcement' },
    });
  }
});

/**
 * @route   POST /api/v1/announcements
 * @desc    Create announcement (triggers real-time notification)
 * @access  Private (Faculty, Admin)
 */
router.post(
  '/',
  authenticate,
  authorize(Role.FACULTY, Role.ADMIN),
  createAnnouncementValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { title, content, type, priority, examId, targetRoles, expiresAt } = req.body;

      // If linked to exam, verify it exists and user has permission
      if (examId) {
        const exam = await prisma.exam.findUnique({ where: { id: examId } });
        if (!exam) {
          res.status(400).json({
            success: false,
            error: { code: 'INVALID_EXAM', message: 'Exam not found' },
          });
          return;
        }

        if (req.user!.role !== Role.ADMIN && exam.createdById !== req.user!.id) {
          res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'You can only create announcements for your own exams' },
          });
          return;
        }
      }

      const announcement = await prisma.announcement.create({
        data: {
          title,
          content,
          type,
          priority: priority || 'NORMAL',
          examId,
          createdById: req.user!.id,
          targetRoles,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
        include: {
          createdBy: { select: { firstName: true, lastName: true } },
          exam: { select: { id: true, title: true } },
        },
      });

      // Log creation
      await logEntityChange(req, 'CREATE', 'Announcement', announcement.id, { title, type });

      // Send real-time notifications
      await notificationService.broadcastAnnouncement(
        announcement.id,
        title,
        content,
        targetRoles,
        examId
      );

      // Also broadcast via WebSocket for instant updates
      wsService.broadcast('announcements', 'announcement:new', {
        id: announcement.id,
        title,
        content: content.substring(0, 200),
        type,
        priority: priority || 'NORMAL',
        createdBy: `${announcement.createdBy.firstName} ${announcement.createdBy.lastName}`,
        createdAt: announcement.publishedAt,
      });

      logger.info(`Announcement created: ${title} by ${req.user!.email}`);

      res.status(201).json({
        success: true,
        data: announcement,
      });
    } catch (error) {
      logger.error('Create announcement error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create announcement' },
      });
    }
  }
);

/**
 * @route   PUT /api/v1/announcements/:id
 * @desc    Update announcement
 * @access  Private (Owner, Admin)
 */
router.put(
  '/:id',
  authenticate,
  authorize(Role.FACULTY, Role.ADMIN),
  idParamValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const announcementId = req.params.id;

      const existing = await prisma.announcement.findUnique({ where: { id: announcementId } });

      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Announcement not found' },
        });
        return;
      }

      if (req.user!.role !== Role.ADMIN && existing.createdById !== req.user!.id) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only update your own announcements' },
        });
        return;
      }

      const { title, content, type, priority, targetRoles, expiresAt } = req.body;

      const announcement = await prisma.announcement.update({
        where: { id: announcementId },
        data: {
          ...(title && { title }),
          ...(content && { content }),
          ...(type && { type }),
          ...(priority && { priority }),
          ...(targetRoles && { targetRoles }),
          ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        },
        include: {
          createdBy: { select: { firstName: true, lastName: true } },
        },
      });

      // Log update
      await logEntityChange(req, 'UPDATE', 'Announcement', announcement.id, req.body);

      // Broadcast update
      wsService.broadcast('announcements', 'announcement:updated', {
        id: announcement.id,
        title: announcement.title,
        updatedAt: announcement.updatedAt,
      });

      res.json({
        success: true,
        data: announcement,
      });
    } catch (error) {
      logger.error('Update announcement error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update announcement' },
      });
    }
  }
);

/**
 * @route   DELETE /api/v1/announcements/:id
 * @desc    Delete announcement
 * @access  Private (Owner, Admin)
 */
router.delete(
  '/:id',
  authenticate,
  authorize(Role.FACULTY, Role.ADMIN),
  idParamValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const announcementId = req.params.id;

      const announcement = await prisma.announcement.findUnique({ where: { id: announcementId } });

      if (!announcement) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Announcement not found' },
        });
        return;
      }

      if (req.user!.role !== Role.ADMIN && announcement.createdById !== req.user!.id) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only delete your own announcements' },
        });
        return;
      }

      await prisma.announcement.delete({ where: { id: announcementId } });

      // Log deletion
      await logEntityChange(req, 'DELETE', 'Announcement', announcementId);

      res.json({
        success: true,
        data: { message: 'Announcement deleted successfully' },
      });
    } catch (error) {
      logger.error('Delete announcement error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to delete announcement' },
      });
    }
  }
);

export default router;
