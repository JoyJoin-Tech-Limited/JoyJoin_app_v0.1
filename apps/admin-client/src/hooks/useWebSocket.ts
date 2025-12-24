import { useEffect, useRef, useState, useCallback } from 'react';
import type { WSMessage, WSEventType } from '@/../../shared/wsEvents';

type MessageHandler = (message: WSMessage) => void;

interface UseWebSocketOptions {
  userId?: string;
  eventId?: string;
  onMessage?: MessageHandler;
  autoConnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { userId, eventId, onMessage, autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messageHandlersRef = useRef<Map<WSEventType, Set<MessageHandler>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
        setIsConnected(true);
        setIsReconnecting(false);
        reconnectAttemptsRef.current = 0;

        // 发送用户加入消息
        if (userId || eventId) {
          const joinMessage: WSMessage = {
            type: 'USER_JOINED',
            userId,
            eventId,
            timestamp: new Date().toISOString(),
          };
          ws.send(JSON.stringify(joinMessage));
        }

        // 启动心跳
        const heartbeatInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'PING',
              timestamp: new Date().toISOString(),
            }));
          }
        }, 30000);

        ws.addEventListener('close', () => {
          clearInterval(heartbeatInterval);
        });
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          
          // 调用全局handler
          onMessage?.(message);

          // 调用类型特定的handlers
          const handlers = messageHandlersRef.current.get(message.type);
          if (handlers) {
            handlers.forEach((handler) => handler(message));
          }
        } catch (error) {
          console.error('[WS] Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // 自动重连逻辑
        if (autoConnect && reconnectAttemptsRef.current < 10) {
          setIsReconnecting(true);
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`[WS] Reconnecting in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('[WS] Connection error:', error);
    }
  }, [userId, eventId, onMessage, autoConnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      // 发送离开消息
      if (eventId) {
        try {
          wsRef.current.send(JSON.stringify({
            type: 'USER_LEFT',
            eventId,
            userId,
            timestamp: new Date().toISOString(),
          }));
        } catch (error) {
          console.error('[WS] Error sending leave message:', error);
        }
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsReconnecting(false);
  }, [eventId, userId]);

  const send = useCallback((message: Omit<WSMessage, 'timestamp'>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString(),
      }));
    } else {
      console.warn('[WS] Cannot send message, not connected');
    }
  }, []);

  const subscribe = useCallback((type: WSEventType, handler: MessageHandler) => {
    if (!messageHandlersRef.current.has(type)) {
      messageHandlersRef.current.set(type, new Set());
    }
    messageHandlersRef.current.get(type)!.add(handler);

    // 返回取消订阅函数
    return () => {
      const handlers = messageHandlersRef.current.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          messageHandlersRef.current.delete(type);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect, autoConnect]);

  return {
    isConnected,
    isReconnecting,
    connect,
    disconnect,
    send,
    subscribe,
  };
}
