import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  GatewayRequest,
  GatewayResponse,
  GatewayConnectionState,
  UseGatewayReturn,
  GatewayHello,
} from '../types';

const LOCAL_GATEWAY_PORT = '18789';
const GATEWAY_URL_OVERRIDE_KEY = 'openclaw.gateway.wsUrl';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const RECONNECT_DELAY_BASE = 1000;
const RECONNECT_DELAY_MAX = 30000;
const HELLO_TIMEOUT = 5000;

function resolveGatewayUrl(): string {
  if (typeof window === 'undefined') {
    return `ws://localhost:${LOCAL_GATEWAY_PORT}`;
  }

  try {
    const override = window.localStorage.getItem(GATEWAY_URL_OVERRIDE_KEY)?.trim();
    if (override) {
      return override;
    }
  } catch {
    // Ignore localStorage access failures and fall back to derived URL.
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.hostname;
  if (LOCAL_HOSTS.has(host)) {
    return `${protocol}://${host}:${LOCAL_GATEWAY_PORT}`;
  }
  return `${protocol}://${window.location.host}`;
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * React hook for Gateway WebSocket RPC communication.
 *
 * Handles connection lifecycle, hello handshake, reconnection with exponential backoff,
 * and pending call tracking for request/response correlation.
 *
 * @example
 * ```tsx
 * const { call, isConnected, connectionState } = useGateway();
 *
 * const result = await call('config.get', { path: 'auth.profiles' });
 * ```
 */
export function useGateway(): UseGatewayReturn {
  const [connectionState, setConnectionState] = useState<GatewayConnectionState>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);

  const gatewayUrlRef = useRef(resolveGatewayUrl());
  const wsRef = useRef<WebSocket | null>(null);
  const pendingCallsRef = useRef<Map<number, PendingCall>>(new Map());
  const nextIdRef = useRef(1);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const hasEverConnectedRef = useRef(false);
  const helloReceivedRef = useRef(false);
  const helloTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const manualCloseRef = useRef(false);
  const hasLoggedUnavailableRef = useRef(false);

  /**
   * Generate next request ID
   */
  const getNextId = useCallback(() => {
    return nextIdRef.current++;
  }, []);

  const clearHelloTimeout = useCallback(() => {
    if (helloTimeoutRef.current) {
      clearTimeout(helloTimeoutRef.current);
      helloTimeoutRef.current = undefined;
    }
  }, []);

  /**
   * Clear pending call timeout and remove from map
   */
  const clearPendingCall = useCallback((id: number) => {
    const pending = pendingCallsRef.current.get(id);
    if (pending) {
      clearTimeout(pending.timeout);
      pendingCallsRef.current.delete(id);
    }
  }, []);

  /**
   * Process incoming WebSocket message
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      // Handle hello handshake
      if (data.type === 'hello') {
        const hello = data as GatewayHello;
        console.log('[Gateway] Received hello:', hello);
        helloReceivedRef.current = true;
        hasEverConnectedRef.current = true;
        hasLoggedUnavailableRef.current = false;
        clearHelloTimeout();
        setConnectionState('connected');
        setLastError(null);
        reconnectAttemptsRef.current = 0;
        return;
      }

      // Handle RPC response
      const response = data as GatewayResponse;
      if (typeof response.id === 'number') {
        const pending = pendingCallsRef.current.get(response.id);
        if (pending) {
          clearPendingCall(response.id);
          if (response.ok) {
            pending.resolve(response.result);
          } else {
            pending.reject(new Error(response.error || 'Unknown error'));
          }
        } else {
          console.warn('[Gateway] Received response for unknown call ID:', response.id);
        }
      }
    } catch (err) {
      console.error('[Gateway] Failed to parse message:', err);
    }
  }, [clearPendingCall, clearHelloTimeout]);

  /**
   * Connect to Gateway WebSocket
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    manualCloseRef.current = false;
    setConnectionState('connecting');
    helloReceivedRef.current = false;

    try {
      const ws = new WebSocket(gatewayUrlRef.current);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        setLastError(null);
        clearHelloTimeout();
        helloTimeoutRef.current = setTimeout(() => {
          if (!helloReceivedRef.current) {
            console.warn('[Gateway] Hello timeout, proceeding anyway');
            setConnectionState('connected');
          }
        }, HELLO_TIMEOUT);
      });

      ws.addEventListener('message', handleMessage);

      ws.addEventListener('error', () => {
        if (manualCloseRef.current) {
          return;
        }
        const message = `Unable to connect to Gateway at ${gatewayUrlRef.current}`;
        setLastError(message);
        if (!hasLoggedUnavailableRef.current) {
          console.warn(`[Gateway] ${message}`);
          hasLoggedUnavailableRef.current = true;
        }
      });

      ws.addEventListener('close', () => {
        clearHelloTimeout();
        wsRef.current = null;

        if (manualCloseRef.current) {
          return;
        }

        setConnectionState('disconnected');

        // If the gateway has never connected, avoid endless retry loops and let user retry explicitly.
        if (!hasEverConnectedRef.current && reconnectAttemptsRef.current >= 1) {
          return;
        }

        // Schedule reconnect with exponential backoff
        const delay = Math.min(
          RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttemptsRef.current),
          RECONNECT_DELAY_MAX
        );
        reconnectAttemptsRef.current++;

        reconnectTimeoutRef.current = setTimeout(connect, delay);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setLastError(message);
      setConnectionState('error');
    }
  }, [handleMessage, clearHelloTimeout]);

  /**
   * Manual reconnect
   */
  const reconnect = useCallback(() => {
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    // Close existing connection
    if (wsRef.current) {
      manualCloseRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }

    clearHelloTimeout();
    setLastError(null);
    reconnectAttemptsRef.current = 0;
    hasLoggedUnavailableRef.current = false;
    connect();
  }, [connect, clearHelloTimeout]);

  /**
   * Make an RPC call
   */
  const call = useCallback(async <T = unknown,>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        // If not connected, try to connect first
        if (connectionState !== 'connecting') {
          connect();
        }
        reject(new Error(`Not connected to Gateway (${connectionState})`));
        return;
      }

      const id = getNextId();
      const request: GatewayRequest = { id, method, params };

      // Set up timeout
      const timeout = setTimeout(() => {
        clearPendingCall(id);
        reject(new Error(`Call timeout: ${method}`));
      }, 30000);

      // Track pending call
      pendingCallsRef.current.set(id, {
        resolve: (result) => resolve(result as T),
        reject,
        timeout,
      });

      // Send request
      try {
        wsRef.current.send(JSON.stringify(request));
      } catch (err) {
        clearPendingCall(id);
        reject(err instanceof Error ? err : new Error('Failed to send request'));
      }
    });
  }, [connectionState, connect, getNextId, clearPendingCall]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    connect();

    return () => {
      manualCloseRef.current = true;
      clearHelloTimeout();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      // Reject all pending calls
      pendingCallsRef.current.forEach((pending) => {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Connection closed'));
      });
      pendingCallsRef.current.clear();
    };
  }, [connect, clearHelloTimeout]);

  return {
    connectionState,
    call,
    isConnected: connectionState === 'connected',
    lastError,
    reconnect,
  };
}

/**
 * Singleton gateway instance for use outside React components
 */
let gatewayInstance: {
  call: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
} | null = null;

/**
 * Get or create singleton gateway instance
 * Note: This is a simplified version for non-React contexts
 */
export function getGatewaySingleton() {
  if (!gatewayInstance) {
    // Create a simple singleton that will be initialized by the hook
    gatewayInstance = {
      call: async () => {
        throw new Error('Gateway not initialized. Use useGateway hook first.');
      },
    };
  }
  return gatewayInstance;
}

export default useGateway;
