import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WSMessage {
  event: string;
  data: any;
  timestamp: string;
}

export const useWebSocket = (onMessage?: (msg: WSMessage) => void) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isConnectingRef = useRef(false);
  const onMessageRef = useRef(onMessage);

  const [status, setStatus] = useState<WSStatus>('disconnected');
  const { accessToken, isAuthenticated } = useAuthStore();

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (!accessToken || !isAuthenticated || isConnectingRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    isConnectingRef.current = true;
    setStatus('connecting');

    const ws = new WebSocket(`ws://localhost:3001/ws?token=${accessToken}`);

    ws.onopen = () => {
      setStatus('connected');
      isConnectingRef.current = false;
      // Subscribe to channels
      ws.send(JSON.stringify({ type: 'subscribe', payload: 'announcements' }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        onMessageRef.current?.(message);
      } catch (e) {
        console.error('WebSocket parse error:', e);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;
      isConnectingRef.current = false;
    };

    ws.onerror = () => {
      setStatus('error');
      isConnectingRef.current = false;
    };

    wsRef.current = ws;
  }, [accessToken, isAuthenticated]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000);
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      const timer = setTimeout(connect, 100);
      return () => clearTimeout(timer);
    } else {
      disconnect();
    }
  }, [isAuthenticated, accessToken, connect, disconnect]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { status, connect, disconnect };
};

export default useWebSocket;
