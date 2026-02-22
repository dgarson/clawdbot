// ============================================================================
// CUSTOM HOOKS FOR AGENTIC WORKFLOW
// ============================================================================

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useChat as useVercelChat, Message } from 'ai/react';
import { generateId } from 'ai';

// ============================================================================
// TYPES
// ============================================================================

export interface ToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'complete' | 'error';
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface Question {
  id: string;
  text: string;
  type: 'text' | 'choice';
  options?: { id: string; label: string; description?: string }[];
  multiple?: boolean;
  placeholder?: string;
  multiline?: boolean;
  status: 'pending' | 'answered';
  answer?: any;
  createdAt: Date;
  answeredAt?: Date;
}

export interface WorkflowStep {
  id: string;
  type: 'message' | 'tool' | 'question' | 'thinking' | 'error';
  data: any;
  timestamp: Date;
}

export interface Session {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
  toolCalls: ToolCall[];
  questions: Question[];
}

export type WorkflowStatus = 
  | 'idle' 
  | 'thinking' 
  | 'executing' 
  | 'waiting_approval' 
  | 'waiting_input' 
  | 'paused' 
  | 'complete' 
  | 'error';

export type RiskLevel = 'low' | 'medium' | 'high';
export type PermissionAction = 'auto' | 'ask' | 'deny';

export interface ToolPermissions {
  low: PermissionAction;
  medium: PermissionAction;
  high: PermissionAction;
}

// ============================================================================
// USE WORKFLOW HOOK
// ============================================================================

interface UseWorkflowOptions {
  model?: string;
  sessionId?: string;
  autoApprove?: boolean;
  toolPermissions?: ToolPermissions;
  onToolCall?: (toolCall: ToolCall) => void;
  onQuestion?: (question: Question) => void;
  onStatusChange?: (status: WorkflowStatus) => void;
  onError?: (error: Error) => void;
}

export function useWorkflow(options: UseWorkflowOptions = {}) {
  const {
    model = 'claude-3-5-sonnet-20241022',
    sessionId = 'default',
    autoApprove: initialAutoApprove = false,
    toolPermissions: initialPermissions = { low: 'auto', medium: 'ask', high: 'ask' },
    onToolCall,
    onQuestion,
    onStatusChange,
    onError,
  } = options;

  // State
  const [status, setStatus] = useState<WorkflowStatus>('idle');
  const [autoApprove, setAutoApprove] = useState(initialAutoApprove);
  const [toolPermissions, setToolPermissions] = useState<ToolPermissions>(initialPermissions);
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCall[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<Question[]>([]);
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowStep[]>([]);

  // Refs for callbacks
  const statusRef = useRef(status);
  statusRef.current = status;

  // Vercel AI SDK chat hook
  const chat = useVercelChat({
    api: '/api/chat',
    body: {
      model,
      sessionId,
      autoApprove,
      toolPermissions,
    },
    onResponse: () => {
      updateStatus('thinking');
    },
    onFinish: (message) => {
      // Check for tool invocations
      if (message.toolInvocations?.length) {
        handleToolInvocations(message.toolInvocations);
      } else {
        updateStatus('complete');
      }
    },
    onError: (error) => {
      updateStatus('error');
      onError?.(error);
    },
  });

  // Update status with callback
  const updateStatus = useCallback((newStatus: WorkflowStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  // Handle tool invocations from AI response
  const handleToolInvocations = useCallback((invocations: any[]) => {
    const newToolCalls: ToolCall[] = invocations.map(inv => ({
      toolCallId: inv.toolCallId || generateId(),
      toolName: inv.toolName,
      args: inv.args,
      status: 'pending',
      createdAt: new Date(),
    }));

    // Process each tool call based on permissions
    newToolCalls.forEach(tc => {
      const risk = getToolRisk(tc.toolName);
      const permission = toolPermissions[risk];

      if (autoApprove || permission === 'auto') {
        void executeToolCall(tc);
      } else if (permission === 'deny') {
        rejectToolCall(tc.toolCallId, 'Auto-denied by permission settings');
      } else {
        setPendingToolCalls(prev => [...prev, tc]);
        updateStatus('waiting_approval');
        onToolCall?.(tc);
      }
    });
  }, [autoApprove, toolPermissions, onToolCall, updateStatus]);

  // Get tool risk level
  const getToolRisk = (toolName: string): RiskLevel => {
    const lowRisk = ['web_search', 'web_scrape', 'code_analyze', 'file_read', 'ai_embed'];
    const highRisk = ['code_execute', 'file_write', 'db_mutate', 'shell_exec'];
    
    if (lowRisk.includes(toolName)) {return 'low';}
    if (highRisk.includes(toolName)) {return 'high';}
    return 'medium';
  };

  // Execute a tool call
  const executeToolCall = useCallback(async (toolCall: ToolCall) => {
    setPendingToolCalls(prev => 
      prev.map(tc => tc.toolCallId === toolCall.toolCallId 
        ? { ...tc, status: 'executing' } 
        : tc
      )
    );
    updateStatus('executing');

    try {
      // The actual execution happens server-side through the Vercel AI SDK
      // We just need to notify the API to continue
      const response = await fetch('/api/chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolCallId: toolCall.toolCallId,
          action: 'approve',
        }),
      });

      if (!response.ok) {throw new Error('Failed to execute tool');}

      setPendingToolCalls(prev => 
        prev.map(tc => tc.toolCallId === toolCall.toolCallId 
          ? { ...tc, status: 'complete', completedAt: new Date() } 
          : tc
        )
      );

      // Add to history
      addToHistory('tool', { ...toolCall, status: 'complete' });

    } catch (error) {
      setPendingToolCalls(prev => 
        prev.map(tc => tc.toolCallId === toolCall.toolCallId 
          ? { ...tc, status: 'error', error: error.message } 
          : tc
        )
      );
      updateStatus('error');
    }
  }, [updateStatus]);

  // Approve a pending tool call
  const approveToolCall = useCallback((toolCallId: string, modifiedArgs?: Record<string, any>) => {
    const tc = pendingToolCalls.find(t => t.toolCallId === toolCallId);
    if (tc) {
      const toolCall = modifiedArgs ? { ...tc, args: modifiedArgs } : tc;
      void executeToolCall(toolCall);
    }
  }, [pendingToolCalls, executeToolCall]);

  // Reject a tool call
  const rejectToolCall = useCallback((toolCallId: string, reason?: string) => {
    setPendingToolCalls(prev => 
      prev.map(tc => tc.toolCallId === toolCallId 
        ? { ...tc, status: 'rejected', error: reason } 
        : tc
      )
    );

    // Check if there are more pending
    const remaining = pendingToolCalls.filter(tc => 
      tc.toolCallId !== toolCallId && tc.status === 'pending'
    );
    
    if (remaining.length === 0) {
      updateStatus('idle');
    }
  }, [pendingToolCalls, updateStatus]);

  // Approve all pending
  const approveAllPending = useCallback(() => {
    pendingToolCalls
      .filter(tc => tc.status === 'pending')
      .forEach(tc => approveToolCall(tc.toolCallId));
  }, [pendingToolCalls, approveToolCall]);

  // Reject all pending
  const rejectAllPending = useCallback(() => {
    pendingToolCalls
      .filter(tc => tc.status === 'pending')
      .forEach(tc => rejectToolCall(tc.toolCallId, 'Batch rejected'));
  }, [pendingToolCalls, rejectToolCall]);

  // Ask a question
  const askQuestion = useCallback((question: Omit<Question, 'id' | 'status' | 'createdAt'>) => {
    const q: Question = {
      ...question,
      id: generateId(),
      status: 'pending',
      createdAt: new Date(),
    };
    setPendingQuestions(prev => [...prev, q]);
    updateStatus('waiting_input');
    onQuestion?.(q);
    return q.id;
  }, [onQuestion, updateStatus]);

  // Answer a question
  const answerQuestion = useCallback(async (questionId: string, answer: any) => {
    setPendingQuestions(prev => 
      prev.map(q => q.id === questionId 
        ? { ...q, status: 'answered', answer, answeredAt: new Date() } 
        : q
      )
    );

    // Notify API
    await fetch('/api/chat', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, answer }),
    });

    // Check if more questions pending
    const remaining = pendingQuestions.filter(q => 
      q.id !== questionId && q.status === 'pending'
    );
    
    if (remaining.length === 0) {
      updateStatus('thinking');
    }

    addToHistory('question', { questionId, answer });
  }, [pendingQuestions, updateStatus]);

  // Add to workflow history
  const addToHistory = useCallback((type: WorkflowStep['type'], data: any) => {
    setWorkflowHistory(prev => [...prev, {
      id: generateId(),
      type,
      data,
      timestamp: new Date(),
    }]);
  }, []);

  // Send a message
  const sendMessage = useCallback(async (content: string, attachments?: any[]) => {
    updateStatus('thinking');
    addToHistory('message', { role: 'user', content, attachments });
    
    await chat.append({
      role: 'user',
      content,
      // Attachments would be handled differently based on your setup
    });
  }, [chat, updateStatus, addToHistory]);

  // Pause workflow
  const pause = useCallback(() => {
    if (status !== 'paused') {
      updateStatus('paused');
    }
  }, [status, updateStatus]);

  // Resume workflow
  const resume = useCallback(() => {
    if (status === 'paused') {
      // Resume based on what was happening before pause
      if (pendingToolCalls.some(tc => tc.status === 'pending')) {
        updateStatus('waiting_approval');
      } else if (pendingQuestions.some(q => q.status === 'pending')) {
        updateStatus('waiting_input');
      } else {
        updateStatus('idle');
      }
    }
  }, [status, pendingToolCalls, pendingQuestions, updateStatus]);

  // Reset workflow
  const reset = useCallback(() => {
    chat.setMessages([]);
    setPendingToolCalls([]);
    setPendingQuestions([]);
    setWorkflowHistory([]);
    updateStatus('idle');
  }, [chat, updateStatus]);

  // Computed values
  const pendingApprovals = useMemo(() => 
    pendingToolCalls.filter(tc => tc.status === 'pending'),
    [pendingToolCalls]
  );

  const pendingInputs = useMemo(() => 
    pendingQuestions.filter(q => q.status === 'pending'),
    [pendingQuestions]
  );

  return {
    // Chat state from Vercel AI SDK
    messages: chat.messages,
    input: chat.input,
    handleInputChange: chat.handleInputChange,
    isLoading: chat.isLoading,
    
    // Workflow state
    status,
    autoApprove,
    toolPermissions,
    pendingToolCalls,
    pendingQuestions,
    pendingApprovals,
    pendingInputs,
    workflowHistory,
    
    // Actions
    sendMessage,
    approveToolCall,
    rejectToolCall,
    approveAllPending,
    rejectAllPending,
    askQuestion,
    answerQuestion,
    pause,
    resume,
    reset,
    stop: chat.stop,
    reload: chat.reload,
    
    // Settings
    setAutoApprove,
    setToolPermissions,
  };
}

// ============================================================================
// USE SESSIONS HOOK
// ============================================================================

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Load sessions from storage
  useEffect(() => {
    const stored = localStorage.getItem('workflow-sessions');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSessions(parsed.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        })));
      } catch (e) {
        console.error('Failed to load sessions:', e);
      }
    }
  }, []);

  // Save sessions to storage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('workflow-sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  const createSession = useCallback((name: string) => {
    const session: Session = {
      id: generateId(),
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      toolCalls: [],
      questions: [],
    };
    setSessions(prev => [...prev, session]);
    setActiveSessionId(session.id);
    return session;
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
    }
  }, [activeSessionId]);

  const renameSession = useCallback((sessionId: string, name: string) => {
    setSessions(prev => prev.map(s => 
      s.id === sessionId ? { ...s, name, updatedAt: new Date() } : s
    ));
  }, []);

  const activeSession = useMemo(() => 
    sessions.find(s => s.id === activeSessionId),
    [sessions, activeSessionId]
  );

  return {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    createSession,
    deleteSession,
    renameSession,
  };
}

// ============================================================================
// USE KEYBOARD SHORTCUTS HOOK
// ============================================================================

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[], enabled = true) {
  useEffect(() => {
    if (!enabled) {return;}

    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey;
        const metaMatch = shortcut.meta ? e.metaKey : true;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

// ============================================================================
// USE SPEECH RECOGNITION HOOK
// ============================================================================

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;

        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              finalTranscript += result[0].transcript;
            }
          }
          if (finalTranscript) {
            setTranscript(prev => prev + finalTranscript);
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          setError(event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      setTranscript('');
      setError(null);
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: !!recognitionRef.current,
  };
}
