import { Notification, NotificationType, INotification } from '../models';
import wsService from './websocket';
import logger from '../utils/logger';

class NotificationService {
  /**
   * Create and send notification to a user
   */
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<INotification> {
    try {
      const notification = await Notification.create({
        userId,
        type,
        title,
        message,
        data,
      });

      // Send via WebSocket
      wsService.sendToUser(userId, 'notification', {
        id: notification._id,
        type,
        title,
        message,
        data,
        createdAt: notification.createdAt,
      });

      return notification;
    } catch (error) {
      logger.error('Failed to send notification:', error);
      throw error;
    }
  }

  /**
   * Notify multiple users
   */
  async notifyMany(
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      const notifications = userIds.map((userId) => ({
        userId,
        type,
        title,
        message,
        data,
      }));

      await Notification.insertMany(notifications);

      // Send via WebSocket to each user
      userIds.forEach((userId) => {
        wsService.sendToUser(userId, 'notification', {
          type,
          title,
          message,
          data,
          createdAt: new Date(),
        });
      });
    } catch (error) {
      logger.error('Failed to send notifications:', error);
      throw error;
    }
  }

  /**
   * Notify all users with a specific role
   */
  async notifyRole(
    role: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<void> {
    // This would be used for role-based notifications
    wsService.sendToRole(role, 'notification', {
      type,
      title,
      message,
      data,
      createdAt: new Date(),
    });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<INotification | null> {
    return Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({ userId, isRead: false });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
