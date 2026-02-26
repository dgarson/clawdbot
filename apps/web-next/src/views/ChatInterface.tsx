import { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import { formatRelativeTime, MOCK_SESSIONS, MOCK_CHAT_MESSAGES } from '../mock-data';
import { Skeleton } from '../components/ui/Skeleton';
import type { ChatMessage as ChatMessageType, ToolCall, Session } from '../types';
import {
  Send,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Terminal,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { ContextualEmptyState } from '../components/ui/ContextualEmptyState';

// ============================================================================
// Types
// ============================================================================

interface ChatInterfaceProps {
  agentName?: string;
  agentEmoji?: string;
  agentId?: string;
}

type SessionStatus = 'active' | 'idle' | 'completed' | 'error';

// ============================================================================
// Tool Call Component
// ============================================================================

function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusIcons = {
    pending: <Circle className="w-4 h-4 text-fg-muted" aria-hidden="true" />,
    running: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" aria-hidden="true" />,
    done: <CheckCircle2 className="w-4 h-4 text-green-500" aria-hidden="true" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" aria-hidden="true" />,
  };

  const statusLabels = {
    pending: 'Pending',
    running: 'Running',
    done: 'Done',
    error: 'Error',
  };

  return (
    <div className="bg-surface-2/50 border border-tok-border rounded-lg overflow-hidden my-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${toolCall.name} tool call — ${statusLabels[toolCall.status]}`}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2 transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 focus-visible:outline-none"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-fg-secondary" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-4 h-4 text-fg-secondary" aria-hidden="true" />
        )}
        <Terminal className="w-4 h-4 text-fg-secondary" aria-hidden="true" />
        <span className="font-medium text-fg-primary">{toolCall.name}</span>
        <span className="ml-auto flex items-center gap-2">
          {statusIcons[toolCall.status]}
          <span className="text-xs text-fg-muted">{statusLabels[toolCall.status]}</span>
        </span>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          <div>
            <p className="text-xs text-fg-muted mb-1">Input:</p>
            <pre className="bg-surface-0 text-fg-secondary text-xs p-2 rounded overflow-x-auto">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {toolCall.output && (
            <div>
              <p className="text-xs text-fg-muted mb-1">Output:</p>
              <pre className="bg-surface-0 text-fg-secondary text-xs p-2 rounded overflow-x-auto">
                {toolCall.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Message Component
// ============================================================================

function ChatMessageComponent({ message }: { message: ChatMessageType }) {
  const isUser = message.role === 'user';
  const isStreaming = message.streaming;

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-violet-600 text-fg-primary rounded-br-sm'
            : 'bg-surface-1 text-fg-primary rounded-bl-sm'
        )}
      >
        {/* Tool Calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2">
            {message.toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Message Content */}
        <div className="whitespace-pre-wrap break-words">
          {message.content}
          {isStreaming && (
            <span className="inline-flex ml-1" aria-label="Typing…">
              <span className="w-1.5 h-1.5 bg-fg-secondary rounded-full animate-bounce [animation-delay:-0.3s]" aria-hidden="true" />
              <span className="w-1.5 h-1.5 bg-fg-secondary rounded-full animate-bounce [animation-delay:-0.15s] ml-0.5" aria-hidden="true" />
              <span className="w-1.5 h-1.5 bg-fg-secondary rounded-full animate-bounce ml-0.5" aria-hidden="true" />
            </span>
          )}
        </div>

        {/* Timestamp */}
        <div
          className={cn(
            'text-xs mt-1',
            isUser ? 'text-violet-200' : 'text-fg-muted'
          )}
        >
          {formatRelativeTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Session Item Component
// ============================================================================

function SessionItem({
  session,
  isActive,
  onClick,
}: {
  session: Session;
  isActive: boolean;
  onClick: () => void;
}) {
  const statusColors: Record<SessionStatus, string> = {
    active: 'bg-green-500',
    idle: 'bg-amber-500',
    completed: 'bg-fg-muted',
    error: 'bg-red-500',
  };

  const statusLabels: Record<SessionStatus, string> = {
    active: 'Active',
    idle: 'Idle',
    completed: 'Completed',
    error: 'Error',
  };

  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'true' : undefined}
      className={cn(
        'w-full text-left p-3 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none',
        isActive
          ? 'bg-surface-2 border border-violet-600'
          : 'hover:bg-surface-2/50 border border-transparent'
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-xl" aria-hidden="true">{session.agentEmoji || '🤖'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className={cn('font-medium truncate', isActive ? 'text-fg-primary' : 'text-fg-secondary')}>
              {session.agentName || 'Agent'}
            </p>
            {/* Status dot with companion sr-only text */}
            <span className={cn('w-2 h-2 rounded-full', statusColors[session.status])} aria-hidden="true" />
            <span className="sr-only">{statusLabels[session.status]}</span>
          </div>
          <p className="text-xs text-fg-muted truncate mt-0.5">
            {session.messageCount} messages
          </p>
          <p className="text-xs text-fg-muted mt-1">
            {formatRelativeTime(session.lastActivity)}
          </p>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Main Chat Interface Component
// ============================================================================

function ChatInterfaceSkeleton() {
  // Alternating left/right bubble pattern
  const bubbles: Array<{ side: 'left' | 'right'; width: string }> = [
    { side: 'left', width: 'w-56' },
    { side: 'right', width: 'w-48' },
    { side: 'left', width: 'w-72' },
    { side: 'right', width: 'w-40' },
    { side: 'left', width: 'w-64' },
    { side: 'right', width: 'w-52' },
    { side: 'left', width: 'w-48' },
    { side: 'right', width: 'w-60' },
  ];
  return (
    <div className="flex h-full bg-surface-0 text-fg-primary">
      {/* Sessions sidebar skeleton */}
      <div className="w-64 border-r border-tok-border flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-tok-border">
          <Skeleton variant="text" className="h-5 w-24 mb-3" />
          <Skeleton variant="rect" className="h-8 w-full rounded-lg" />
        </div>
        <div className="flex-1 divide-y divide-tok-border overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-3 flex gap-3">
              <Skeleton variant="circle" className="w-8 h-8 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton variant="text" className="h-3.5 w-3/4" />
                <Skeleton variant="text" className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Chat area skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-tok-border flex items-center gap-3">
          <Skeleton variant="circle" className="w-8 h-8" />
          <div className="space-y-1">
            <Skeleton variant="text" className="h-4 w-28" />
            <Skeleton variant="text" className="h-3 w-20" />
          </div>
        </div>
        {/* Messages */}
        <div className="flex-1 p-4 space-y-4 overflow-hidden">
          {bubbles.map(({ side, width }, i) => (
            <div key={i} className={cn('flex', side === 'right' ? 'justify-end' : 'justify-start')}>
              {side === 'left' && <Skeleton variant="circle" className="w-8 h-8 mr-2 shrink-0" />}
              <div className={cn('space-y-1', width)}>
                <Skeleton variant="rect" className="h-10 w-full rounded-xl" />
                <Skeleton variant="text" className="h-2.5 w-16" />
              </div>
              {side === 'right' && <Skeleton variant="circle" className="w-8 h-8 ml-2 shrink-0" />}
            </div>
          ))}
        </div>
        {/* Input area */}
        <div className="p-4 border-t border-tok-border">
          <div className="flex gap-2">
            <Skeleton variant="rect" className="h-11 flex-1 rounded-xl" />
            <Skeleton variant="rect" className="h-11 w-11 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatInterface({
  agentName: initialAgentName,
  agentEmoji: initialAgentEmoji,
  agentId: initialAgentId,
  isLoading = false,
}: ChatInterfaceProps & { isLoading?: boolean }) {
  const [messages, setMessages] = useState<ChatMessageType[]>(MOCK_CHAT_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [activeSessionKey, setActiveSessionKey] = useState<string>(
    initialAgentId
      ? `agent:${initialAgentId}:main`
      : MOCK_SESSIONS[0]?.key || 'agent:luis:main'
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get active session
  const activeSession = MOCK_SESSIONS.find((s) => s.key === activeSessionKey);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputValue]);

  // Filter sessions if agentId provided
  const displayedSessions = initialAgentId
    ? MOCK_SESSIONS.filter((s) => s.agentId === initialAgentId)
    : MOCK_SESSIONS;

  const handleSend = () => {
    if (!inputValue.trim()) {return;}

    const newMessage: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue('');

    // Simulate streaming response
    setIsStreaming(true);
    setTimeout(() => {
      const assistantMessage: ChatMessageType = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: "I'm processing your request. Let me think about that...",
        timestamp: new Date().toISOString(),
        streaming: true,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Stop streaming after a delay
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMessage.id ? { ...m, streaming: false } : m))
        );
        setIsStreaming(false);
      }, 2000);
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Determine display agent info (from props or active session)
  const displayAgentEmoji = initialAgentEmoji || activeSession?.agentEmoji || '🎨';
  const displayAgentName = initialAgentName || activeSession?.agentName || 'Agent';

  if (isLoading) return <ChatInterfaceSkeleton />;

  return (
    <>
      {/* Skip link */}
      <a
        href="#chat-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-violet-600 focus:text-white focus:rounded-lg focus:font-medium focus:outline-none"
      >
        Skip to chat
      </a>

      <div className="flex h-screen bg-surface-0">
        {/* Left Pane - Session List */}
        <aside aria-label="Chat sessions" className="w-64 bg-surface-1 border-r border-tok-border flex-col hidden md:flex">
          {/* Sessions Header */}
          <div className="p-4 border-b border-tok-border">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-fg-primary">Sessions</h2>
              <span className="text-xs text-fg-muted bg-surface-2 px-2 py-1 rounded">
                {displayedSessions.length}
              </span>
            </div>
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1" role="list" aria-label="Available sessions">
            {displayedSessions.length > 0 ? (
              displayedSessions.map((session) => (
                <SessionItem
                  key={session.key}
                  session={session}
                  isActive={session.key === activeSessionKey}
                  onClick={() => setActiveSessionKey(session.key)}
                />
              ))
            ) : (
              <div className="p-4 text-center text-fg-muted text-sm">
                No sessions yet
              </div>
            )}
          </div>
        </aside>

        {/* Right Pane - Chat */}
        <main id="chat-main" className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="h-14 bg-surface-1/80 border-b border-tok-border flex items-center justify-between px-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">{displayAgentEmoji}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-fg-primary">{displayAgentName}</span>
                {/* Status indicator */}
                <span className="w-2 h-2 rounded-full bg-green-500" aria-hidden="true" />
                <span className="sr-only">Online</span>
              </div>
            </div>
            <button
              className="p-2 hover:bg-surface-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              aria-label="More options"
            >
              <MoreHorizontal className="w-5 h-5 text-fg-secondary" aria-hidden="true" />
            </button>
          </header>

          {/* Messages Area */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-4"
            aria-live="polite"
            aria-label="Chat messages"
            role="log"
          >
            {messages.length > 0 ? (
              messages.map((message) => (
                <ChatMessageComponent key={message.id} message={message} />
              ))
            ) : (
              <div className="flex items-center justify-center h-full">
                <ContextualEmptyState
                  icon={MessageSquare}
                  title="Start a conversation"
                  description="Send a message to begin chatting with this agent."
                />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Composer */}
          <section aria-label="Message composer" className="p-4 bg-surface-1/50 border-t border-tok-border">
            <div className="max-w-3xl mx-auto">
              <div className="relative">
                <label htmlFor="chat-input" className="sr-only">
                  Message {displayAgentName}
                </label>
                <textarea
                  id="chat-input"
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message..."
                  rows={1}
                  className="w-full bg-surface-2 border border-tok-border rounded-xl px-4 py-3 pr-12 text-fg-primary placeholder:text-fg-muted resize-none focus-visible:outline-none focus-visible:border-violet-600 focus-visible:ring-1 focus-visible:ring-violet-600"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isStreaming}
                  aria-label="Send message"
                  className={cn(
                    'absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none',
                    inputValue.trim() && !isStreaming
                      ? 'bg-violet-600 hover:bg-violet-500 text-fg-primary'
                      : 'bg-surface-3 text-fg-muted cursor-not-allowed'
                  )}
                >
                  <Send className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-fg-muted">
                <span>Press Enter to send, Shift+Enter for new line</span>
                <span aria-live="polite" aria-atomic="true">{inputValue.length} characters</span>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
