import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  GatewayRequest,
  GatewayResponse,
  GatewayConnectionState,
  UseGatewayReturn,
  GatewayHello,
} from '../types';

const DEFAULT_GATEWAY_URL = 'ws://localhost:18789';
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? DEFAULT_GATEWAY_URL;
const RECONNECT_DELAY_BASE = 1000;
const RECONNECT_DELAY_MAX = 30000;
const HELLO_TIMEOUT = 5000;

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
  
  const wsRef = useRef<WebSocket | null>(null);
  const pendingCallsRef = useRef<Map<number, PendingCall>>(new Map());
  const nextIdRef = useRef(1);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const helloReceivedRef = useRef(false);
  const manualCloseRef = useRef(false);
  const connectionPromiseRef = useRef<Promise<void> | null>(null);
  const connectionResolveRef = useRef<(() => void) | null>(null);
  const connectionRejectRef = useRef<((error: Error) => void) | null>(null);

  const clearConnectionPromise = useCallback(() => {
    connectionPromiseRef.current = null;
    connectionResolveRef.current = null;
    connectionRejectRef.current = null;
  }, []);

  const ensureConnectionPromise = useCallback(() => {
    if (!connectionPromiseRef.current) {
      connectionPromiseRef.current = new Promise<void>((resolve, reject) => {
        connectionResolveRef.current = resolve;
        connectionRejectRef.current = reject;
      });
    }
    return connectionPromiseRef.current;
  }, []);

  /**
   * Generate next request ID
   */
  const getNextId = useCallback(() => {
    return nextIdRef.current++;
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
        setConnectionState('connected');
        setLastError(null);
        reconnectAttemptsRef.current = 0;
        connectionResolveRef.current?.();
        clearConnectionPromise();
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
  }, [clearConnectionPromise, clearPendingCall]);

  /**
   * Connect to Gateway WebSocket
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    manualCloseRef.current = false;
    setConnectionState('connecting');
    helloReceivedRef.current = false;

    try {
      const ws = new WebSocket(GATEWAY_URL);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        console.log('[Gateway] WebSocket connected, waiting for hello...');
        // Wait for hello handshake
        setTimeout(() => {
          if (!helloReceivedRef.current) {
            const error = new Error('Gateway hello handshake timeout');
            console.warn('[Gateway] Hello timeout, closing socket');
            setLastError(error.message);
            setConnectionState('error');
            connectionRejectRef.current?.(error);
            clearConnectionPromise();
            ws.close();
          }
        }, HELLO_TIMEOUT);
      });

      ws.addEventListener('message', handleMessage);

      ws.addEventListener('error', () => {
        console.error('[Gateway] WebSocket error');
        setLastError('Connection error');
        setConnectionState('error');
        connectionRejectRef.current?.(new Error('Connection error'));
        clearConnectionPromise();
      });

      ws.addEventListener('close', () => {
        console.log('[Gateway] WebSocket closed');
        wsRef.current = null;

        if (!manualCloseRef.current) {
          setConnectionState('disconnected');
          
          // Schedule reconnect with exponential backoff
          const delay = Math.min(
            RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttemptsRef.current),
            RECONNECT_DELAY_MAX
          );
          reconnectAttemptsRef.current++;
          
          console.log(`[Gateway] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          connectionRejectRef.current?.(new Error('Connection closed'));
          clearConnectionPromise();
        }
      });
    } catch (err) {
      console.error('[Gateway] Failed to create WebSocket:', err);
      setLastError(err instanceof Error ? err.message : 'Connection failed');
      setConnectionState('error');
      connectionRejectRef.current?.(new Error('Connection failed'));
      clearConnectionPromise();
    }
  }, [clearConnectionPromise, handleMessage]);

  /**
   * Manual reconnect
   */
  const reconnect = useCallback(() => {
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    // Close existing connection
    if (wsRef.current) {
      manualCloseRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }
    
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  /**
   * Make an RPC call
   */
  const call = useCallback(async <T = unknown,>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const waitForConnection = async () => {
        if (wsRef.current?.readyState === WebSocket.OPEN && helloReceivedRef.current) {
          return;
        }

        if (connectionState !== 'connecting') {
          connect();
        }

        await ensureConnectionPromise();
      };

      void waitForConnection()
        .then(() => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !helloReceivedRef.current) {
            reject(new Error('Not connected to Gateway'));
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
            reject(err);
          }
        })
        .catch((err) => {
          reject(err instanceof Error ? err : new Error('Not connected to Gateway'));
        });
    });
  }, [clearPendingCall, connect, connectionState, ensureConnectionPromise, getNextId]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    connect();

    return () => {
      manualCloseRef.current = true;
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
  }, [connect]);

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
