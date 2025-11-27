import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';

import config from './config/index';
import logger from './utils/logger';
import { auditMiddleware } from './middleware/audit';
import wsService from './services/websocket';

// Route imports
import authRoutes from './routes/auth';
import examRoutes from './routes/exams';
import scheduleRoutes from './routes/schedules';
import announcementRoutes from './routes/announcements';
import resultRoutes from './routes/results';
import studentRoutes from './routes/students';
import notificationRoutes from './routes/notifications';

// ============================================
// Express App Setup
// ============================================

const app = express();
const httpServer = createServer(app);

// ============================================
// Middleware
// ============================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
    },
  },
}));

// CORS
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.http(message.trim()),
  },
}));

// Audit logging
app.use(auditMiddleware);

// ============================================
// API Routes
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    },
  });
});

// WebSocket stats endpoint
app.get('/api/v1/ws/stats', (req, res) => {
  res.json({
    success: true,
    data: wsService.getStats(),
  });
});

// API v1 routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/exams', examRoutes);
app.use('/api/v1/schedules', scheduleRoutes);
app.use('/api/v1/announcements', announcementRoutes);
app.use('/api/v1/results', resultRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// ============================================
// Error Handling
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    },
  });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.isDev ? err.message : 'An unexpected error occurred',
      ...(config.isDev && { stack: err.stack }),
    },
  });
});

// ============================================
// Server Startup
// ============================================

const startServer = async () => {
  try {
    // Initialize WebSocket server
    wsService.initialize(httpServer);

    // Start HTTP server
    httpServer.listen(config.port, () => {
      logger.info(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🎓 ExamFlow EIMS Server                                  ║
║                                                            ║
║   REST API:    http://localhost:${config.port}/api/v1            ║
║   WebSocket:   ws://localhost:${config.port}/ws                  ║
║   Health:      http://localhost:${config.port}/health            ║
║                                                            ║
║   Environment: ${config.nodeEnv.padEnd(41)}║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`\n${signal} received. Shutting down gracefully...`);
      
      wsService.shutdown();
      
      httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
