import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import config from '../config';
import logger from '../utils/logger';
import { JwtPayload } from '../middleware/auth';

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  email?: string;
  role?: string;
  isAlive?: boolean;
  subscriptions?: Set<string>;
}

interface WSMessage {
  type: string;
  payload?: any;
  messageId?: string;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<ExtendedWebSocket>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: ExtendedWebSocket, req) => {
      this.handleConnection(ws, req);
    });

    // Heartbeat to detect dead connections
    this.heartbeatInterval = setInterval(() => {
      this.wss?.clients.forEach((ws: ExtendedWebSocket) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, config.websocket.heartbeatInterval);

    logger.info('WebSocket server initialized');
  }

  private handleConnection(ws: ExtendedWebSocket, req: any): void {
    // Authenticate via query param
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      ws.userId = decoded.userId;
      ws.email = decoded.email;
      ws.role = decoded.role;
      ws.isAlive = true;
      ws.subscriptions = new Set();

      // Add to clients map
      if (!this.clients.has(decoded.userId)) {
        this.clients.set(decoded.userId, new Set());
      }
      this.clients.get(decoded.userId)!.add(ws);

      logger.info(`WebSocket connected: ${decoded.email}`);

      // Send connected message
      this.sendToClient(ws, { type: 'connected', payload: { userId: decoded.userId } });

      ws.on('message', (data) => this.handleMessage(ws, data));
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('close', () => this.handleDisconnect(ws));
      ws.on('error', (error) => logger.error('WebSocket error:', error));

    } catch (error) {
      ws.close(4002, 'Invalid token');
    }
  }

  private handleMessage(ws: ExtendedWebSocket, data: any): void {
    try {
      const message: WSMessage = JSON.parse(data.toString());
      logger.debug(`WS message from ${ws.email}:`, message);

      switch (message.type) {
        case 'subscribe':
          ws.subscriptions?.add(message.payload);
          logger.debug(`${ws.email} subscribed to ${message.payload}`);
          break;
        case 'unsubscribe':
          ws.subscriptions?.delete(message.payload);
          break;
        case 'ping':
          this.sendToClient(ws, { type: 'pong' });
          break;
        case 'ack':
          // Handle acknowledgment
          break;
      }
    } catch (error) {
      logger.error('Failed to handle WS message:', error);
    }
  }

  private handleDisconnect(ws: ExtendedWebSocket): void {
    if (ws.userId) {
      const userClients = this.clients.get(ws.userId);
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) {
          this.clients.delete(ws.userId);
        }
      }
      logger.info(`WebSocket disconnected: ${ws.email}`);
    }
  }

  private sendToClient(ws: ExtendedWebSocket, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Send to specific user
   */
  sendToUser(userId: string, event: string, data: any): void {
    const userClients = this.clients.get(userId);
    if (userClients) {
      const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
      userClients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }

  /**
   * Send to all users with specific role
   */
  sendToRole(role: string, event: string, data: any): void {
    const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    this.wss?.clients.forEach((ws: ExtendedWebSocket) => {
      if (ws.readyState === WebSocket.OPEN && ws.role === role) {
        ws.send(message);
      }
    });
  }

  /**
   * Send to all users subscribed to a channel
   */
  sendToChannel(channel: string, event: string, data: any): void {
    const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    this.wss?.clients.forEach((ws: ExtendedWebSocket) => {
      if (ws.readyState === WebSocket.OPEN && ws.subscriptions?.has(channel)) {
        ws.send(message);
      }
    });
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(event: string, data: any): void {
    const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    this.wss?.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * Get connection stats
   */
  getStats(): { totalConnections: number; uniqueUsers: number } {
    return {
      totalConnections: this.wss?.clients.size || 0,
      uniqueUsers: this.clients.size,
    };
  }

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss?.close();
  }
}

export const wsService = new WebSocketService();
export default wsService;
