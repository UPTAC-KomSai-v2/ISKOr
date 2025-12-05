import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models';
import logger from '../utils/logger';

/**
 * Create an audit log entry
 */
export const createAuditLog = async (
  userId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  changes?: Record<string, any>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> => {
  try {
    await AuditLog.create({
      userId: userId || undefined,
      action,
      entityType,
      entityId,
      changes,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    logger.error('Failed to create audit log:', error);
  }
};

/**
 * Audit middleware - logs all mutating requests
 */
export const auditMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const originalSend = res.send;

  res.send = function (body: any) {
    // Only log successful mutating operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && res.statusCode < 400) {
      const action = getActionFromMethod(req.method);
      const entityType = getEntityTypeFromPath(req.path);
      
      createAuditLog(
        req.user?.id || null,
        action,
        entityType,
        req.params.id,
        req.method === 'DELETE' ? undefined : req.body,
        req.ip,
        req.get('user-agent')
      );
    }

    return originalSend.call(this, body);
  };

  next();
};

const getActionFromMethod = (method: string): string => {
  switch (method) {
    case 'POST': return 'CREATE';
    case 'PUT':
    case 'PATCH': return 'UPDATE';
    case 'DELETE': return 'DELETE';
    default: return 'UNKNOWN';
  }
};

const getEntityTypeFromPath = (path: string): string => {
  const parts = path.split('/').filter(Boolean);
  // e.g., /api/v1/exams -> exams
  return parts[2] || 'unknown';
};
