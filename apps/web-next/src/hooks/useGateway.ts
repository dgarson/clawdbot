import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  GatewayRequest,
  GatewayResponse,
  GatewayConnectionState,
  UseGatewayReturn,
  GatewayHelloOk,
} from '../types';

const DEFAULT_GATEWAY_PORT = '18789';
const GATEWAY_URL_OVERRIDE_KEY = 'openclaw.gateway.wsUrl';
const GATEWAY_TOKEN_KEY = 'openclaw.gateway.token';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const RECONNECT_DELAY_BASE = 1000;
const RECONNECT_DELAY_MAX = 30000;
const HELLO_TIMEOUT = 5000;

// Protocol version must match the gateway server.
const PROTOCOL_VERSION = 3;

function resolveGatewayEnvConfig(): { host?: string; port: string } {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const host = env?.OPENCLAW_GATEWAY_HOST?.trim();
  const port = env?.OPENCLAW_GATEWAY_PORT?.trim() || DEFAULT_GATEWAY_PORT;
  return { host: host || undefined, port };
}

function resolveGatewayUrl(): string {
  const { host: gatewayHost, port: gatewayPort } = resolveGatewayEnvConfig();
  if (gatewayHost) {
    return `ws://${gatewayHost}:${gatewayPort}`;
  }

  if (typeof window === 'undefined') {
    return `ws://localhost:${DEFAULT_GATEWAY_PORT}`;
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
    return `${protocol}://${host}:${gatewayPort}`;
  }
  return `${protocol}://${window.location.host}`;
}

function resolveGatewayToken(): string | null {
  try {
    return window.localStorage.getItem(GATEWAY_TOKEN_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * React hook for Gateway WebSocket RPC communication.
 *
 * Implements the full gateway handshake protocol:
 *   1. On open, sends a `connect` req frame with auth token + protocol version
 *   2. Gateway responds with a `res` frame whose payload is `{ type: 'hello-ok', ... }`
 *   3. Subsequent calls use normal req/res frames
 *
 * @example
 * ```tsx
 * const { call, isConnected, connectionState, authFailed, reconnect } = useGateway();
 *
 * const result = await call('config.get', { path: 'auth.profiles' });
 * ```
 */
export function useGateway(): UseGatewayReturn {
  const [connectionState, setConnectionState] = useState<GatewayConnectionState>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const gatewayUrlRef = useRef(resolveGatewayUrl());
  const wsRef = useRef<WebSocket | null>(null);
  // String IDs to match the gateway wire protocol (req/res frames use string ids).
  const pendingCallsRef = useRef<Map<string, PendingCall>>(new Map());
  const nextIdRef = useRef(1);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const hasEverConnectedRef = useRef(false);
  const helloReceivedRef = useRef(false);
  const helloTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const manualCloseRef = useRef(false);
  const hasLoggedUnavailableRef = useRef(false);
  // Tracks the in-flight connect RPC id so we can match its response.
  const connectCallIdRef = useRef<string | null>(null);
  // Sync ref so the close handler can suppress reconnect without a stale closure.
  const authFailedRef = useRef(false);

  const getNextId = useCallback((): string => {
    return String(nextIdRef.current++);
  }, []);

  const clearHelloTimeout = useCallback(() => {
    if (helloTimeoutRef.current) {
      clearTimeout(helloTimeoutRef.current);
      helloTimeoutRef.current = undefined;
    }
  }, []);

  const clearPendingCall = useCallback((id: string) => {
    const pending = pendingCallsRef.current.get(id);
    if (pending) {
      clearTimeout(pending.timeout);
      pendingCallsRef.current.delete(id);
    }
  }, []);

  /**
   * Process incoming WebSocket message.
   *
   * The gateway protocol uses three frame types:
   *   { type: 'req', id, method, params? }  — client → server only
   *   { type: 'res', id, ok, payload?, error? } — server response to a req
   *   { type: 'event', event, payload?, seq? }  — server-initiated events
   *
   * The connect handshake flows as:
   *   client → { type: 'req', id: '<n>', method: 'connect', params: ConnectParams }
   *   server → { type: 'res', id: '<n>', ok: true, payload: { type: 'hello-ok', ... } }
   *          OR { type: 'res', id: '<n>', ok: false, error: ErrorShape } then close
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'res') {
        const response = data as GatewayResponse;

        // Connect handshake response — hello-ok is in the payload.
        if (connectCallIdRef.current !== null && response.id === connectCallIdRef.current) {
          connectCallIdRef.current = null;
          if (response.ok) {
            const helloOk = response.payload as GatewayHelloOk | undefined;
            if (helloOk?.type === 'hello-ok') {
              helloReceivedRef.current = true;
              hasEverConnectedRef.current = true;
              hasLoggedUnavailableRef.current = false;
              clearHelloTimeout();
              setConnectionState('connected');
              setLastError(null);
              setAuthFailed(false);
              setAuthError(null);
              authFailedRef.current = false;
              reconnectAttemptsRef.current = 0;
            }
          } else {
            const errMsg = response.error?.message || 'Connection rejected by gateway';
            // Detect auth errors to suppress reconnect and show the auth modal.
            const isAuthErr = /unauthorized|auth|token|password|forbidden|not allowed/i.test(errMsg);
            if (isAuthErr) {
              authFailedRef.current = true;
              setAuthFailed(true);
              setAuthError(errMsg);
            }
            setLastError(errMsg);
            console.warn('[Gateway] Connect rejected:', errMsg);
          }
          return;
        }

        // Regular RPC response.
        const pending = pendingCallsRef.current.get(response.id);
        if (pending) {
          clearPendingCall(response.id);
          if (response.ok) {
            pending.resolve(response.payload);
          } else {
            pending.reject(new Error(response.error?.message || 'Unknown error'));
          }
        } else {
          console.warn('[Gateway] Received response for unknown call ID:', response.id);
        }
        return;
      }

      // Event frames (connect.challenge is informational; we send connect proactively on open).
      if (data.type === 'event') {
        return;
      }
    } catch (err) {
      console.error('[Gateway] Failed to parse message:', err);
    }
  }, [clearPendingCall, clearHelloTimeout]);

  /**
   * Connect to Gateway WebSocket and perform the connect handshake.
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
    connectCallIdRef.current = null;

    try {
      const ws = new WebSocket(gatewayUrlRef.current);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        setLastError(null);

        // Send the connect handshake immediately. The gateway sends connect.challenge
        // first but doesn't require the client to echo the nonce back — the challenge
        // is informational. We send connect proactively so the server's handshake
        // timer doesn't fire.
        const id = getNextId();
        connectCallIdRef.current = id;
        const token = resolveGatewayToken();
        // Use 'gateway-client' rather than 'openclaw-control-ui' so the gateway
        // doesn't require device identity (Web Crypto / secure context). The
        // control-ui client ID forces device pairing which only works over HTTPS
        // or localhost; token auth via gateway-client works over plain HTTP too.
        const connectParams = {
          minProtocol: PROTOCOL_VERSION,
          maxProtocol: PROTOCOL_VERSION,
          client: {
            id: 'gateway-client',
            mode: 'ui',
            version: '1.0.0',
            platform: 'web',
            displayName: 'OpenClaw Web',
          },
          role: 'operator',
          scopes: [],
          ...(token ? { auth: { token } } : {}),
        };

        clearHelloTimeout();
        // Fallback: if hello-ok never arrives (e.g., older gateway or auth bypass),
        // proceed after HELLO_TIMEOUT so the UI doesn't stay stuck in connecting.
        helloTimeoutRef.current = setTimeout(() => {
          if (!helloReceivedRef.current) {
            console.warn('[Gateway] Hello timeout — proceeding without hello-ok');
            setConnectionState('connected');
          }
        }, HELLO_TIMEOUT);

        try {
          ws.send(JSON.stringify({ type: 'req', id, method: 'connect', params: connectParams } satisfies GatewayRequest));
        } catch {
          connectCallIdRef.current = null;
          // Will fall through to hello timeout fallback.
        }
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
        connectCallIdRef.current = null;

        if (manualCloseRef.current) {
          return;
        }

        setConnectionState('disconnected');

        // Don't auto-reconnect when auth failed — the user needs to fix credentials.
        if (authFailedRef.current) {
          return;
        }

        // If the gateway has never connected, avoid endless retry loops.
        if (!hasEverConnectedRef.current && reconnectAttemptsRef.current >= 1) {
          return;
        }

        // Exponential backoff reconnect.
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
  }, [handleMessage, clearHelloTimeout, getNextId]);

  /**
   * Manual reconnect — re-reads URL and token from localStorage so config
   * changes (e.g., from the auth modal or settings) take effect immediately.
   */
  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    if (wsRef.current) {
      manualCloseRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }

    clearHelloTimeout();
    setLastError(null);
    setAuthFailed(false);
    setAuthError(null);
    authFailedRef.current = false;
    reconnectAttemptsRef.current = 0;
    hasLoggedUnavailableRef.current = false;
    // Re-read URL so settings/modal changes are picked up without a page reload.
    gatewayUrlRef.current = resolveGatewayUrl();
    connect();
  }, [connect, clearHelloTimeout]);

  /**
   * Make an RPC call to the gateway.
   */
  const call = useCallback(async <T = unknown,>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        if (connectionState !== 'connecting') {
          connect();
        }
        reject(new Error(`Not connected to Gateway (${connectionState})`));
        return;
      }

      const id = getNextId();
      const request: GatewayRequest = { type: 'req', id, method, params };

      const timeout = setTimeout(() => {
        clearPendingCall(id);
        reject(new Error(`Call timeout: ${method}`));
      }, 30000);

      pendingCallsRef.current.set(id, {
        resolve: (result) => resolve(result as T),
        reject,
        timeout,
      });

      try {
        wsRef.current.send(JSON.stringify(request));
      } catch (err) {
        clearPendingCall(id);
        reject(err instanceof Error ? err : new Error('Failed to send request'));
      }
    });
  }, [connectionState, connect, getNextId, clearPendingCall]);

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
    authFailed,
    authError,
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
    gatewayInstance = {
      call: async () => {
        throw new Error('Gateway not initialized. Use useGateway hook first.');
      },
    };
  }
  return gatewayInstance;
}

export default useGateway;
