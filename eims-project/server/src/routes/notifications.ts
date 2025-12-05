import { Router, Request, Response } from 'express';
import { Notification } from '../models';
import { authenticate } from '../middleware/auth';
import { mongoIdValidator, paginationValidator } from '../middleware/validation';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/v1/notifications
 * Get user's notifications
 */
router.get('/', authenticate, paginationValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const filter: any = { userId: req.user!.id };

    if (req.query.unread === 'true') {
      filter.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    logger.error('List notifications error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notifications' } });
  }
});

/**
 * GET /api/v1/notifications/unread-count
 * Get unread notification count
 */
router.get('/unread-count', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const count = await Notification.countDocuments({ userId: req.user!.id, isRead: false });

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    logger.error('Get unread count error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get unread count' } });
  }
});

/**
 * PUT /api/v1/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', authenticate, mongoIdValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
      return;
    }

    res.json({ success: true, data: { notification } });
  } catch (error) {
    logger.error('Mark notification read error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark as read' } });
  }
});

/**
 * PUT /api/v1/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    await Notification.updateMany(
      { userId: req.user!.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ success: true, data: { message: 'All notifications marked as read' } });
  } catch (error) {
    logger.error('Mark all notifications read error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to mark all as read' } });
  }
});

/**
 * DELETE /api/v1/notifications/:id
 * Delete a notification
 */
router.delete('/:id', authenticate, mongoIdValidator, async (req: Request, res: Response): Promise<void> => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user!.id,
    });

    if (!notification) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
      return;
    }

    res.json({ success: true, data: { message: 'Notification deleted' } });
  } catch (error) {
    logger.error('Delete notification error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete notification' } });
  }
});

/**
 * DELETE /api/v1/notifications
 * Clear all notifications
 */
router.delete('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    await Notification.deleteMany({ userId: req.user!.id });

    res.json({ success: true, data: { message: 'All notifications cleared' } });
  } catch (error) {
    logger.error('Clear notifications error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to clear notifications' } });
  }
});

export default router;
