import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import mongoose from 'mongoose';

import config from './config';
import routes from './routes';
import { wsService } from './services/websocket';
import { auditMiddleware } from './middleware/audit';
import logger from './utils/logger';

import insightsRoutes from './routes/insights';
import { initializeExamJobs } from './jobs/examScheduler';

const app = express();
const server = createServer(app);

// Connect to MongoDB
mongoose
  .connect(config.mongodb.uri)
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch((error) => {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  });

mongoose.connection.once('open', () => {
  initializeExamJobs();
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));
app.use(cors(config.cors));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// Audit logging
app.use(auditMiddleware);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// API routes
app.use('/api/v1', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.isDev ? err.message : 'An unexpected error occurred',
    },
  });
});

app.use('/api/insights', insightsRoutes);

// Initialize WebSocket
wsService.initialize(server);

// Start server (LAN enabled)
server.listen(config.port, "0.0.0.0", () => {
  const os = require("os");
  const nets = os.networkInterfaces();
  let lanIP = "localhost";

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === "IPv4" && !net.internal) {
        lanIP = net.address;
      }
    }
  }

  logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ExamFlow EIMS Server                                        ║
║   ─────────────────                                           ║
║                                                               ║
║   🚀 Localhost: http://localhost:${config.port}               
║   🌐 LAN:       http://${lanIP}:${config.port}                 
║   📡 WebSocket: ws://${lanIP}:${config.port}/ws                
║   🔗 MongoDB: ${config.mongodb.uri.substring(0, 40)}...        
║   🌍 Environment: ${config.nodeEnv}                            
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});


// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  wsService.shutdown();
  await mongoose.connection.close();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
