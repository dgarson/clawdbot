export interface ChatMessage {
  id?: string;
  role: string;
  content: string;
}

// =====================================================================
// TYPES (matching OpenClaw hook/event shapes)
// =====================================================================

export type OpenClawEventType = "command" | "session" | "agent" | "gateway" | "tool" | "workflow";

export type OpenClawEventAction =
  | "new" | "reset" | "stop" | "send" | "retry"
  | "created" | "resumed" | "ended" | "pruned"
  | "thinking" | "streaming" | "tool_call" | "tool_result" | "complete" | "error"
  | "startup" | "shutdown" | "connected" | "disconnected" | "message"
  | "pending" | "approved" | "rejected" | "executing" | "executed"
  | "started" | "paused" | "resumed" | "cancelled" | "waiting_approval" | "waiting_input";

export interface OpenClawHookEvent<T = unknown> {
  type: OpenClawEventType;
  action: OpenClawEventAction;
  sessionKey: string;
  timestamp: Date;
  messages: string[];
  data?: T;
  context: {
    sessionEntry?: unknown;
    sessionId?: string;
    sessionFile?: string;
    commandSource?: "whatsapp" | "telegram" | "discord" | "slack" | "webchat" | "cli";
    senderId?: string;
    workspaceDir?: string;
    bootstrapFiles?: unknown[];
    cfg?: OpenClawConfig;
    agentId?: string;
  };
}

function isOpenClawHookEvent(value: unknown): value is OpenClawHookEvent {
  if (!value || typeof value !== "object") {return false;}
  const event = value as OpenClawHookEvent;
  return (
    typeof event.type === "string" &&
    typeof event.action === "string" &&
    typeof event.sessionKey === "string"
  );
}

export interface OpenClawConfig {
  gateway?: {
    port?: number;
    token?: string;
    bind?: "loopback" | "tailnet" | "lan";
  };
  hooks?: {
    internal?: {
      enabled?: boolean;
      entries?: Record<string, { enabled?: boolean; env?: Record<string, string> }>;
    };
  };
  tools?: {
    security?: "allowlist" | "ask" | "deny";
    elevated?: string[];
    allowlist?: string[];
  };
}

export type OpenClawHookHandler<T = unknown> = (event: OpenClawHookEvent<T>) => Promise<void> | void;

export interface ToolCallEventData {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  risk?: "low" | "medium" | "high";
}

export interface ToolResultEventData {
  toolCallId: string;
  toolName: string;
  result: unknown;
  error?: string;
  executionTime?: number;
}

export interface OpenClawEvents {
  "command:new": OpenClawHookEvent<{ reason?: string }>;
  "command:reset": OpenClawHookEvent<{ clearHistory?: boolean }>;
  "command:stop": OpenClawHookEvent<{ immediate?: boolean }>;
  "command:send": OpenClawHookEvent<{ content: string; attachments?: unknown[] }>;

  "session:created": OpenClawHookEvent<{ sessionId: string }>;
  "session:resumed": OpenClawHookEvent<{ sessionId: string; messages: ChatMessage[] }>;
  "session:ended": OpenClawHookEvent<{ sessionId: string; reason?: string }>;

  "agent:thinking": OpenClawHookEvent<{ thought?: string }>;
  "agent:streaming": OpenClawHookEvent<{ delta: string; messageId: string }>;
  "agent:tool_call": OpenClawHookEvent<ToolCallEventData>;
  "agent:tool_result": OpenClawHookEvent<ToolResultEventData>;
  "agent:complete": OpenClawHookEvent<{ messageId: string; content: string }>;
  "agent:error": OpenClawHookEvent<{ error: unknown; recoverable?: boolean }>;

  "tool:pending": OpenClawHookEvent<ToolCallEventData>;
  "tool:approved": OpenClawHookEvent<{ toolCallId: string; modifiedArgs?: unknown }>;
  "tool:rejected": OpenClawHookEvent<{ toolCallId: string; reason?: string }>;
  "tool:executing": OpenClawHookEvent<{ toolCallId: string }>;
  "tool:executed": OpenClawHookEvent<ToolResultEventData>;

  "workflow:started": OpenClawHookEvent<{ workflowId: string }>;
  "workflow:paused": OpenClawHookEvent<{ reason?: string }>;
  "workflow:resumed": OpenClawHookEvent;
  "workflow:cancelled": OpenClawHookEvent<{ reason?: string }>;
  "workflow:waiting_approval": OpenClawHookEvent<{ pendingTools: string[] }>;
  "workflow:waiting_input": OpenClawHookEvent<{ questionId: string }>;

  "gateway:connected": OpenClawHookEvent<{ url: string }>;
  "gateway:disconnected": OpenClawHookEvent<{ reason?: string }>;
  "gateway:message": OpenClawHookEvent<{ raw: unknown }>;
}

type Listener<T> = (data: T) => void;

// =====================================================================
// EVENT BUS (browser-safe)
// =====================================================================

export class OpenClawEventBus {
  private listeners = new Map<string, Set<Listener<unknown>>>();
  private hookHandlers = new Map<string, Set<OpenClawHookHandler>>();
  private history: OpenClawHookEvent[] = [];
  private maxHistorySize = 1000;

  on<K extends keyof OpenClawEvents>(event: K, handler: Listener<OpenClawEvents[K]>): this {
    const key = String(event);
    if (!this.listeners.has(key)) {this.listeners.set(key, new Set());}
    this.listeners.get(key)!.add(handler as Listener<unknown>);
    return this;
  }

  once<K extends keyof OpenClawEvents>(event: K, handler: Listener<OpenClawEvents[K]>): this {
    const wrapped: Listener<OpenClawEvents[K]> = (data) => {
      this.off(event, wrapped);
      handler(data);
    };
    return this.on(event, wrapped);
  }

  off<K extends keyof OpenClawEvents>(event: K, handler: Listener<OpenClawEvents[K]>): this {
    const key = String(event);
    this.listeners.get(key)?.delete(handler as Listener<unknown>);
    return this;
  }

  emit<K extends keyof OpenClawEvents>(event: K, data: OpenClawEvents[K]): boolean {
    this.history.push(data);
    if (this.history.length > this.maxHistorySize) {this.history.shift();}

    const key = String(event);
    const handlers = this.listeners.get(key);
    if (!handlers || handlers.size === 0) {return false;}

    handlers.forEach((h) => {
      try {
        (h as Listener<OpenClawEvents[K]>)(data);
      } catch (err) {
        console.error("[OpenClaw] event handler error:", err);
      }
    });
    return true;
  }

  registerHook(eventPattern: string, handler: OpenClawHookHandler): () => void {
    if (!this.hookHandlers.has(eventPattern)) {this.hookHandlers.set(eventPattern, new Set());}
    this.hookHandlers.get(eventPattern)!.add(handler);
    return () => {
      this.hookHandlers.get(eventPattern)?.delete(handler);
    };
  }

  async triggerHooks(event: OpenClawHookEvent): Promise<void> {
    const eventKey = `${event.type}:${event.action}`;
    const handlers = [
      ...(this.hookHandlers.get(eventKey) ?? []),
      ...(this.hookHandlers.get(event.type) ?? []),
      ...(this.hookHandlers.get("*") ?? []),
    ];

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[OpenClaw] hook handler error for ${eventKey}:`, err);
      }
    }
  }

  getHistory(filter?: { type?: OpenClawEventType; action?: OpenClawEventAction }): OpenClawHookEvent[] {
    if (!filter) {return [...this.history];}
    return this.history.filter((e) => {
      if (filter.type && e.type !== filter.type) {return false;}
      if (filter.action && e.action !== filter.action) {return false;}
      return true;
    });
  }

  clearHistory(): void {
    this.history = [];
  }
}

// =====================================================================
// GATEWAY WEBSOCKET CLIENT
// =====================================================================

export interface GatewayMessage {
  type: "event" | "rpc" | "response" | "error";
  id?: string;
  event?: string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface GatewayClientOptions {
  url?: string;
  token?: string;
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export class OpenClawGatewayClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token?: string;
  private reconnect: boolean;
  private reconnectDelay: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts = 0;
  private pendingRpcs = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void; timeout: ReturnType<typeof setTimeout> }
  >();
  private eventBus: OpenClawEventBus;
  private isConnecting = false;
  private sessionKey: string;

  constructor(eventBus: OpenClawEventBus, options: GatewayClientOptions = {}) {
    this.eventBus = eventBus;
    this.url = options.url ?? "ws://127.0.0.1:18789";
    this.token = options.token;
    this.reconnect = options.reconnect ?? true;
    this.reconnectDelay = options.reconnectDelay ?? 2000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.sessionKey = `workflow-${Date.now()}`;
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {return;}
    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.token ? `${this.url}?token=${encodeURIComponent(this.token)}` : this.url;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.emitEvent("gateway", "connected", { url: this.url });
          resolve();
        };

        this.ws.onclose = (event) => {
          this.isConnecting = false;
          this.emitEvent("gateway", "disconnected", { reason: event.reason });

          if (this.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts += 1;
            window.setTimeout(() => this.connect().catch(() => undefined), this.reconnectDelay);
          }
        };

        this.ws.onerror = (error) => {
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(String(event.data));
        };
      } catch (err) {
        this.isConnecting = false;
        reject(err);
      }
    });
  }

  disconnect(): void {
    this.reconnect = false;
    this.pendingRpcs.forEach((p) => clearTimeout(p.timeout));
    this.pendingRpcs.clear();
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
  }

  send(message: GatewayMessage): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error("Gateway not connected");
    }
    this.ws.send(JSON.stringify(message));
  }

  async rpc<T = unknown>(method: string, params?: unknown, timeoutMs = 30000): Promise<T> {
    const id = `rpc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return new Promise<T>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pendingRpcs.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, timeoutMs);

      this.pendingRpcs.set(id, {
        resolve: (value) => resolve(value as T),
        reject: (err) => reject(err),
        timeout,
      });

      this.send({ type: "rpc", id, method, params });
    });
  }

  private handleMessage(raw: string): void {
    let message: GatewayMessage;
    try {
      message = JSON.parse(raw) as GatewayMessage;
    } catch {
      this.emitEvent("gateway", "message", { raw });
      return;
    }

    if (message.type === "response" && message.id) {
      const pending = this.pendingRpcs.get(message.id);
      if (!pending) {return;}
      clearTimeout(pending.timeout);
      this.pendingRpcs.delete(message.id);
      pending.resolve(message.result);
      return;
    }

    if (message.type === "error" && message.id) {
      const pending = this.pendingRpcs.get(message.id);
      if (!pending) {return;}
      clearTimeout(pending.timeout);
      this.pendingRpcs.delete(message.id);
      pending.reject(new Error(message.error?.message ?? "Gateway error"));
      return;
    }

    if (message.type === "event" && message.event) {
      const payload = (message as { params?: unknown; payload?: unknown; result?: unknown }).params
        ?? (message as { payload?: unknown }).payload
        ?? (message as { result?: unknown }).result;
      if (isOpenClawHookEvent(payload)) {
        const eventKey = `${payload.type}:${payload.action}` as keyof OpenClawEvents;
        this.eventBus.emit(eventKey, payload as OpenClawEvents[keyof OpenClawEvents]);
        void this.eventBus.triggerHooks(payload);
      }
      this.emitEvent("gateway", "message", { raw: message, payload });
    }
  }

  private emitEvent(type: OpenClawEventType, action: OpenClawEventAction, data?: unknown): void {
    const event: OpenClawHookEvent = {
      type,
      action,
      sessionKey: this.sessionKey,
      timestamp: new Date(),
      messages: [],
      data,
      context: {},
    };
    const key = `${type}:${action}` as keyof OpenClawEvents;
    this.eventBus.emit(key, event as OpenClawEvents[keyof OpenClawEvents]);
    void this.eventBus.triggerHooks(event);
  }
}

// =====================================================================
// WORKFLOW CALLBACKS
// =====================================================================

export interface WorkflowCallbacks {
  onThinking?: (event: OpenClawEvents["agent:thinking"]) => void;
  onToolPending?: (event: OpenClawEvents["tool:pending"]) => void;
  onToolResult?: (event: OpenClawEvents["tool:executed"]) => void;
  onWorkflowError?: (event: OpenClawEvents["agent:error"]) => void;
  onConnected?: (event: OpenClawEvents["gateway:connected"]) => void;
  onDisconnected?: (event: OpenClawEvents["gateway:disconnected"]) => void;
}

export function registerWorkflowCallbacks(eventBus: OpenClawEventBus, callbacks: WorkflowCallbacks): () => void {
  const unsub: Array<() => void> = [];

  const on = <K extends keyof OpenClawEvents>(event: K, fn: (data: OpenClawEvents[K]) => void) => {
    eventBus.on(event, fn);
    unsub.push(() => eventBus.off(event, fn));
  };

  if (callbacks.onThinking) {on("agent:thinking", callbacks.onThinking);}
  if (callbacks.onToolPending) {on("tool:pending", callbacks.onToolPending);}
  if (callbacks.onToolResult) {on("tool:executed", callbacks.onToolResult);}
  if (callbacks.onWorkflowError) {on("agent:error", callbacks.onWorkflowError);}
  if (callbacks.onConnected) {on("gateway:connected", callbacks.onConnected);}
  if (callbacks.onDisconnected) {on("gateway:disconnected", callbacks.onDisconnected);}

  return () => unsub.forEach((u) => u());
}

export function createOpenClawHook(eventBus: OpenClawEventBus): OpenClawHookHandler {
  return async (event) => {
    const key = `${event.type}:${event.action}` as keyof OpenClawEvents;
    eventBus.emit(key, event as unknown as OpenClawEvents[keyof OpenClawEvents]);
    await eventBus.triggerHooks(event);
  };
}

export const HOOK_MD_TEMPLATE = `---
name: workflow-ui
description: Agentic Workflow UI integration hook
version: 1.0.0
triggers:
  - command:*
  - agent:*
  - tool:*
  - workflow:*
requires:
  config:
    - hooks.internal.enabled
---

# Workflow UI Hook

Bridges the Agentic Workflow UI with OpenClaw's event system.
`;

export const HANDLER_TS_TEMPLATE = `
import type { HookHandler } from "../../src/hooks/hooks.js";

const handler: HookHandler = async (event) => {
  console.log(\`[workflow-ui] \${event.type}:\${event.action}\`);
};

export default handler;
`;
