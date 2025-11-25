import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { JwtPayload } from '../middleware/auth.js';

// ============================================
// Types & Interfaces
// ============================================

interface AuthenticatedWebSocket extends WebSocket {
  id: string;
  userId: string;
  email: string;
  role: string;
  isAlive: boolean;
  subscriptions: Set<string>;
  pendingAcks: Map<string, PendingMessage>;
}

interface PendingMessage {
  id: string;
  event: string;
  data: unknown;
  retryCount: number;
  createdAt: Date;
  timeoutId: NodeJS.Timeout;
}

interface WSMessage {
  type: string;
  payload?: unknown;
  messageId?: string;
}

// ============================================
// WebSocket Service Class
// ============================================

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> Set<clientId>
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // Reliable delivery settings
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 3000, 10000]; // Exponential backoff

  /**
   * Initialize WebSocket server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this),
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });

    // Start heartbeat interval
    this.heartbeatInterval = setInterval(() => {
      this.heartbeat();
    }, config.websocket.heartbeatInterval);

    logger.info('WebSocket server initialized on /ws');
  }

  /**
   * Verify client connection (authentication)
   */
  private verifyClient(
    info: { origin: string; req: { url?: string } },
    callback: (result: boolean, code?: number, message?: string) => void
  ): void {
    try {
      const url = new URL(info.req.url || '', 'ws://localhost');
      const token = url.searchParams.get('token');

      if (!token) {
        callback(false, 401, 'No token provided');
        return;
      }

      jwt.verify(token, config.jwt.secret);
      callback(true);
    } catch (error) {
      logger.warn('WebSocket auth failed:', error);
      callback(false, 401, 'Invalid token');
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: { url?: string }): void {
    const url = new URL(req.url || '', 'ws://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'No token');
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      
      // Upgrade to authenticated WebSocket
      const authWs = ws as AuthenticatedWebSocket;
      authWs.id = uuidv4();
      authWs.userId = decoded.userId;
      authWs.email = decoded.email;
      authWs.role = decoded.role;
      authWs.isAlive = true;
      authWs.subscriptions = new Set();
      authWs.pendingAcks = new Map();

      // Store client
      this.clients.set(authWs.id, authWs);

      // Track user connections
      if (!this.userConnections.has(authWs.userId)) {
        this.userConnections.set(authWs.userId, new Set());
      }
      this.userConnections.get(authWs.userId)!.add(authWs.id);

      logger.info(`WebSocket connected: ${authWs.email} (${authWs.id})`);

      // Send welcome message
      this.sendToClient(authWs, 'connected', {
        clientId: authWs.id,
        message: 'Connected to ExamFlow real-time server',
      });

      // Setup event handlers
      authWs.on('message', (data) => this.handleMessage(authWs, data));
      authWs.on('pong', () => { authWs.isAlive = true; });
      authWs.on('close', () => this.handleDisconnect(authWs));
      authWs.on('error', (error) => {
        logger.error(`WebSocket error for ${authWs.email}:`, error);
      });

    } catch (error) {
      logger.error('WebSocket connection error:', error);
      ws.close(1008, 'Authentication failed');
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(ws: AuthenticatedWebSocket, data: Buffer | ArrayBuffer | Buffer[]): void {
    try {
      const message: WSMessage = JSON.parse(data.toString());
      
      logger.debug(`WS message from ${ws.email}:`, message);

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(ws, message.payload as string);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(ws, message.payload as string);
          break;

        case 'ack':
          this.handleAcknowledgment(ws, message.messageId as string);
          break;

        case 'ping':
          this.sendToClient(ws, 'pong', { timestamp: Date.now() });
          break;

        default:
          logger.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error parsing WebSocket message:', error);
      this.sendToClient(ws, 'error', { message: 'Invalid message format' });
    }
  }

  /**
   * Handle subscription requests
   */
  private handleSubscribe(ws: AuthenticatedWebSocket, channel: string): void {
    if (!channel) return;

    ws.subscriptions.add(channel);
    logger.debug(`${ws.email} subscribed to ${channel}`);
    
    this.sendToClient(ws, 'subscribed', { channel });
  }

  /**
   * Handle unsubscription requests
   */
  private handleUnsubscribe(ws: AuthenticatedWebSocket, channel: string): void {
    if (!channel) return;

    ws.subscriptions.delete(channel);
    logger.debug(`${ws.email} unsubscribed from ${channel}`);
    
    this.sendToClient(ws, 'unsubscribed', { channel });
  }

  /**
   * Handle message acknowledgments (reliable delivery)
   */
  private handleAcknowledgment(ws: AuthenticatedWebSocket, messageId: string): void {
    const pending = ws.pendingAcks.get(messageId);
    
    if (pending) {
      clearTimeout(pending.timeoutId);
      ws.pendingAcks.delete(messageId);
      logger.debug(`Message ${messageId} acknowledged by ${ws.email}`);
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnect(ws: AuthenticatedWebSocket): void {
    // Clear pending acknowledgments
    for (const [, pending] of ws.pendingAcks) {
      clearTimeout(pending.timeoutId);
    }

    // Remove from tracking
    this.clients.delete(ws.id);
    
    const userConns = this.userConnections.get(ws.userId);
    if (userConns) {
      userConns.delete(ws.id);
      if (userConns.size === 0) {
        this.userConnections.delete(ws.userId);
      }
    }

    logger.info(`WebSocket disconnected: ${ws.email} (${ws.id})`);
  }

  /**
   * Send message to a specific client
   */
  sendToClient(ws: AuthenticatedWebSocket, event: string, data: unknown, requireAck = false): void {
    if (ws.readyState !== WebSocket.OPEN) return;

    const messageId = uuidv4();
    const message = JSON.stringify({
      event,
      data,
      messageId,
      timestamp: Date.now(),
      requireAck,
    });

    ws.send(message);

    // Track for reliable delivery if ACK required
    if (requireAck) {
      this.trackPendingAck(ws, messageId, event, data);
    }
  }

  /**
   * Track pending acknowledgment with retry logic
   */
  private trackPendingAck(
    ws: AuthenticatedWebSocket,
    messageId: string,
    event: string,
    data: unknown,
    retryCount = 0
  ): void {
    const delay = this.RETRY_DELAYS[retryCount] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];
    
    const timeoutId = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.pendingAcks.delete(messageId);
        return;
      }

      if (retryCount < this.MAX_RETRIES) {
        logger.warn(`Retrying message ${messageId} to ${ws.email} (attempt ${retryCount + 1})`);
        
        // Resend message
        const message = JSON.stringify({
          event,
          data,
          messageId,
          timestamp: Date.now(),
          requireAck: true,
          retryCount: retryCount + 1,
        });
        ws.send(message);

        // Track next retry
        this.trackPendingAck(ws, messageId, event, data, retryCount + 1);
      } else {
        logger.error(`Message ${messageId} to ${ws.email} failed after ${this.MAX_RETRIES} retries`);
        ws.pendingAcks.delete(messageId);
        // TODO: Store failed message for later delivery or notification
      }
    }, delay);

    ws.pendingAcks.set(messageId, {
      id: messageId,
      event,
      data,
      retryCount,
      createdAt: new Date(),
      timeoutId,
    });
  }

  /**
   * Broadcast to all clients subscribed to a channel
   */
  broadcast(channel: string, event: string, data: unknown, requireAck = false): void {
    let count = 0;
    
    for (const [, client] of this.clients) {
      if (client.subscriptions.has(channel) && client.readyState === WebSocket.OPEN) {
        this.sendToClient(client, event, data, requireAck);
        count++;
      }
    }

    logger.debug(`Broadcast to ${count} clients on channel ${channel}`);
  }

  /**
   * Send to specific user (all their connections)
   */
  sendToUser(userId: string, event: string, data: unknown, requireAck = false): void {
    const connections = this.userConnections.get(userId);
    
    if (!connections) return;

    for (const clientId of connections) {
      const client = this.clients.get(clientId);
      if (client && client.readyState === WebSocket.OPEN) {
        this.sendToClient(client, event, data, requireAck);
      }
    }
  }

  /**
   * Send to users by role
   */
  sendToRole(role: string, event: string, data: unknown, requireAck = false): void {
    for (const [, client] of this.clients) {
      if (client.role === role && client.readyState === WebSocket.OPEN) {
        this.sendToClient(client, event, data, requireAck);
      }
    }
  }

  /**
   * Heartbeat to detect dead connections
   */
  private heartbeat(): void {
    for (const [, client] of this.clients) {
      if (!client.isAlive) {
        logger.debug(`Terminating dead connection: ${client.email}`);
        client.terminate();
        continue;
      }

      client.isAlive = false;
      client.ping();
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    uniqueUsers: number;
    byRole: Record<string, number>;
  } {
    const byRole: Record<string, number> = {};
    
    for (const [, client] of this.clients) {
      byRole[client.role] = (byRole[client.role] || 0) + 1;
    }

    return {
      totalConnections: this.clients.size,
      uniqueUsers: this.userConnections.size,
      byRole,
    };
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    for (const [, client] of this.clients) {
      client.close(1001, 'Server shutting down');
    }

    if (this.wss) {
      this.wss.close();
    }

    logger.info('WebSocket server shut down');
  }
}

// Export singleton instance
export const wsService = new WebSocketService();
export default wsService;
