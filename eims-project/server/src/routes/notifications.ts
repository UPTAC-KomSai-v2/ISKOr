import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { paginationValidator, idParamValidator } from '../middleware/validation';
import notificationService from '../services/notification';
import logger from '../utils/logger';

const router = Router();

/**
 * @route   GET /api/v1/notifications
 * @desc    Get user's notifications
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  paginationValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;

      const result = await notificationService.getUserNotifications(req.user!.id, {
        page: Number(page),
        limit: Number(limit),
        unreadOnly: unreadOnly === 'true',
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notifications' },
      });
    }
  }
);

/**
 * @route   GET /api/v1/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/unread-count', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.id);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    logger.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get unread count' },
    });
  }
});

/**
 * @route   PUT /api/v1/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put(
  '/:id/read',
  authenticate,
  idParamValidator,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const notification = await notificationService.markAsRead(req.params.id, req.user!.id);

      if (!notification) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Notification not found' },
        });
        return;
      }

      res.json({
        success: true,
        data: notification,
      });
    } catch (error) {
      logger.error('Mark as read error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to mark notification as read' },
      });
    }
  }
);

/**
 * @route   PUT /api/v1/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/read-all', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const count = await notificationService.markAllAsRead(req.user!.id);

    res.json({
      success: true,
      data: { marked: count },
    });
  } catch (error) {
    logger.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to mark notifications as read' },
    });
  }
});

export default router;
