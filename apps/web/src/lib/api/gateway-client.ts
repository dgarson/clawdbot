/**
 * Gateway WebSocket Client for the Clawdbrain Web UI.
 *
 * This provides a simplified interface to connect to the gateway server
 * and make RPC-style requests. The client handles:
 * - WebSocket connection management
 * - Request/response correlation via message IDs
 * - Automatic reconnection with exponential backoff
 * - Event subscriptions
 */

import { uuidv7 } from "@/lib/ids";

function newMessageId(): string {
  return uuidv7();
}

export type GatewayStatus = "disconnected" | "connecting" | "connected" | "error";

export interface GatewayEvent {
  event: string;
  payload?: unknown;
  seq?: number;
}

export interface GatewayRequestOptions {
  timeout?: number;
}

export interface GatewayClientConfig {
  url?: string;
  token?: string;
  onStatusChange?: (status: GatewayStatus) => void;
  onEvent?: (event: GatewayEvent) => void;
  onError?: (error: Error) => void;
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";
const DEFAULT_TIMEOUT = 30000;
const MAX_BACKOFF = 30000;

class GatewayClient {
  private ws: WebSocket | null = null;
  private config: GatewayClientConfig;
  private status: GatewayStatus = "disconnected";
  private pending = new Map<string, PendingRequest>();
  private backoffMs = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private connectPromise: Promise<void> | null = null;
  private connectResolve: (() => void) | null = null;

  constructor(config: GatewayClientConfig = {}) {
    this.config = config;
  }

  private setStatus(status: GatewayStatus) {
    if (this.status !== status) {
      this.status = status;
      this.config.onStatusChange?.(status);
    }
  }

  getStatus(): GatewayStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.status === "connected" && this.ws?.readyState === WebSocket.OPEN;
  }

  connect(): Promise<void> {
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.stopped = false;
    this.connectPromise = new Promise((resolve) => {
      this.connectResolve = resolve;
      this.doConnect();
    });

    return this.connectPromise;
  }

  private doConnect() {
    if (this.stopped) {return;}

    const url = this.config.url || DEFAULT_GATEWAY_URL;
    this.setStatus("connecting");

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.sendConnect();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = (event) => {
        this.ws = null;
        this.flushPending(new Error(`Connection closed: ${event.reason || "unknown"}`));

        if (!this.stopped) {
          this.setStatus("disconnected");
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.setStatus("error");
        this.config.onError?.(new Error("WebSocket error"));
      };
    } catch (error) {
      this.setStatus("error");
      this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
      this.scheduleReconnect();
    }
  }

  private sendConnect() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {return;}

    const connectParams = {
      minProtocol: 1,
      maxProtocol: 1,
      client: {
        id: "web-ui",
        displayName: "Clawdbrain Web UI",
        version: "1.0.0",
        platform: "web",
        mode: "ui",
      },
      caps: [],
      role: "operator",
      scopes: ["operator.admin"],
      auth: this.config.token ? { token: this.config.token } : undefined,
    };

    const frame = {
      type: "req",
      id: newMessageId(),
      method: "connect",
      params: connectParams,
    };

    this.ws.send(JSON.stringify(frame));

    // Handle connect response
    const originalHandler = this.handleMessage.bind(this);
    const connectHandler = (data: string) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.id === frame.id) {
          if (parsed.ok) {
            this.setStatus("connected");
            this.backoffMs = 1000;
            this.connectResolve?.();
            this.connectPromise = null;
            this.connectResolve = null;
          } else {
            this.setStatus("error");
            this.config.onError?.(new Error(parsed.error?.message || "Connect failed"));
          }
          // Restore original handler
          this.handleMessage = originalHandler;
          return;
        }
      } catch {
        // Ignore parse errors
      }
      originalHandler(data);
    };

    this.handleMessage = connectHandler;
  }

  private handleMessage(data: string) {
    try {
      const parsed = JSON.parse(data);

      // Handle events
      if (parsed.event) {
        this.config.onEvent?.({
          event: parsed.event,
          payload: parsed.payload,
          seq: parsed.seq,
        });
        return;
      }

      // Handle responses
      if (parsed.id) {
        const pending = this.pending.get(parsed.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(parsed.id);

          if (parsed.ok) {
            pending.resolve(parsed.payload);
          } else {
            pending.reject(new Error(parsed.error?.message || "Request failed"));
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) {return;}

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF);
      this.doConnect();
    }, this.backoffMs);
  }

  private flushPending(error: Error) {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  stop() {
    this.stopped = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.flushPending(new Error("Client stopped"));
    this.setStatus("disconnected");
    this.connectPromise = null;
    this.connectResolve = null;
  }

  async request<T = unknown>(
    method: string,
    params?: unknown,
    options?: GatewayRequestOptions
  ): Promise<T> {
    if (!this.isConnected()) {
      throw new Error("Not connected to gateway");
    }

    const id = newMessageId();
    const timeout = options?.timeout || DEFAULT_TIMEOUT;

    const frame = {
      type: "req",
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeout);

      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });

      this.ws!.send(JSON.stringify(frame));
    });
  }
}

// Singleton instance for the app
let gatewayClient: GatewayClient | null = null;

export function getGatewayClient(config?: GatewayClientConfig): GatewayClient {
  if (!gatewayClient) {
    gatewayClient = new GatewayClient(config);
  }
  return gatewayClient;
}

export function createGatewayClient(config?: GatewayClientConfig): GatewayClient {
  return new GatewayClient(config);
}

export { GatewayClient };
