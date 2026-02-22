import { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import { formatRelativeTime, MOCK_SESSIONS, MOCK_CHAT_MESSAGES } from '../mock-data';
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
} from 'lucide-react';

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
    pending: <Circle className="w-4 h-4 text-gray-500" />,
    running: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
    done: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />,
  };

  const statusLabels = {
    pending: 'Pending',
    running: 'Running',
    done: 'Done',
    error: 'Error',
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden my-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-800 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        <Terminal className="w-4 h-4 text-gray-400" />
        <span className="font-medium text-gray-200">{toolCall.name}</span>
        <span className="ml-auto flex items-center gap-2">
          {statusIcons[toolCall.status]}
          <span className="text-xs text-gray-500">{statusLabels[toolCall.status]}</span>
        </span>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">Input:</p>
            <pre className="bg-gray-950 text-gray-300 text-xs p-2 rounded overflow-x-auto">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {toolCall.output && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Output:</p>
              <pre className="bg-gray-950 text-gray-300 text-xs p-2 rounded overflow-x-auto">
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
            ? 'bg-violet-600 text-white rounded-br-sm'
            : 'bg-gray-900 text-gray-100 rounded-bl-sm'
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
            <span className="inline-flex ml-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s] ml-0.5" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce ml-0.5" />
            </span>
          )}
        </div>

        {/* Timestamp */}
        <div
          className={cn(
            'text-xs mt-1',
            isUser ? 'text-violet-200' : 'text-gray-500'
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
    completed: 'bg-gray-500',
    error: 'bg-red-500',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-xl transition-all',
        isActive
          ? 'bg-gray-800 border border-violet-600'
          : 'hover:bg-gray-800/50 border border-transparent'
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-xl">{session.agentEmoji || '🤖'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className={cn('font-medium truncate', isActive ? 'text-white' : 'text-gray-300')}>
              {session.agentName || 'Agent'}
            </p>
            <span className={cn('w-2 h-2 rounded-full', statusColors[session.status])} />
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {session.messageCount} messages
          </p>
          <p className="text-xs text-gray-500 mt-1">
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

export default function ChatInterface({
  agentName: initialAgentName,
  agentEmoji: initialAgentEmoji,
  agentId: initialAgentId,
}: ChatInterfaceProps) {
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

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Left Pane - Session List */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex-col hidden md:flex">
        {/* Sessions Header */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Sessions</h2>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
              {displayedSessions.length}
            </span>
          </div>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
            <div className="p-4 text-center text-gray-500 text-sm">
              No sessions yet
            </div>
          )}
        </div>
      </aside>

      {/* Right Pane - Chat */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-gray-900/80 border-b border-gray-800 flex items-center justify-between px-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{displayAgentEmoji}</span>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{displayAgentName}</span>
              <span className="w-2 h-2 rounded-full bg-green-500" />
            </div>
          </div>
          <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
            <MoreHorizontal className="w-5 h-5 text-gray-400" />
          </button>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length > 0 ? (
            messages.map((message) => (
              <ChatMessageComponent key={message.id} message={message} />
            ))
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <span className="text-4xl mb-2 block">{displayAgentEmoji}</span>
                <p className="text-gray-400">Start a conversation with {displayAgentName}</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Composer */}
        <div className="p-4 bg-gray-900/50 border-t border-gray-800">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message..."
                rows={1}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 pr-12 text-white placeholder-gray-500 resize-none focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className={cn(
                  'absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors',
                  inputValue.trim()
                    ? 'bg-violet-600 hover:bg-violet-500 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                )}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>Press Enter to send, Shift+Enter for new line</span>
              <span>{inputValue.length} characters</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
