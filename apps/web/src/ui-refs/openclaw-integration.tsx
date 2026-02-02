// ============================================================================
// OPENCLAW INTEGRATION FOR AGENTIC WORKFLOW
// Bridges our workflow UI with OpenClaw's Gateway WebSocket and Hook system
// ============================================================================

import { EventEmitter } from 'events';
import type { Message } from 'ai';

// ============================================================================
// OPENCLAW EVENT TYPES (matching OpenClaw's hook system)
// ============================================================================

/**
 * OpenClaw hook event types - matches src/hooks/hooks.ts
 */
export type OpenClawEventType = 'command' | 'session' | 'agent' | 'gateway' | 'tool' | 'workflow';

export type OpenClawEventAction = 
  // Command actions
  | 'new' | 'reset' | 'stop' | 'send' | 'retry'
  // Session actions  
  | 'created' | 'resumed' | 'ended' | 'pruned'
  // Agent actions
  | 'thinking' | 'streaming' | 'tool_call' | 'tool_result' | 'complete' | 'error'
  // Gateway actions
  | 'startup' | 'shutdown' | 'connected' | 'disconnected'
  // Tool actions
  | 'pending' | 'approved' | 'rejected' | 'executing' | 'executed'
  // Workflow actions
  | 'started' | 'paused'   | 'cancelled' | 'waiting_approval' | 'waiting_input';

/**
 * OpenClaw Hook Event - the core event structure
 */
export interface OpenClawHookEvent<T = any> {
  type: OpenClawEventType;
  action: OpenClawEventAction;
  sessionKey: string;
  timestamp: Date;
  messages: string[];  // Push messages here to send to user
  data?: T;
  context: {
    sessionEntry?: any;
    sessionId?: string;
    sessionFile?: string;
    commandSource?: 'whatsapp' | 'telegram' | 'discord' | 'slack' | 'webchat' | 'cli';
    senderId?: string;
    workspaceDir?: string;
    bootstrapFiles?: any[];
    cfg?: OpenClawConfig;
    agentId?: string;
  };
}

/**
 * OpenClaw configuration subset relevant to our integration
 */
export interface OpenClawConfig {
  gateway?: {
    port?: number;
    token?: string;
    bind?: 'loopback' | 'tailnet' | 'lan';
  };
  hooks?: {
    internal?: {
      enabled?: boolean;
      entries?: Record<string, { enabled?: boolean; env?: Record<string, string> }>;
    };
  };
  tools?: {
    security?: 'allowlist' | 'ask' | 'deny';
    elevated?: string[];
    allowlist?: string[];
  };
}

/**
 * Hook handler function signature - matches OpenClaw's HookHandler type
 */
export type OpenClawHookHandler<T = any> = (event: OpenClawHookEvent<T>) => Promise<void> | void;

// ============================================================================
// TYPED EVENT BUS FOR OPENCLAW
// ============================================================================

/**
 * Event definitions for type-safe event bus
 */
export interface OpenClawEvents {
  // Command events
  'command:new': OpenClawHookEvent<{ reason?: string }>;
  'command:reset': OpenClawHookEvent<{ clearHistory?: boolean }>;
  'command:stop': OpenClawHookEvent<{ immediate?: boolean }>;
  'command:send': OpenClawHookEvent<{ content: string; attachments?: any[] }>;
  
  // Session events
  'session:created': OpenClawHookEvent<{ sessionId: string }>;
  'session:resumed': OpenClawHookEvent<{ sessionId: string; messages: Message[] }>;
  'session:ended': OpenClawHookEvent<{ sessionId: string; reason?: string }>;
  
  // Agent events
  'agent:thinking': OpenClawHookEvent<{ thought?: string }>;
  'agent:streaming': OpenClawHookEvent<{ delta: string; messageId: string }>;
  'agent:tool_call': OpenClawHookEvent<ToolCallEventData>;
  'agent:tool_result': OpenClawHookEvent<ToolResultEventData>;
  'agent:complete': OpenClawHookEvent<{ messageId: string; content: string }>;
  'agent:error': OpenClawHookEvent<{ error: Error; recoverable?: boolean }>;
  
  // Tool events
  'tool:pending': OpenClawHookEvent<ToolCallEventData>;
  'tool:approved': OpenClawHookEvent<{ toolCallId: string; modifiedArgs?: any }>;
  'tool:rejected': OpenClawHookEvent<{ toolCallId: string; reason?: string }>;
  'tool:executing': OpenClawHookEvent<{ toolCallId: string }>;
  'tool:executed': OpenClawHookEvent<ToolResultEventData>;
  
  // Workflow events
  'workflow:started': OpenClawHookEvent<{ workflowId: string }>;
  'workflow:paused': OpenClawHookEvent<{ reason?: string }>;
  'workflow:resumed': OpenClawHookEvent;
  'workflow:cancelled': OpenClawHookEvent<{ reason?: string }>;
  'workflow:waiting_approval': OpenClawHookEvent<{ pendingTools: string[] }>;
  'workflow:waiting_input': OpenClawHookEvent<{ questionId: string }>;
  
  // Gateway events
  'gateway:connected': OpenClawHookEvent<{ url: string }>;
  'gateway:disconnected': OpenClawHookEvent<{ reason?: string }>;
  'gateway:message': OpenClawHookEvent<{ raw: any }>;
}

export interface ToolCallEventData {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  risk?: 'low' | 'medium' | 'high';
}

export interface ToolResultEventData {
  toolCallId: string;
  toolName: string;
  result: any;
  error?: string;
  executionTime?: number;
}

/**
 * Typed Event Bus for OpenClaw integration
 */
export class OpenClawEventBus extends EventEmitter {
  private handlers: Map<string, Set<OpenClawHookHandler>> = new Map();
  private eventHistory: OpenClawHookEvent[] = [];
  private maxHistorySize = 1000;

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Register a typed event handler
   */
  on<K extends keyof OpenClawEvents>(
    event: K,
    handler: (data: OpenClawEvents[K]) => void
  ): this {
    return super.on(event, handler);
  }

  /**
   * Register a one-time typed event handler
   */
  once<K extends keyof OpenClawEvents>(
    event: K,
    handler: (data: OpenClawEvents[K]) => void
  ): this {
    return super.once(event, handler);
  }

  /**
   * Emit a typed event
   */
  emit<K extends keyof OpenClawEvents>(event: K, data: OpenClawEvents[K]): boolean {
    // Store in history
    this.eventHistory.push(data);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
    
    return super.emit(event, data);
  }

  /**
   * Remove a typed event handler
   */
  off<K extends keyof OpenClawEvents>(
    event: K,
    handler: (data: OpenClawEvents[K]) => void
  ): this {
    return super.off(event, handler);
  }

  /**
   * Register a hook handler (OpenClaw-style)
   */
  registerHook(eventPattern: string, handler: OpenClawHookHandler): () => void {
    if (!this.handlers.has(eventPattern)) {
      this.handlers.set(eventPattern, new Set());
    }
    this.handlers.get(eventPattern)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.handlers.get(eventPattern)?.delete(handler);
    };
  }

  /**
   * Trigger hooks matching a pattern
   */
  async triggerHooks(event: OpenClawHookEvent): Promise<void> {
    const eventKey = `${event.type}:${event.action}`;
    const handlers = [
      ...(this.handlers.get(eventKey) || []),
      ...(this.handlers.get(event.type) || []),  // Wildcard for type
      ...(this.handlers.get('*') || []),          // Global wildcard
    ];

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`[OpenClaw] Hook error for ${eventKey}:`, error);
      }
    }
  }

  /**
   * Get event history (for debugging/replay)
   */
  getHistory(filter?: { type?: OpenClawEventType; action?: OpenClawEventAction }): OpenClawHookEvent[] {
    if (!filter) {return [...this.eventHistory];}
    
    return this.eventHistory.filter(e => {
      if (filter.type && e.type !== filter.type) {return false;}
      if (filter.action && e.action !== filter.action) {return false;}
      return true;
    });
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }
}

// ============================================================================
// GATEWAY WEBSOCKET CLIENT
// ============================================================================

export interface GatewayMessage {
  type: 'event' | 'rpc' | 'response' | 'error';
  id?: string;
  event?: string;
  method?: string;
  params?: any;
  result?: any;
  error?: { code: number; message: string };
}

export interface GatewayClientOptions {
  url?: string;
  token?: string;
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

/**
 * OpenClaw Gateway WebSocket Client
 * Connects to ws://127.0.0.1:18789 (default)
 */
export class OpenClawGatewayClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token?: string;
  private reconnect: boolean;
  private reconnectDelay: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts = 0;
  private pendingRpcs: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private eventBus: OpenClawEventBus;
  private isConnecting = false;
  private sessionKey: string;

  constructor(eventBus: OpenClawEventBus, options: GatewayClientOptions = {}) {
    this.eventBus = eventBus;
    this.url = options.url || 'ws://127.0.0.1:18789';
    this.token = options.token;
    this.reconnect = options.reconnect ?? true;
    this.reconnectDelay = options.reconnectDelay ?? 2000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.sessionKey = `workflow-${Date.now()}`;
  }

  /**
   * Connect to the Gateway
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.token 
          ? `${this.url}?token=${encodeURIComponent(this.token)}`
          : this.url;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          console.log('[Gateway] Connected to', this.url);
          
          this.emitEvent('gateway', 'connected', { url: this.url });
          resolve();
        };

        this.ws.onclose = (event) => {
          this.isConnecting = false;
          console.log('[Gateway] Disconnected:', event.reason || 'No reason');
          
          this.emitEvent('gateway', 'disconnected', { reason: event.reason });
          
          if (this.reconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[Gateway] Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})`);
            setTimeout(() => this.connect(), this.reconnectDelay);
          }
        };

        this.ws.onerror = (error) => {
          this.isConnecting = false;
          console.error('[Gateway] WebSocket error:', error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the Gateway
   */
  disconnect(): void {
    this.reconnect = false;
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Send a raw message to the Gateway
   */
  send(message: GatewayMessage): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error('Gateway not connected');
    }
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Make an RPC call to the Gateway
   */
  async rpc<T = any>(method: string, params?: any, timeout = 30000): Promise<T> {
    const id = `rpc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRpcs.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, timeout);

      this.pendingRpcs.set(id, { resolve, reject, timeout: timeoutId });
      
      this.send({
        type: 'rpc',
        id,
        method,
        params,
      });
    });
  }

  /**
   * Handle incoming Gateway messages
   */
  private handleMessage(data: string): void {
    try {
      const message: GatewayMessage = JSON.parse(data);
      
      // Handle RPC responses
      if (message.type === 'response' && message.id) {
        const pending = this.pendingRpcs.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRpcs.delete(message.id);
          
          if (message.error) {
            pending.reject(new Error(message.error.message));
          } else {
            pending.resolve(message.result);
          }
        }
        return;
      }

      // Handle events
      if (message.type === 'event' && message.event) {
        const [type, action] = message.event.split(':') as [OpenClawEventType, OpenClawEventAction];
        this.emitEvent(type, action, message.params);
      }

      // Emit raw message for debugging
      this.emitEvent('gateway', 'message' as any, { raw: message });
      
    } catch (error) {
      console.error('[Gateway] Failed to parse message:', error);
    }
  }

  /**
   * Emit an event through the event bus
   */
  private emitEvent(type: OpenClawEventType, action: OpenClawEventAction, data?: any): void {
    const event: OpenClawHookEvent = {
      type,
      action,
      sessionKey: this.sessionKey,
      timestamp: new Date(),
      messages: [],
      data,
      context: {
        commandSource: 'webchat',
      },
    };

    const eventKey = `${type}:${action}` as keyof OpenClawEvents;
    this.eventBus.emit(eventKey, event as any);
    void this.eventBus.triggerHooks(event);
  }

  /**
   * Get connection state
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Update session key
   */
  setSessionKey(key: string): void {
    this.sessionKey = key;
  }
}

// ============================================================================
// WORKFLOW CALLBACKS / HOOK HANDLERS
// ============================================================================

/**
 * Callback registry for workflow events
 * Provides a simpler callback-style API on top of the event bus
 */
export interface WorkflowCallbacks {
  // Lifecycle
  onWorkflowStart?: (event: OpenClawHookEvent) => void;
  onWorkflowPause?: (event: OpenClawHookEvent) => void;
  onWorkflowResume?: (event: OpenClawHookEvent) => void;
  onWorkflowComplete?: (event: OpenClawHookEvent) => void;
  onWorkflowError?: (event: OpenClawHookEvent<{ error: Error }>) => void;

  // Agent
  onThinking?: (event: OpenClawHookEvent<{ thought?: string }>) => void;
  onStreaming?: (event: OpenClawHookEvent<{ delta: string }>) => void;
  onMessageComplete?: (event: OpenClawHookEvent<{ content: string }>) => void;

  // Tools
  onToolPending?: (event: OpenClawHookEvent<ToolCallEventData>) => void;
  onToolApproved?: (event: OpenClawHookEvent<{ toolCallId: string }>) => void;
  onToolRejected?: (event: OpenClawHookEvent<{ toolCallId: string; reason?: string }>) => void;
  onToolExecuting?: (event: OpenClawHookEvent<{ toolCallId: string }>) => void;
  onToolResult?: (event: OpenClawHookEvent<ToolResultEventData>) => void;

  // Input
  onWaitingApproval?: (event: OpenClawHookEvent<{ pendingTools: string[] }>) => void;
  onWaitingInput?: (event: OpenClawHookEvent<{ questionId: string }>) => void;

  // Connection
  onConnected?: (event: OpenClawHookEvent<{ url: string }>) => void;
  onDisconnected?: (event: OpenClawHookEvent<{ reason?: string }>) => void;
}

/**
 * Register workflow callbacks with the event bus
 */
export function registerWorkflowCallbacks(
  eventBus: OpenClawEventBus,
  callbacks: WorkflowCallbacks
): () => void {
  const unsubscribers: Array<() => void> = [];

  const register = <K extends keyof OpenClawEvents>(
    event: K,
    callback?: (e: OpenClawEvents[K]) => void
  ) => {
    if (callback) {
      const handler = (e: OpenClawEvents[K]) => callback(e);
      eventBus.on(event, handler);
      unsubscribers.push(() => eventBus.off(event, handler));
    }
  };

  // Map callbacks to events
  register('workflow:started', callbacks.onWorkflowStart);
  register('workflow:paused', callbacks.onWorkflowPause);
  register('workflow:resumed', callbacks.onWorkflowResume);
  register('agent:complete', callbacks.onWorkflowComplete);
  register('agent:error', callbacks.onWorkflowError);
  register('agent:thinking', callbacks.onThinking);
  register('agent:streaming', callbacks.onStreaming);
  register('agent:complete', callbacks.onMessageComplete);
  register('tool:pending', callbacks.onToolPending);
  register('tool:approved', callbacks.onToolApproved);
  register('tool:rejected', callbacks.onToolRejected);
  register('tool:executing', callbacks.onToolExecuting);
  register('tool:executed', callbacks.onToolResult);
  register('workflow:waiting_approval', callbacks.onWaitingApproval);
  register('workflow:waiting_input', callbacks.onWaitingInput);
  register('gateway:connected', callbacks.onConnected);
  register('gateway:disconnected', callbacks.onDisconnected);

  // Return cleanup function
  return () => unsubscribers.forEach(unsub => unsub());
}

// ============================================================================
// OPENCLAW HOOK HANDLER (for server-side integration)
// ============================================================================

/**
 * Create an OpenClaw-compatible hook handler
 * This can be used in ~/.openclaw/hooks/workflow-ui/handler.ts
 */
export function createOpenClawHook(
  eventBus: OpenClawEventBus
): OpenClawHookHandler {
  return async (event) => {
    // Forward OpenClaw events to our event bus
    const eventKey = `${event.type}:${event.action}` as keyof OpenClawEvents;
    eventBus.emit(eventKey, event as any);

    // Handle specific events
    switch (`${event.type}:${event.action}`) {
      case 'command:new':
        console.log('[Hook] New session requested');
        break;
        
      case 'agent:tool_call':
        console.log('[Hook] Tool call:', event.data?.toolName);
        // Could trigger approval UI here
        break;
        
      case 'agent:complete':
        console.log('[Hook] Agent response complete');
        break;
    }

    // Messages pushed to event.messages are sent back to the user
    // This is how hooks can communicate back through OpenClaw
  };
}

// ============================================================================
// REACT HOOKS FOR INTEGRATION
// ============================================================================

import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from 'react';

// Context for sharing the event bus
const OpenClawContext = createContext<{
  eventBus: OpenClawEventBus;
  gateway: OpenClawGatewayClient | null;
} | null>(null);

/**
 * Provider component for OpenClaw integration
 */
export function OpenClawProvider({ 
  children,
  gatewayUrl,
  gatewayToken,
  autoConnect = true,
}: {
  children: React.ReactNode;
  gatewayUrl?: string;
  gatewayToken?: string;
  autoConnect?: boolean;
}) {
  const eventBus = useMemo(() => new OpenClawEventBus(), []);
  const [gateway, setGateway] = useState<OpenClawGatewayClient | null>(null);

  useEffect(() => {
    const client = new OpenClawGatewayClient(eventBus, {
      url: gatewayUrl,
      token: gatewayToken,
    });
    
    setGateway(client);

    if (autoConnect) {
      client.connect().catch(console.error);
    }

    return () => {
      client.disconnect();
    };
  }, [eventBus, gatewayUrl, gatewayToken, autoConnect]);

  return (
    <OpenClawContext.Provider value={{ eventBus, gateway }}>
      {children}
    </OpenClawContext.Provider>
  );
}

/**
 * Hook to access the OpenClaw event bus
 */
export function useOpenClawEvents() {
  const context = useContext(OpenClawContext);
  if (!context) {
    throw new Error('useOpenClawEvents must be used within OpenClawProvider');
  }
  return context.eventBus;
}

/**
 * Hook to access the Gateway client
 */
export function useOpenClawGateway() {
  const context = useContext(OpenClawContext);
  if (!context) {
    throw new Error('useOpenClawGateway must be used within OpenClawProvider');
  }
  return context.gateway;
}

/**
 * Hook to subscribe to OpenClaw events
 */
export function useOpenClawEvent<K extends keyof OpenClawEvents>(
  event: K,
  handler: (data: OpenClawEvents[K]) => void,
  deps: any[] = []
) {
  const eventBus = useOpenClawEvents();
  
  useEffect(() => {
    eventBus.on(event, handler);
    return () => {
      eventBus.off(event, handler);
    };
  }, [eventBus, event, ...deps]);
}

/**
 * Hook for workflow state with OpenClaw integration
 */
export function useOpenClawWorkflow(callbacks?: WorkflowCallbacks) {
  const eventBus = useOpenClawEvents();
  const gateway = useOpenClawGateway();
  
  const [status, setStatus] = useState<'idle' | 'thinking' | 'executing' | 'waiting' | 'complete' | 'error'>('idle');
  const [pendingTools, setPendingTools] = useState<ToolCallEventData[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Register callbacks
  useEffect(() => {
    if (callbacks) {
      return registerWorkflowCallbacks(eventBus, callbacks);
    }
  }, [eventBus, callbacks]);

  // Track connection state
  useOpenClawEvent('gateway:connected', () => setIsConnected(true));
  useOpenClawEvent('gateway:disconnected', () => setIsConnected(false));

  // Track workflow state
  useOpenClawEvent('agent:thinking', () => setStatus('thinking'));
  useOpenClawEvent('agent:complete', () => setStatus('complete'));
  useOpenClawEvent('agent:error', () => setStatus('error'));
  useOpenClawEvent('tool:executing', () => setStatus('executing'));
  useOpenClawEvent('workflow:waiting_approval', () => setStatus('waiting'));

  // Track pending tools
  useOpenClawEvent('tool:pending', (e) => {
    if (e.data) {
      setPendingTools(prev => [...prev, e.data!]);
    }
  });

  useOpenClawEvent('tool:approved', (e) => {
    setPendingTools(prev => prev.filter(t => t.toolCallId !== e.data?.toolCallId));
  });

  useOpenClawEvent('tool:rejected', (e) => {
    setPendingTools(prev => prev.filter(t => t.toolCallId !== e.data?.toolCallId));
  });

  // Actions
  const connect = useCallback(async () => {
    await gateway?.connect();
  }, [gateway]);

  const disconnect = useCallback(() => {
    gateway?.disconnect();
  }, [gateway]);

  const approveTool = useCallback((toolCallId: string, modifiedArgs?: any) => {
    eventBus.emit('tool:approved', {
      type: 'tool',
      action: 'approved',
      sessionKey: '',
      timestamp: new Date(),
      messages: [],
      data: { toolCallId, modifiedArgs },
      context: {},
    });
    
    // Send to gateway
    void gateway?.rpc('tool.approve', { toolCallId, modifiedArgs });
  }, [eventBus, gateway]);

  const rejectTool = useCallback((toolCallId: string, reason?: string) => {
    eventBus.emit('tool:rejected', {
      type: 'tool',
      action: 'rejected',
      sessionKey: '',
      timestamp: new Date(),
      messages: [],
      data: { toolCallId, reason },
      context: {},
    });
    
    void gateway?.rpc('tool.reject', { toolCallId, reason });
  }, [eventBus, gateway]);

  return {
    status,
    pendingTools,
    isConnected,
    connect,
    disconnect,
    approveTool,
    rejectTool,
    eventBus,
    gateway,
  };
}

// ============================================================================
// HOOK.MD FILE TEMPLATE (for OpenClaw discovery)
// ============================================================================

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

## Events Handled

- \`command:new\` - New session created
- \`command:reset\` - Session reset
- \`agent:thinking\` - Agent is processing
- \`agent:tool_call\` - Tool execution requested
- \`agent:complete\` - Response complete
- \`tool:pending\` - Tool awaiting approval
- \`tool:approved\` - Tool was approved
- \`tool:rejected\` - Tool was rejected

## Configuration

\`\`\`json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "workflow-ui": {
          "enabled": true,
          "env": {
            "WORKFLOW_UI_PORT": "3000"
          }
        }
      }
    }
  }
}
\`\`\`
`;

// ============================================================================
// HANDLER.TS FILE TEMPLATE (for OpenClaw hook)
// ============================================================================

export const HANDLER_TS_TEMPLATE = `
import type { HookHandler } from "../../src/hooks/hooks.js";

/**
 * Workflow UI Hook Handler
 * Forwards OpenClaw events to the Workflow UI via WebSocket
 */
const handler: HookHandler = async (event) => {
  // Filter events we care about
  const relevantTypes = ['command', 'agent', 'tool', 'workflow', 'session'];
  if (!relevantTypes.includes(event.type)) {
    return;
  }

  console.log(\`[workflow-ui] \${event.type}:\${event.action}\`);

  // Forward to UI (implement your WebSocket/HTTP connection here)
  try {
    // Example: POST to local UI server
    const uiPort = process.env.WORKFLOW_UI_PORT || '3000';
    await fetch(\`http://localhost:\${uiPort}/api/events\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: event.type,
        action: event.action,
        sessionKey: event.sessionKey,
        timestamp: event.timestamp.toISOString(),
        data: event.data,
        context: {
          sessionId: event.context.sessionId,
          commandSource: event.context.commandSource,
          senderId: event.context.senderId,
        },
      }),
    });
  } catch (error) {
    // UI might not be running, that's okay
    console.debug('[workflow-ui] Failed to forward event:', error.message);
  }

  // Handle tool approval requests
  if (event.type === 'tool' && event.action === 'pending') {
    // Could push a message back to the user
    event.messages.push(\`🔧 Tool "\${event.data?.toolName}" requires approval.\`);
  }
};

export default handler;
`;

// ============================================================================
// EXPORTS
// ============================================================================

export {
  OpenClawEventBus,
  OpenClawGatewayClient,
  registerWorkflowCallbacks,
  createOpenClawHook,
  OpenClawProvider,
  useOpenClawEvents,
  useOpenClawGateway,
  useOpenClawEvent,
  useOpenClawWorkflow,
};
