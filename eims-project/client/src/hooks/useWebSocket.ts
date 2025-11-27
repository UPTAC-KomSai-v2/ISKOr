import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import type { WSMessage, WSConnectionStatus } from '@/types';

interface UseWebSocketOptions {
  onMessage?: (message: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  status: WSConnectionStatus;
  send: (type: string, payload?: unknown) => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  acknowledge: (messageId: string) => void;
  connect: () => void;
  disconnect: () => void;
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isConnectingRef = useRef(false);

  // Store callbacks in refs to avoid re-creating connect function
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = onMessage;
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    onErrorRef.current = onError;
  }, [onMessage, onConnect, onDisconnect, onError]);

  const [status, setStatus] = useState<WSConnectionStatus>('disconnected');
  const { accessToken, isAuthenticated } = useAuthStore();

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    
    isConnectingRef.current = false;
    setStatus('disconnected');
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!accessToken || !isAuthenticated) {
      console.log('WebSocket: Not authenticated, skipping connection');
      return;
    }

    // Prevent multiple simultaneous connections
    if (isConnectingRef.current) {
      console.log('WebSocket: Already connecting, skipping');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket: Already connected');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket: Connection in progress');
      return;
    }

    isConnectingRef.current = true;
    setStatus('connecting');
    console.log('WebSocket: Connecting...');

    const ws = new WebSocket(`${WS_URL}?token=${accessToken}`);

    ws.onopen = () => {
      console.log('WebSocket: Connected');
      setStatus('connected');
      reconnectCountRef.current = 0;
      isConnectingRef.current = false;
      onConnectRef.current?.();
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        console.log('WebSocket message:', message.event, message.data);

        // Auto-acknowledge if required
        if (message.requireAck && message.messageId) {
          ws.send(JSON.stringify({
            type: 'ack',
            messageId: message.messageId,
          }));
        }

        onMessageRef.current?.(message);
      } catch (error) {
        console.error('WebSocket: Failed to parse message', error);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket: Disconnected', event.code, event.reason);
      setStatus('disconnected');
      wsRef.current = null;
      isConnectingRef.current = false;
      onDisconnectRef.current?.();

      // Attempt reconnection only if we didn't deliberately close
      if (event.code !== 1000 && reconnectCountRef.current < reconnectAttempts && isAuthenticated) {
        reconnectCountRef.current++;
        const delay = reconnectInterval * Math.pow(2, reconnectCountRef.current - 1);
        console.log(`WebSocket: Reconnecting in ${delay}ms (attempt ${reconnectCountRef.current})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('error');
      isConnectingRef.current = false;
      onErrorRef.current?.(error);
    };

    wsRef.current = ws;
  }, [accessToken, isAuthenticated, reconnectAttempts, reconnectInterval]);

  // Send message
  const send = useCallback((type: string, payload?: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('WebSocket: Not connected, cannot send message');
    }
  }, []);

  // Subscribe to channel
  const subscribe = useCallback((channel: string) => {
    send('subscribe', channel);
  }, [send]);

  // Unsubscribe from channel
  const unsubscribe = useCallback((channel: string) => {
    send('unsubscribe', channel);
  }, [send]);

  // Acknowledge message
  const acknowledge = useCallback((messageId: string) => {
    send('ack', { messageId });
  }, [send]);

  // Auto-connect on mount or when auth changes
  useEffect(() => {
    if (autoConnect && isAuthenticated && accessToken) {
      // Small delay to avoid race conditions with auth state
      const timer = setTimeout(() => {
        connect();
      }, 100);
      return () => clearTimeout(timer);
    } else if (!isAuthenticated) {
      disconnect();
    }
  }, [autoConnect, isAuthenticated, accessToken]); // Removed connect/disconnect from deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []); // Only run on unmount

  return {
    status,
    send,
    subscribe,
    unsubscribe,
    acknowledge,
    connect,
    disconnect,
  };
};

export default useWebSocket;
