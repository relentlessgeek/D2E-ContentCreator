import { useEffect, useRef, useCallback, useState } from 'react';

// SSE Event types matching the backend
export type SSEEventType =
  | 'connected'
  | 'breakdown_start'
  | 'breakdown_complete'
  | 'lesson_start'
  | 'lesson_content_complete'
  | 'lesson_podcast_complete'
  | 'lesson_complete'
  | 'lesson_error'
  | 'generation_complete'
  | 'generation_error'
  | 'heartbeat';

export interface SSEEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
  timestamp?: string;
}

export interface SSEConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnectAttempts: number;
}

export interface UseSSEOptions {
  enabled?: boolean;
  reconnectOnError?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  onEvent?: (event: SSEEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

const DEFAULT_OPTIONS: Required<Omit<UseSSEOptions, 'onEvent' | 'onConnect' | 'onDisconnect' | 'onError'>> = {
  enabled: true,
  reconnectOnError: true,
  maxReconnectAttempts: 5,
  reconnectInterval: 3000,
};

export function useSSE(topicId: number | null, options: UseSSEOptions = {}) {
  const {
    enabled = DEFAULT_OPTIONS.enabled,
    reconnectOnError = DEFAULT_OPTIONS.reconnectOnError,
    maxReconnectAttempts = DEFAULT_OPTIONS.maxReconnectAttempts,
    reconnectInterval = DEFAULT_OPTIONS.reconnectInterval,
    onEvent,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [state, setState] = useState<SSEConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnectAttempts: 0,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Clean up event source
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    if (!topicId || !enabled) return;

    cleanup();

    setState(prev => ({
      ...prev,
      isConnecting: true,
      error: null,
    }));

    const url = `/api/topics/${topicId}/stream`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (!mountedRef.current) return;
      setState({
        isConnected: true,
        isConnecting: false,
        error: null,
        reconnectAttempts: 0,
      });
      onConnect?.();
    };

    eventSource.onerror = (event) => {
      if (!mountedRef.current) return;

      const error = new Error('SSE connection error');
      console.error('[SSE] Connection error:', event);

      setState(prev => {
        const newAttempts = prev.reconnectAttempts + 1;
        const shouldReconnect = reconnectOnError && newAttempts <= maxReconnectAttempts;

        if (shouldReconnect) {
          // Schedule reconnect
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, reconnectInterval);
        }

        return {
          isConnected: false,
          isConnecting: shouldReconnect,
          error: shouldReconnect
            ? `Connection lost. Reconnecting (${newAttempts}/${maxReconnectAttempts})...`
            : 'Connection lost. Max reconnect attempts reached.',
          reconnectAttempts: newAttempts,
        };
      });

      onError?.(error);
      onDisconnect?.();
    };

    // Listen for all event types
    const eventTypes: SSEEventType[] = [
      'connected',
      'breakdown_start',
      'breakdown_complete',
      'lesson_start',
      'lesson_content_complete',
      'lesson_podcast_complete',
      'lesson_complete',
      'lesson_error',
      'generation_complete',
      'generation_error',
    ];

    eventTypes.forEach(eventType => {
      eventSource.addEventListener(eventType, (event: MessageEvent) => {
        if (!mountedRef.current) return;

        try {
          const data = JSON.parse(event.data);
          const sseEvent: SSEEvent = {
            type: eventType,
            data,
            timestamp: new Date().toISOString(),
          };
          onEvent?.(sseEvent);
        } catch (err) {
          console.error(`[SSE] Failed to parse event data for ${eventType}:`, err);
        }
      });
    });
  }, [topicId, enabled, cleanup, onConnect, onDisconnect, onError, onEvent, reconnectOnError, maxReconnectAttempts, reconnectInterval]);

  // Disconnect from SSE
  const disconnect = useCallback(() => {
    cleanup();
    setState({
      isConnected: false,
      isConnecting: false,
      error: null,
      reconnectAttempts: 0,
    });
    onDisconnect?.();
  }, [cleanup, onDisconnect]);

  // Effect to manage connection lifecycle
  useEffect(() => {
    mountedRef.current = true;

    if (enabled && topicId) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [topicId, enabled, connect, cleanup]);

  return {
    ...state,
    connect,
    disconnect,
  };
}

export default useSSE;
