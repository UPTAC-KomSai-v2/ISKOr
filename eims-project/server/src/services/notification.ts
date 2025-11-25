import { PrismaClient, Notification, Role } from '@prisma/client';
import wsService from './websocket.js';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

// ============================================
// Types
// ============================================

interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  announcementId?: string;
  examId?: string;
  resultId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Notification Service
// ============================================

class NotificationService {
  /**
   * Create and send notification to a single user
   */
  async notifyUser(userId: string, payload: NotificationPayload): Promise<Notification> {
    // Store in database
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        announcementId: payload.announcementId,
      },
    });

    // Send via WebSocket
    wsService.sendToUser(userId, 'notification', {
      id: notification.id,
      ...payload,
      createdAt: notification.createdAt,
    }, true); // Require acknowledgment for reliability

    logger.debug(`Notification sent to user ${userId}: ${payload.title}`);

    return notification;
  }

  /**
   * Notify multiple users
   */
  async notifyUsers(userIds: string[], payload: NotificationPayload): Promise<void> {
    const notifications = await Promise.all(
      userIds.map((userId) => this.notifyUser(userId, payload))
    );

    logger.info(`Sent ${notifications.length} notifications: ${payload.title}`);
  }

  /**
   * Notify all users with a specific role
   */
  async notifyRole(role: Role, payload: NotificationPayload): Promise<void> {
    // Get all users with this role
    const users = await prisma.user.findMany({
      where: { role, isActive: true },
      select: { id: true },
    });

    // Create notifications in bulk
    await prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        announcementId: payload.announcementId,
      })),
    });

    // Send via WebSocket
    wsService.sendToRole(role, 'notification', payload, true);

    logger.info(`Notified ${users.length} ${role}s: ${payload.title}`);
  }

  /**
   * Notify students enrolled in a course
   */
  async notifyCourseStudents(courseId: string, payload: NotificationPayload): Promise<void> {
    // Get enrolled students
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId, status: 'ENROLLED' },
      include: {
        student: {
          include: { user: { select: { id: true } } },
        },
      },
    });

    const userIds = enrollments.map((e) => e.student.user.id);
    await this.notifyUsers(userIds, payload);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification | null> {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) return null;

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(
    userId: string,
    options: { page?: number; limit?: number; unreadOnly?: boolean } = {}
  ) {
    const { page = 1, limit = 20, unreadOnly = false } = options;
    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(unreadOnly && { isRead: false }),
    };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          announcement: {
            select: { id: true, title: true, examId: true },
          },
        },
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Broadcast announcement notification
   */
  async broadcastAnnouncement(
    announcementId: string,
    title: string,
    content: string,
    targetRoles: string,
    examId?: string
  ): Promise<void> {
    const roles = targetRoles.split(',').map((r) => r.trim()) as Role[];

    for (const role of roles) {
      await this.notifyRole(role, {
        type: 'announcement',
        title,
        message: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
        announcementId,
        examId,
      });
    }
  }

  /**
   * Notify about schedule changes
   */
  async notifyScheduleChange(
    examId: string,
    examTitle: string,
    changeDescription: string
  ): Promise<void> {
    // Get course and enrolled students
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        course: {
          include: {
            enrollments: {
              where: { status: 'ENROLLED' },
              include: {
                student: {
                  include: { user: { select: { id: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!exam) return;

    const userIds = exam.course.enrollments.map((e) => e.student.user.id);

    await this.notifyUsers(userIds, {
      type: 'schedule_update',
      title: `Schedule Update: ${examTitle}`,
      message: changeDescription,
      examId,
    });
  }

  /**
   * Notify about result publication
   */
  async notifyResultPublished(
    examId: string,
    examTitle: string,
    studentId: string,
    resultId: string
  ): Promise<void> {
    // Get student's user ID
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { id: true } } },
    });

    if (!student) return;

    await this.notifyUser(student.user.id, {
      type: 'result_published',
      title: `Results Available: ${examTitle}`,
      message: 'Your exam results have been published. Click to view.',
      examId,
      resultId,
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
