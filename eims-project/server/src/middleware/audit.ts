import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

/**
 * Create an audit log entry
 */
export const createAuditLog = async (
  userId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  changes?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        changes: changes ? JSON.stringify(changes) : null,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    logger.error('Failed to create audit log:', error);
  }
};

/**
 * Middleware to log all requests
 */
export const auditMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Store original end function
  const originalEnd = res.end;

  // Override end function to log after response
  res.end = function (chunk?: unknown, encoding?: unknown): Response {
    // Log the request
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      userId: req.user?.id || null,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    // Only log write operations in audit log
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      createAuditLog(
        req.user?.id || null,
        req.method,
        req.path,
        null,
        { body: req.body },
        logData.ip,
        logData.userAgent
      );
    }

    logger.debug('Request completed', logData);

    // Call original end function
    return originalEnd.call(this, chunk, encoding as BufferEncoding);
  };

  next();
};

/**
 * Helper to log specific entity changes
 */
export const logEntityChange = async (
  req: Request,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entity: string,
  entityId: string,
  changes?: Record<string, unknown>
): Promise<void> => {
  await createAuditLog(
    req.user?.id || null,
    action,
    entity,
    entityId,
    changes,
    req.ip || req.socket.remoteAddress,
    req.get('user-agent')
  );
};
