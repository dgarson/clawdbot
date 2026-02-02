// ============================================================================
// EXAMPLE: AGENTIC WORKFLOW WITH OPENCLAW INTEGRATION
// Shows how to connect our Workflow UI to OpenClaw's Gateway and Hooks
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  OpenClawProvider,
  useOpenClawWorkflow,
  useOpenClawEvent,
  useOpenClawEvents,
  OpenClawEventBus,
  registerWorkflowCallbacks,
  type WorkflowCallbacks,
  type ToolCallEventData,
} from './openclaw-integration';

// ============================================================================
// USAGE EXAMPLE 1: Basic Integration with Provider
// ============================================================================

/**
 * Wrap your app with OpenClawProvider to enable integration
 */
function App() {
  return (
    <OpenClawProvider
      gatewayUrl="ws://127.0.0.1:18789"
      gatewayToken={process.env.OPENCLAW_TOKEN}
      autoConnect={true}
    >
      <WorkflowWithOpenClaw />
    </OpenClawProvider>
  );
}

/**
 * Main workflow component using OpenClaw hooks
 */
function WorkflowWithOpenClaw() {
  const {
    status,
    pendingTools,
    isConnected,
    approveTool,
    rejectTool,
    eventBus,
  } = useOpenClawWorkflow({
    // Callbacks are called when events occur
    onThinking: (event) => {
      console.log('Agent is thinking:', event.data?.thought);
    },
    onToolPending: (event) => {
      console.log('Tool needs approval:', event.data?.toolName);
      // Could show a notification here
    },
    onWorkflowError: (event) => {
      console.error('Workflow error:', event.data?.error);
    },
  });

  // Subscribe to specific events
  useOpenClawEvent('agent:streaming', (event) => {
    // Handle streaming tokens
    console.log('Streaming delta:', event.data?.delta);
  });

  return (
    <div>
      <StatusBar isConnected={isConnected} status={status} />
      <PendingToolsList 
        tools={pendingTools} 
        onApprove={approveTool}
        onReject={rejectTool}
      />
      {/* Rest of your workflow UI */}
    </div>
  );
}

// ============================================================================
// USAGE EXAMPLE 2: Direct Event Bus Usage (without React)
// ============================================================================

/**
 * For non-React or vanilla JS usage
 */
async function setupOpenClawIntegration() {
  const eventBus = new OpenClawEventBus();

  // Register callbacks
  const cleanup = registerWorkflowCallbacks(eventBus, {
    onThinking: (e) => console.log('Thinking...'),
    onToolPending: (e) => showApprovalDialog(e.data!),
    onToolResult: (e) => console.log('Tool result:', e.data?.result),
    onConnected: () => console.log('Connected to Gateway!'),
  });

  // Register custom hooks (OpenClaw-style)
  const unhook = eventBus.registerHook('tool:pending', async (event) => {
    // Custom logic for tool approval
    if (event.data?.risk === 'low') {
      // Auto-approve low-risk tools
      eventBus.emit('tool:approved', {
        ...event,
        action: 'approved',
        data: { toolCallId: event.data.toolCallId },
      });
    }
  });

  // Manual event emission
  eventBus.emit('workflow:started', {
    type: 'workflow',
    action: 'started',
    sessionKey: 'demo-session',
    timestamp: new Date(),
    messages: [],
    data: { workflowId: 'wf-123' },
    context: {},
  });

  // Cleanup when done
  return () => {
    cleanup();
    unhook();
  };
}

function showApprovalDialog(tool: ToolCallEventData) {
  // Your approval dialog logic
}

// ============================================================================
// USAGE EXAMPLE 3: Creating an OpenClaw Hook File
// ============================================================================

/**
 * This would go in ~/.openclaw/hooks/workflow-ui/handler.ts
 * 
 * OpenClaw automatically discovers and loads hooks from:
 * - ~/.openclaw/hooks/ (workspace hooks)
 * - managed hooks directory
 * - bundled hooks
 */
// import type { HookHandler } from "../../src/hooks/hooks.js";
// 
// const handler: HookHandler = async (event) => {
//   // Only handle events we care about
//   if (event.type !== 'agent' && event.type !== 'tool') {
//     return;
//   }
// 
//   console.log(`[workflow-ui] ${event.type}:${event.action}`);
// 
//   // Forward to our React UI via fetch/WebSocket
//   await forwardToUI(event);
// 
//   // Push messages back to the user channel (WhatsApp, Telegram, etc)
//   if (event.type === 'tool' && event.action === 'pending') {
//     event.messages.push(`⏳ Awaiting approval for: ${event.data?.toolName}`);
//   }
// };
// 
// export default handler;

// ============================================================================
// USAGE EXAMPLE 4: Bridging Vercel AI SDK with OpenClaw
// ============================================================================

import { useChat } from 'ai/react';

/**
 * Combine Vercel AI SDK with OpenClaw event system
 */
function VercelAIWithOpenClaw() {
  const eventBus = useOpenClawEvents();
  
  const { messages, append, isLoading } = useChat({
    api: '/api/chat',
    onResponse: () => {
      eventBus.emit('agent:thinking', {
        type: 'agent',
        action: 'thinking',
        sessionKey: 'current',
        timestamp: new Date(),
        messages: [],
        context: {},
      });
    },
    onFinish: (message) => {
      eventBus.emit('agent:complete', {
        type: 'agent',
        action: 'complete',
        sessionKey: 'current',
        timestamp: new Date(),
        messages: [],
        data: { messageId: message.id, content: message.content },
        context: {},
      });

      // Check for tool calls
      if (message.toolInvocations?.length) {
        message.toolInvocations.forEach(tc => {
          eventBus.emit('tool:pending', {
            type: 'tool',
            action: 'pending',
            sessionKey: 'current',
            timestamp: new Date(),
            messages: [],
            data: {
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: tc.args,
            },
            context: {},
          });
        });
      }
    },
  });

  // Listen for tool approvals from OpenClaw
  useOpenClawEvent('tool:approved', async (event) => {
    // Continue the conversation with the approved tool
    await fetch('/api/chat/tool-result', {
      method: 'POST',
      body: JSON.stringify({
        toolCallId: event.data?.toolCallId,
        action: 'approved',
      }),
    });
  });

  return (
    <div>
      {/* Your chat UI */}
    </div>
  );
}

// ============================================================================
// USAGE EXAMPLE 5: Custom Hook with Approval Logic
// ============================================================================

/**
 * Hook that implements automatic approval based on tool risk levels
 */
function useAutoApproval(riskThreshold: 'low' | 'medium' | 'high' = 'low') {
  const eventBus = useOpenClawEvents();
  const [autoApproved, setAutoApproved] = useState<string[]>([]);

  useEffect(() => {
    const riskLevels = { low: 1, medium: 2, high: 3 };
    const threshold = riskLevels[riskThreshold];

    const unsubscribe = eventBus.registerHook('tool:pending', async (event) => {
      const tool = event.data as ToolCallEventData;
      const toolRisk = riskLevels[tool.risk || 'medium'];

      if (toolRisk <= threshold) {
        // Auto-approve
        console.log(`[AutoApproval] Auto-approving ${tool.toolName} (risk: ${tool.risk})`);
        
        setAutoApproved(prev => [...prev, tool.toolCallId]);
        
        eventBus.emit('tool:approved', {
          ...event,
          action: 'approved',
          data: { toolCallId: tool.toolCallId },
        });
      }
    });

    return unsubscribe;
  }, [eventBus, riskThreshold]);

  return { autoApproved };
}

// ============================================================================
// USAGE EXAMPLE 6: Event History & Replay
// ============================================================================

function EventDebugger() {
  const eventBus = useOpenClawEvents();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    // Subscribe to all events
    const handler = (event: any) => {
      setHistory(prev => [...prev.slice(-99), event]);
    };

    // Use wildcard to catch all events
    eventBus.registerHook('*', handler);
  }, [eventBus]);

  const replay = () => {
    // Replay events for debugging
    const events = eventBus.getHistory({ type: 'tool' });
    events.forEach(e => {
      console.log(`[Replay] ${e.type}:${e.action}`, e.data);
    });
  };

  return (
    <div className="event-debugger">
      <button onClick={replay}>Replay Tool Events</button>
      <button onClick={() => eventBus.clearHistory()}>Clear History</button>
      <pre>{JSON.stringify(history.slice(-10), null, 2)}</pre>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function StatusBar({ isConnected, status }: { isConnected: boolean; status: string }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-800 rounded">
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-xs text-gray-400">
        Gateway: {isConnected ? 'Connected' : 'Disconnected'}
      </span>
      <span className="text-xs text-gray-400">|</span>
      <span className="text-xs text-gray-400">Status: {status}</span>
    </div>
  );
}

function PendingToolsList({ 
  tools, 
  onApprove, 
  onReject 
}: { 
  tools: ToolCallEventData[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
}) {
  if (tools.length === 0) {return null;}

  return (
    <div className="space-y-2 p-2">
      <h3 className="text-sm font-medium text-amber-400">
        Pending Approvals ({tools.length})
      </h3>
      {tools.map(tool => (
        <div key={tool.toolCallId} className="flex items-center gap-2 p-2 bg-gray-800 rounded">
          <span className="text-xs text-white flex-1">{tool.toolName}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            tool.risk === 'high' ? 'bg-red-500/20 text-red-400' :
            tool.risk === 'medium' ? 'bg-amber-500/20 text-amber-400' :
            'bg-green-500/20 text-green-400'
          }`}>
            {tool.risk || 'medium'}
          </span>
          <button
            onClick={() => onApprove(tool.toolCallId)}
            className="px-2 py-1 bg-green-600 text-white text-[10px] rounded"
          >
            Approve
          </button>
          <button
            onClick={() => onReject(tool.toolCallId, 'User rejected')}
            className="px-2 py-1 bg-red-500/20 text-red-400 text-[10px] rounded"
          >
            Reject
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// INSTALLATION INSTRUCTIONS
// ============================================================================

/**
 * ## Setup Instructions
 * 
 * ### 1. Install OpenClaw
 * ```bash
 * npm install -g openclaw@latest
 * openclaw onboard --install-daemon
 * ```
 * 
 * ### 2. Create the Hook
 * ```bash
 * mkdir -p ~/.openclaw/hooks/workflow-ui
 * ```
 * 
 * Create `~/.openclaw/hooks/workflow-ui/HOOK.md`:
 * ```markdown
 * ---
 * name: workflow-ui
 * description: Agentic Workflow UI integration
 * version: 1.0.0
 * triggers:
 *   - command:*
 *   - agent:*
 *   - tool:*
 * ---
 * # Workflow UI Hook
 * Bridges events to the React UI.
 * ```
 * 
 * Create `~/.openclaw/hooks/workflow-ui/handler.ts`:
 * ```typescript
 * import type { HookHandler } from "../../src/hooks/hooks.js";
 * 
 * const handler: HookHandler = async (event) => {
 *   await fetch('http://localhost:3000/api/events', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(event),
 *   });
 * };
 * 
 * export default handler;
 * ```
 * 
 * ### 3. Enable the Hook
 * ```bash
 * openclaw hooks enable workflow-ui
 * ```
 * 
 * ### 4. Connect from React
 * ```tsx
 * import { OpenClawProvider, useOpenClawWorkflow } from './openclaw-integration';
 * 
 * function App() {
 *   return (
 *     <OpenClawProvider gatewayUrl="ws://127.0.0.1:18789">
 *       <YourWorkflowUI />
 *     </OpenClawProvider>
 *   );
 * }
 * ```
 * 
 * ### 5. Gateway Events Flow
 * ```
 * User (WhatsApp/Telegram/Discord)
 *   │
 *   ▼
 * OpenClaw Gateway (ws://127.0.0.1:18789)
 *   │
 *   ├──► Hooks (workflow-ui/handler.ts)
 *   │       │
 *   │       ▼
 *   │    POST /api/events
 *   │       │
 *   │       ▼
 *   │    React UI (EventBus)
 *   │
 *   └──► Pi Agent (tool execution)
 * ```
 */

export default App;
