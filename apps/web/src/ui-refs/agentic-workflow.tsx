// ============================================================================
// AGENTIC WORKFLOW - TYPESCRIPT VERSION
// Comprehensive multi-turn workflow with tool approval, questions, and more
// ============================================================================

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import {
  Send, Paperclip, Image, Mic, Square, Play, Pause, Check, X,
  ChevronDown, Settings, RotateCcw, Loader2, FileText, Code,
  Globe, Database, Terminal, Sparkles, Clock, CheckCircle2, XCircle,
  MessageSquare, Bot, User, Wrench, HelpCircle,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Workflow status states */
export type WorkflowStatus =
  | 'idle'
  | 'thinking'
  | 'executing'
  | 'waiting_approval'
  | 'waiting_input'
  | 'complete'
  | 'error';

/** Tool request status */
export type ToolRequestStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'complete';

/** Question status */
export type QuestionStatus = 'pending' | 'answered';

/** Question input type */
export type QuestionInputType = 'text' | 'textarea';

/** Question type */
export type QuestionType = 'multiple_choice' | 'text';

/** Tool type identifiers */
export type ToolType = 'web_search' | 'code_execution' | 'file_read' | 'database_query' | 'terminal' | 'default';

/** Avatar type */
export type AvatarType = 'user' | 'assistant';

/** Attachment type */
export type AttachmentType = 'image' | 'file';

/** Model configuration */
export interface ModelConfig {
  id: string;
  name: string;
  description: string;
}

/** Session */
export interface Session {
  id: string;
  name: string;
  createdAt: Date;
}

/** Attachment */
export interface Attachment {
  id: string;
  name: string;
  type: AttachmentType;
  file: File;
  preview: string | null;
}

/** Tool parameters */
export interface ToolParameters {
  [key: string]: unknown;
}

/** Tool result */
export interface ToolResult {
  results?: Array<{ title: string; snippet: string }>;
  [key: string]: unknown;
}

/** Tool definition */
export interface ToolDefinition {
  name: string;
  type: ToolType;
  description: string;
  parameters: ToolParameters;
  result?: ToolResult;
}

/** Question option */
export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
}

/** Question definition */
export interface QuestionDefinition {
  type: QuestionType;
  text: string;
  options?: QuestionOption[];
  multiSelect?: boolean;
  inputType?: QuestionInputType;
  placeholder?: string;
  answer?: string | string[];
}

/** User message */
export interface UserMessageData {
  type: 'user';
  content: string;
  attachments?: Attachment[];
}

/** Assistant message */
export interface AssistantMessageData {
  type: 'assistant';
  content: string;
  isStreaming?: boolean;
}

/** Tool request message */
export interface ToolRequestMessageData {
  type: 'tool_request';
  id: string;
  tool: ToolDefinition;
  status: ToolRequestStatus;
}

/** Question message */
export interface QuestionMessageData {
  type: 'question';
  id: string;
  question: QuestionDefinition;
  status: QuestionStatus;
}

/** All message types */
export type MessageData =
  | UserMessageData
  | AssistantMessageData
  | ToolRequestMessageData
  | QuestionMessageData;

/** Dropdown option */
export interface DropdownOption {
  id: string;
  name: string;
  description?: string;
}

/** Send message payload */
export interface SendMessagePayload {
  content: string;
  attachments: Attachment[];
}

/** Tool request status configuration */
export interface StatusConfig {
  icon: LucideIcon;
  color: string;
  bg: string;
  label: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MODELS: ModelConfig[] = [
  { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', description: 'Most capable' },
  { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', description: 'Balanced' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', description: 'Fast' },
];

const TOOL_ICONS: Record<ToolType, LucideIcon> = {
  web_search: Globe,
  code_execution: Code,
  file_read: FileText,
  database_query: Database,
  terminal: Terminal,
  default: Wrench,
};

const STATUS_COLORS: Record<WorkflowStatus, string> = {
  idle: 'bg-gray-400',
  thinking: 'bg-amber-500 animate-pulse',
  executing: 'bg-blue-500 animate-pulse',
  waiting_approval: 'bg-orange-500',
  waiting_input: 'bg-purple-500',
  complete: 'bg-green-500',
  error: 'bg-red-500',
};

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  label: string;
  renderOption?: (option: DropdownOption) => React.ReactNode;
}

const Dropdown: React.FC<DropdownProps> = ({ value, onChange, options, label, renderOption }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {setIsOpen(false);}
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find(o => o.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors min-w-[180px]"
      >
        <span className="text-xs text-gray-400 mr-1">{label}:</span>
        <span className="text-sm text-white truncate flex-1 text-left">
          {selected?.name || 'Select...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {options.map(option => (
            <button
              key={option.id}
              onClick={() => { onChange(option.id); setIsOpen(false); }}
              className={`w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors ${
                value === option.id ? 'bg-gray-700' : ''
              }`}
            >
              {renderOption ? renderOption(option) : (
                <div>
                  <div className="text-sm text-white">{option.name}</div>
                  {option.description && (
                    <div className="text-xs text-gray-400">{option.description}</div>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface StatusBadgeProps {
  status: WorkflowStatus;
  label: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-full">
    <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
    <span className="text-xs text-gray-300">{label}</span>
  </div>
);

interface AvatarProps {
  type: AvatarType;
}

const Avatar: React.FC<AvatarProps> = ({ type }) => {
  const isUser = type === 'user';
  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
      isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-orange-500 to-amber-600'
    }`}>
      {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
    </div>
  );
};

// ============================================================================
// MESSAGE COMPONENTS
// ============================================================================

interface UserMessageProps {
  content: string;
  attachments?: Attachment[];
}

const UserMessage: React.FC<UserMessageProps> = ({ content, attachments }) => (
  <div className="flex gap-3 justify-end">
    <div className="max-w-[80%]">
      {attachments && attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 justify-end">
          {attachments.map((att, i) => (
            <div key={i} className="relative group">
              {att.type === 'image' ? (
                <img src={att.preview || undefined} alt="" className="h-20 rounded-lg object-cover" />
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-300">{att.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-br-md">
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
    </div>
    <Avatar type="user" />
  </div>
);

interface AssistantMessageProps {
  content: string;
  isStreaming?: boolean;
}

const AssistantMessage: React.FC<AssistantMessageProps> = ({ content, isStreaming }) => (
  <div className="flex gap-3">
    <Avatar type="assistant" />
    <div className="max-w-[80%] bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-md border border-gray-700">
      <p className="text-sm text-gray-100 whitespace-pre-wrap">
        {content}
        {isStreaming && <span className="inline-block w-2 h-4 bg-amber-500 ml-1 animate-pulse" />}
      </p>
    </div>
  </div>
);

interface ThinkingIndicatorProps {
  thought?: string;
}

const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ thought }) => (
  <div className="flex gap-3">
    <Avatar type="assistant" />
    <div className="bg-gray-800/50 border border-gray-700/50 px-4 py-3 rounded-2xl rounded-bl-md">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <span className="text-xs font-medium text-amber-500">Thinking...</span>
      </div>
      {thought && (
        <p className="text-xs text-gray-400 italic">{thought}</p>
      )}
      <div className="flex gap-1 mt-2">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  </div>
);

// ============================================================================
// TOOL REQUEST COMPONENT
// ============================================================================

interface ToolRequestProps {
  tool: ToolDefinition;
  onApprove?: () => void;
  onReject?: () => void;
  onModify?: (params: ToolParameters) => void;
  status: ToolRequestStatus;
}

const ToolRequest: React.FC<ToolRequestProps> = ({ tool, onApprove, onReject, onModify, status }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [modifiedParams, setModifiedParams] = useState(JSON.stringify(tool.parameters, null, 2));
  const [isModifying, setIsModifying] = useState(false);

  const IconComponent = TOOL_ICONS[tool.type] || TOOL_ICONS.default;

  const statusConfig: Record<ToolRequestStatus, StatusConfig> = {
    pending: { icon: Clock, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'Awaiting Approval' },
    approved: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Approved' },
    rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Rejected' },
    executing: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Executing...' },
    complete: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Complete' },
  };

  const currentStatus = statusConfig[status] || statusConfig.pending;
  const StatusIcon = currentStatus.icon;

  const handleApprove = () => {
    if (isModifying) {
      try {
        const parsed = JSON.parse(modifiedParams);
        onModify?.(parsed);
        setIsModifying(false);
      } catch {
        alert('Invalid JSON');
        return;
      }
    }
    onApprove?.();
  };

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
        <Wrench className="w-4 h-4 text-gray-400" />
      </div>
      <div className={`flex-1 max-w-[85%] rounded-xl border overflow-hidden ${
        status === 'pending' ? 'border-orange-500/50 bg-orange-500/5' : 'border-gray-700 bg-gray-800/50'
      }`}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-700/30 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center">
              <IconComponent className="w-4 h-4 text-gray-300" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">{tool.name}</div>
              <div className="text-xs text-gray-400">{tool.description}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${currentStatus.bg}`}>
              <StatusIcon className={`w-3 h-3 ${currentStatus.color} ${status === 'executing' ? 'animate-spin' : ''}`} />
              <span className={`text-xs ${currentStatus.color}`}>{currentStatus.label}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-700/50">
            {/* Parameters */}
            <div className="mt-3">
              <div className="text-xs font-medium text-gray-400 mb-2">Parameters</div>
              {isModifying ? (
                <textarea
                  value={modifiedParams}
                  onChange={(e) => setModifiedParams(e.target.value)}
                  className="w-full h-32 bg-gray-900 text-gray-300 text-xs font-mono p-3 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
                />
              ) : (
                <pre className="bg-gray-900 text-gray-300 text-xs font-mono p-3 rounded-lg overflow-x-auto">
                  {JSON.stringify(tool.parameters, null, 2)}
                </pre>
              )}
            </div>

            {/* Tool Result (if complete) */}
            {status === 'complete' && tool.result && (
              <div className="mt-3">
                <div className="text-xs font-medium text-gray-400 mb-2">Result</div>
                <pre className="bg-gray-900 text-green-400 text-xs font-mono p-3 rounded-lg overflow-x-auto max-h-40">
                  {typeof tool.result === 'string' ? tool.result : JSON.stringify(tool.result, null, 2)}
                </pre>
              </div>
            )}

            {/* Action Buttons */}
            {status === 'pending' && (
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Check className="w-4 h-4" />
                  {isModifying ? 'Save & Approve' : 'Approve'}
                </button>
                <button
                  onClick={onReject}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-600/30"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
                <button
                  onClick={() => setIsModifying(!isModifying)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  {isModifying ? 'Cancel Edit' : 'Modify'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// QUESTION REQUEST COMPONENT
// ============================================================================

interface QuestionRequestProps {
  question: QuestionDefinition;
  onSubmit: (answer: string | string[]) => void;
  status: QuestionStatus;
}

const QuestionRequest: React.FC<QuestionRequestProps> = ({ question, onSubmit, status }) => {
  const [answer, setAnswer] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const handleSubmit = () => {
    if (question.type === 'multiple_choice') {
      onSubmit(question.multiSelect ? selectedOptions : selectedOptions[0]);
    } else {
      onSubmit(answer);
    }
  };

  const toggleOption = (optionId: string) => {
    if (question.multiSelect) {
      setSelectedOptions(prev =>
        prev.includes(optionId)
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    } else {
      setSelectedOptions([optionId]);
    }
  };

  const isAnswered = status === 'answered';
  const canSubmit = question.type === 'multiple_choice'
    ? selectedOptions.length > 0
    : answer.trim().length > 0;

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
        <HelpCircle className="w-4 h-4 text-white" />
      </div>
      <div className={`flex-1 max-w-[85%] rounded-xl border overflow-hidden ${
        !isAnswered ? 'border-purple-500/50 bg-purple-500/5' : 'border-gray-700 bg-gray-800/50'
      }`}>
        <div className="px-4 py-3">
          {/* Question Header */}
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-purple-400">
              {isAnswered ? 'Question Answered' : 'Input Required'}
            </span>
          </div>

          {/* Question Text */}
          <p className="text-sm text-white mb-4">{question.text}</p>

          {/* Answer Input */}
          {!isAnswered ? (
            <>
              {question.type === 'multiple_choice' && question.options ? (
                <div className="space-y-2 mb-4">
                  {question.options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => toggleOption(option.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left ${
                        selectedOptions.includes(option.id)
                          ? 'border-purple-500 bg-purple-500/20 text-white'
                          : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-${question.multiSelect ? 'md' : 'full'} border-2 flex items-center justify-center transition-colors ${
                        selectedOptions.includes(option.id)
                          ? 'border-purple-500 bg-purple-500'
                          : 'border-gray-600'
                      }`}>
                        {selectedOptions.includes(option.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{option.label}</div>
                        {option.description && (
                          <div className="text-xs text-gray-400">{option.description}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mb-4">
                  {question.inputType === 'textarea' ? (
                    <textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder={question.placeholder || 'Type your answer...'}
                      className="w-full h-24 bg-gray-900 text-white text-sm p-3 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none resize-none placeholder-gray-500"
                    />
                  ) : (
                    <input
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder={question.placeholder || 'Type your answer...'}
                      className="w-full bg-gray-900 text-white text-sm px-4 py-3 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none placeholder-gray-500"
                    />
                  )}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  canSubmit
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
                Submit Answer
              </button>
            </>
          ) : (
            <div className="bg-gray-800 rounded-lg px-4 py-3 border border-gray-700">
              <div className="text-xs text-gray-400 mb-1">Your answer:</div>
              <div className="text-sm text-white">
                {question.type === 'multiple_choice' && question.options
                  ? question.options
                      .filter(o => (question.answer || []).includes(o.id))
                      .map(o => o.label)
                      .join(', ')
                  : question.answer
                }
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// INPUT AREA COMPONENT
// ============================================================================

interface InputAreaProps {
  onSend: (payload: SendMessagePayload) => void;
  disabled: boolean;
  isRecording: boolean;
  onToggleRecording: () => void;
}

const InputArea: React.FC<InputAreaProps> = ({ onSend, disabled, isRecording, onToggleRecording }) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (message.trim() || attachments.length > 0) {
      onSend({ content: message, attachments });
      setMessage('');
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>, type: AttachmentType) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: Attachment[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      type,
      file,
      preview: type === 'image' ? URL.createObjectURL(file) : null,
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const att = prev.find(a => a.id === id);
      if (att?.preview) {URL.revokeObjectURL(att.preview);}
      return prev.filter(a => a.id !== id);
    });
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [message]);

  return (
    <div className="border-t border-gray-800 bg-gray-900/50 p-4">
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map(att => (
            <div key={att.id} className="relative group">
              {att.type === 'image' ? (
                <div className="relative">
                  <img
                    src={att.preview || undefined}
                    alt=""
                    className="h-16 w-16 object-cover rounded-lg border border-gray-700"
                  />
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <div className="relative flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-300 max-w-[100px] truncate">{att.name}</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="text-gray-500 hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-2">
        {/* Attachment Buttons */}
        <div className="flex gap-1">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'file')}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'image')}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Attach files"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <button
            onClick={() => imageInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            title="Attach images"
          >
            <Image className="w-5 h-5" />
          </button>
          <button
            onClick={onToggleRecording}
            className={`p-2 rounded-lg transition-colors ${
              isRecording
                ? 'text-red-400 bg-red-400/20 hover:bg-red-400/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            title={isRecording ? 'Stop recording' : 'Voice input'}
          >
            {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        </div>

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Claude..."
            disabled={disabled}
            rows={1}
            className="w-full bg-gray-800 text-white text-sm px-4 py-3 rounded-xl border border-gray-700 focus:border-amber-500 focus:outline-none resize-none placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={disabled || (!message.trim() && attachments.length === 0)}
          className={`p-3 rounded-xl transition-colors ${
            !disabled && (message.trim() || attachments.length > 0)
              ? 'bg-amber-500 hover:bg-amber-400 text-white'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// WORKFLOW CONTROLS COMPONENT
// ============================================================================

interface WorkflowControlsProps {
  isPaused: boolean;
  onPauseResume: () => void;
  onCancel: () => void;
  onReset: () => void;
  autoApprove: boolean;
  onToggleAutoApprove: () => void;
  status: WorkflowStatus;
}

const WorkflowControls: React.FC<WorkflowControlsProps> = ({
  isPaused,
  onPauseResume,
  onCancel,
  onReset,
  autoApprove,
  onToggleAutoApprove,
  status,
}) => (
  <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-t border-gray-700/50">
    <div className="flex items-center gap-2">
      <button
        onClick={onPauseResume}
        disabled={status === 'idle' || status === 'complete'}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          isPaused
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-amber-600 hover:bg-amber-500 text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        {isPaused ? 'Resume' : 'Pause'}
      </button>
      <button
        onClick={onCancel}
        disabled={status === 'idle' || status === 'complete'}
        className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm font-medium transition-colors border border-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <X className="w-4 h-4" />
        Cancel
      </button>
      <button
        onClick={onReset}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        Reset
      </button>
    </div>

    <label className="flex items-center gap-2 cursor-pointer">
      <span className="text-xs text-gray-400">Auto-approve tools</span>
      <button
        onClick={onToggleAutoApprove}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          autoApprove ? 'bg-green-600' : 'bg-gray-700'
        }`}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
          autoApprove ? 'translate-x-5' : 'translate-x-0.5'
        }`} />
      </button>
    </label>
  </div>
);

// ============================================================================
// MAIN AGENTIC WORKFLOW COMPONENT
// ============================================================================

const AgenticWorkflow: React.FC = () => {
  // State
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5');
  const [selectedSession, setSelectedSession] = useState('session-1');
  const [sessions] = useState<Session[]>([
    { id: 'session-1', name: 'Project Analysis', createdAt: new Date() },
    { id: 'session-2', name: 'Code Review', createdAt: new Date() },
    { id: 'session-3', name: 'Research Task', createdAt: new Date() },
  ]);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [status, setStatus] = useState<WorkflowStatus>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentThought, setCurrentThought] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentThought]);

  // Simulate agent workflow
  const simulateWorkflow = useCallback(async (userMessage: SendMessagePayload) => {
    // Add user message
    setMessages(prev => [...prev, { type: 'user', ...userMessage }]);

    // Simulate thinking
    setStatus('thinking');
    setCurrentThought('Analyzing the request and planning approach...');
    await new Promise(r => setTimeout(r, 1500));

    // Add initial response
    setMessages(prev => [...prev, {
      type: 'assistant',
      content: "I'll help you with that. Let me break this down into steps and gather the necessary information.",
      isStreaming: false,
    }]);

    setCurrentThought('Identifying required tools and resources...');
    await new Promise(r => setTimeout(r, 1000));
    setCurrentThought('');

    // Simulate tool request
    setStatus('waiting_approval');
    const toolId = Math.random().toString(36).substr(2, 9);
    setMessages(prev => [...prev, {
      type: 'tool_request',
      id: toolId,
      tool: {
        name: 'web_search',
        type: 'web_search',
        description: 'Search the web for relevant information',
        parameters: {
          query: 'latest information about ' + userMessage.content.substring(0, 50),
          max_results: 5,
          include_snippets: true,
        },
      },
      status: autoApprove ? 'approved' : 'pending',
    }]);

    if (autoApprove) {
      await executeToolAutomatically(toolId);
    }
  }, [autoApprove]);

  const executeToolAutomatically = async (toolId: string) => {
    // Update tool status to executing
    setMessages(prev => prev.map(m =>
      m.type === 'tool_request' && m.id === toolId ? { ...m, status: 'executing' as ToolRequestStatus } : m
    ));
    setStatus('executing');

    await new Promise(r => setTimeout(r, 2000));

    // Update tool status to complete with result
    setMessages(prev => prev.map(m =>
      m.type === 'tool_request' && m.id === toolId ? {
        ...m,
        status: 'complete' as ToolRequestStatus,
        tool: {
          ...m.tool,
          result: {
            results: [
              { title: 'Result 1', snippet: 'Relevant information found...' },
              { title: 'Result 2', snippet: 'Additional context available...' },
            ],
          },
        },
      } : m
    ));

    // Continue workflow with question
    await new Promise(r => setTimeout(r, 500));
    askQuestion();
  };

  const askQuestion = () => {
    setStatus('waiting_input');
    const questionId = Math.random().toString(36).substr(2, 9);
    setMessages(prev => [...prev, {
      type: 'question',
      id: questionId,
      question: {
        type: 'multiple_choice',
        text: 'Based on my analysis, I have a few approaches we could take. Which would you prefer?',
        multiSelect: false,
        options: [
          { id: 'detailed', label: 'Detailed Analysis', description: 'Comprehensive deep-dive with all details' },
          { id: 'summary', label: 'Quick Summary', description: 'High-level overview of key points' },
          { id: 'actionable', label: 'Actionable Steps', description: 'Focus on concrete next steps' },
        ],
      },
      status: 'pending',
    }]);
  };

  const handleToolApprove = (messageId: string) => {
    setMessages(prev => prev.map(m =>
      m.type === 'tool_request' && m.id === messageId ? { ...m, status: 'approved' as ToolRequestStatus } : m
    ));
    void executeToolAutomatically(messageId);
  };

  const handleToolReject = (messageId: string) => {
    setMessages(prev => prev.map(m =>
      m.type === 'tool_request' && m.id === messageId ? { ...m, status: 'rejected' as ToolRequestStatus } : m
    ));
    setStatus('idle');
    setMessages(prev => [...prev, {
      type: 'assistant',
      content: "I understand. The tool request was rejected. Is there another way I can help you with this task?",
    }]);
  };

  const handleQuestionSubmit = async (messageId: string, answer: string | string[]) => {
    setMessages(prev => prev.map(m =>
      m.type === 'question' && m.id === messageId ? {
        ...m,
        status: 'answered' as QuestionStatus,
        question: { ...m.question, answer: Array.isArray(answer) ? answer : [answer] },
      } : m
    ));

    setStatus('thinking');
    setCurrentThought('Processing your response...');
    await new Promise(r => setTimeout(r, 1500));
    setCurrentThought('');

    // Final response
    setStatus('complete');
    setMessages(prev => [...prev, {
      type: 'assistant',
      content: `Perfect! Based on your preference, I'll proceed with the ${
        Array.isArray(answer) ? answer[0] : answer
      } approach.\n\nHere's what I found:\n\n• The analysis reveals several key insights about your query\n• I've identified 3 main areas of focus\n• There are actionable recommendations we can discuss\n\nWould you like me to elaborate on any of these points?`,
    }]);
  };

  const handleSend = (message: SendMessagePayload) => {
    if (status === 'idle' || status === 'complete') {
      void simulateWorkflow(message);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setStatus('idle');
    setIsPaused(false);
    setCurrentThought('');
  };

  const getStatusLabel = (): string => {
    const labels: Record<WorkflowStatus, string> = {
      idle: 'Ready',
      thinking: 'Thinking...',
      executing: 'Executing tool...',
      waiting_approval: 'Waiting for approval',
      waiting_input: 'Waiting for input',
      complete: 'Complete',
      error: 'Error occurred',
    };
    return labels[status] || 'Unknown';
  };

  // Session options for dropdown
  const sessionOptions: DropdownOption[] = sessions.map(s => ({
    id: s.id,
    name: s.name,
  }));

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg">Agentic Workflow</span>
          </div>

          <div className="h-6 w-px bg-gray-700" />

          <Dropdown
            value={selectedModel}
            onChange={setSelectedModel}
            options={MODELS}
            label="Model"
          />

          <Dropdown
            value={selectedSession}
            onChange={setSelectedSession}
            options={sessionOptions}
            label="Session"
          />
        </div>

        <StatusBadge status={status} label={getStatusLabel()} />
      </header>

      {/* Messages Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Start an Agentic Workflow</h2>
            <p className="text-gray-400 max-w-md">
              Send a message to begin. I can use tools, ask clarifying questions,
              and work through complex tasks step by step.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              switch (message.type) {
                case 'user':
                  return <UserMessage key={index} content={message.content} attachments={message.attachments} />;
                case 'assistant':
                  return <AssistantMessage key={index} content={message.content} isStreaming={message.isStreaming} />;
                case 'tool_request':
                  return (
                    <ToolRequest
                      key={message.id}
                      tool={message.tool}
                      status={message.status}
                      onApprove={() => handleToolApprove(message.id)}
                      onReject={() => handleToolReject(message.id)}
                    />
                  );
                case 'question':
                  return (
                    <QuestionRequest
                      key={message.id}
                      question={message.question}
                      status={message.status}
                      onSubmit={(answer) => handleQuestionSubmit(message.id, answer)}
                    />
                  );
                default:
                  return null;
              }
            })}

            {status === 'thinking' && (
              <ThinkingIndicator thought={currentThought} />
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Workflow Controls */}
      <WorkflowControls
        isPaused={isPaused}
        onPauseResume={() => setIsPaused(!isPaused)}
        onCancel={() => setStatus('idle')}
        onReset={handleReset}
        autoApprove={autoApprove}
        onToggleAutoApprove={() => setAutoApprove(!autoApprove)}
        status={status}
      />

      {/* Input Area */}
      <InputArea
        onSend={handleSend}
        disabled={status === 'waiting_approval' || status === 'waiting_input' || isPaused}
        isRecording={isRecording}
        onToggleRecording={() => setIsRecording(!isRecording)}
      />
    </div>
  );
};

export default AgenticWorkflow;

// ============================================================================
// EXPORTS
// ============================================================================

export {
  Dropdown,
  StatusBadge,
  Avatar,
  UserMessage,
  AssistantMessage,
  ThinkingIndicator,
  ToolRequest,
  QuestionRequest,
  InputArea,
  WorkflowControls,
  MODELS,
  TOOL_ICONS,
  STATUS_COLORS,
};
