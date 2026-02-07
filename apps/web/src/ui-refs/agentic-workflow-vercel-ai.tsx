// ============================================================================
// AGENTIC WORKFLOW WITH VERCEL AI SDK - TYPESCRIPT VERSION
// Comprehensive multi-turn workflow with tool approval, questions, and more
// ============================================================================

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
  type RefObject,
  type KeyboardEvent,
  type ChangeEvent,
  type MouseEvent,
  type CSSProperties,
} from 'react';
import { useChat } from 'ai/react';
import { generateId } from 'ai';
import type { Message as AIMessage, ToolInvocation } from 'ai';
import {
  Send, Paperclip, Image, Mic, Square, Play, Pause, Check, X,
  ChevronDown, ChevronRight, ChevronUp, Settings, RotateCcw, Loader2,
  AlertCircle, FileText, Code, Globe, Database, Terminal, Sparkles,
  Clock, CheckCircle2, XCircle, CircleDot, MessageSquare, Upload,
  Trash2, Eye, EyeOff, Bot, User, Wrench, HelpCircle, Command,
  Zap, Shield, ShieldAlert, ShieldCheck, ShieldOff, Layers, Search,
  Sun, Moon, PanelLeft, Maximize2, History, RefreshCw, Download,
  Plus, Copy, ExternalLink, Keyboard, Filter, MoreHorizontal,
  AlertTriangle, Info, Star, Bookmark, Hash, ArrowRight, Cpu,
  GitBranch, Workflow, Activity, BarChart3, Timer, Target,
  Lightbulb, Brain, Wand2, Telescope, Microscope, Beaker,
  FolderOpen, Save, Share2, Lock, Unlock, Volume2, VolumeX,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Risk levels for tools */
export type RiskLevel = 'low' | 'medium' | 'high';

/** Permission actions for tools */
export type PermissionAction = 'auto' | 'ask' | 'deny';

/** Tool categories */
export type ToolCategory = 'web' | 'code' | 'data' | 'file' | 'system' | 'ai';

/** Workflow status states */
export type WorkflowStatusType =
  | 'idle'
  | 'thinking'
  | 'executing'
  | 'waiting_approval'
  | 'waiting_input'
  | 'paused'
  | 'complete'
  | 'error';

/** Tool call status */
export type ToolCallStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'complete';

/** Question status */
export type QuestionStatus = 'pending' | 'answered';

/** Question types */
export type QuestionType = 'text' | 'choice';

/** System message types */
export type SystemMessageType = 'info' | 'warning' | 'error' | 'success';

/** Avatar types */
export type AvatarType = 'user' | 'assistant';

/** Avatar sizes */
export type AvatarSize = 'sm' | 'md' | 'lg';

/** Toggle sizes */
export type ToggleSize = 'sm' | 'md';

/** Model provider */
export type ModelProvider = 'anthropic' | 'openai';

// ============================================================================
// INTERFACES
// ============================================================================

/** Model configuration */
export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  description: string;
  icon: LucideIcon;
}

/** Tool category configuration */
export interface ToolCategoryConfig {
  name: string;
  icon: LucideIcon;
  color: string;
}

/** Tool definition */
export interface ToolDefinition {
  id: string;
  name: string;
  category: ToolCategory;
  risk: RiskLevel;
  description: string;
}

/** Risk configuration */
export interface RiskConfig {
  color: string;
  icon: LucideIcon;
  label: string;
  defaultAction: PermissionAction;
}

/** Workflow status configuration */
export interface WorkflowStatusConfig {
  label: string;
  color: string;
  icon: LucideIcon;
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
  type: string;
  file?: File;
  url?: string;
  preview?: string | null;
}

/** Extended message with attachments and timestamp */
export interface ExtendedMessage extends AIMessage {
  attachments?: Attachment[];
  timestamp?: string;
}

/** Tool call with status */
export interface ToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  result?: unknown;
}

/** Question option */
export interface QuestionOption {
  id: string;
  label: string;
}

/** Question */
export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: QuestionOption[];
  multiple?: boolean;
  multiline?: boolean;
  placeholder?: string;
  status: QuestionStatus;
  answer?: string | string[];
}

/** Tool permissions by risk level */
export interface ToolPermissions {
  low: PermissionAction;
  medium: PermissionAction;
  high: PermissionAction;
}

/** Command */
export interface Command {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  category: string;
}

/** Dropdown option */
export interface DropdownOption {
  id: string;
  name: string;
  icon?: LucideIcon;
  description?: string;
}

/** Send message payload */
export interface SendMessagePayload {
  content: string;
  attachments: Attachment[];
}

/** Workflow context value */
export interface WorkflowContextValue {
  workflowStatus: WorkflowStatusType;
  setWorkflowStatus: React.Dispatch<React.SetStateAction<WorkflowStatusType>>;
  autoApprove: boolean;
  setAutoApprove: React.Dispatch<React.SetStateAction<boolean>>;
  toolPermissions: ToolPermissions;
  setToolPermissions: React.Dispatch<React.SetStateAction<ToolPermissions>>;
  pendingToolCalls: ToolCall[];
  pendingQuestions: Question[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MODELS: ModelConfig[] = [
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', description: 'Most capable', icon: Brain },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', description: 'Fast', icon: Zap },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', description: 'Powerful', icon: Sparkles },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', description: 'Multimodal', icon: Eye },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', description: 'Efficient', icon: Cpu },
];

const TOOL_CATEGORIES: Record<ToolCategory, ToolCategoryConfig> = {
  web: { name: 'Web', icon: Globe, color: 'blue' },
  code: { name: 'Code', icon: Code, color: 'purple' },
  data: { name: 'Data', icon: Database, color: 'green' },
  file: { name: 'Files', icon: FileText, color: 'amber' },
  system: { name: 'System', icon: Terminal, color: 'red' },
  ai: { name: 'AI/ML', icon: Brain, color: 'pink' },
};

const AVAILABLE_TOOLS: ToolDefinition[] = [
  { id: 'web_search', name: 'Web Search', category: 'web', risk: 'low', description: 'Search the internet for information' },
  { id: 'web_scrape', name: 'Web Scrape', category: 'web', risk: 'low', description: 'Extract content from web pages' },
  { id: 'code_execute', name: 'Code Execution', category: 'code', risk: 'high', description: 'Run code in a sandbox' },
  { id: 'code_analyze', name: 'Code Analysis', category: 'code', risk: 'low', description: 'Analyze code for issues' },
  { id: 'file_read', name: 'File Read', category: 'file', risk: 'low', description: 'Read file contents' },
  { id: 'file_write', name: 'File Write', category: 'file', risk: 'high', description: 'Write to files' },
  { id: 'db_query', name: 'Database Query', category: 'data', risk: 'medium', description: 'Query databases' },
  { id: 'db_mutate', name: 'Database Mutate', category: 'data', risk: 'high', description: 'Modify database records' },
  { id: 'shell_exec', name: 'Shell Execute', category: 'system', risk: 'high', description: 'Run shell commands' },
  { id: 'ai_embed', name: 'AI Embeddings', category: 'ai', risk: 'low', description: 'Generate embeddings' },
  { id: 'ai_generate', name: 'AI Generate', category: 'ai', risk: 'medium', description: 'Generate content with AI' },
];

const RISK_CONFIG: Record<RiskLevel, RiskConfig> = {
  low: { color: 'green', icon: ShieldCheck, label: 'Low Risk', defaultAction: 'auto' },
  medium: { color: 'amber', icon: Shield, label: 'Medium Risk', defaultAction: 'ask' },
  high: { color: 'red', icon: ShieldAlert, label: 'High Risk', defaultAction: 'ask' },
};

const WORKFLOW_STATUS: Record<WorkflowStatusType, WorkflowStatusConfig> = {
  idle: { label: 'Ready', color: 'gray', icon: CircleDot },
  thinking: { label: 'Thinking...', color: 'amber', icon: Brain },
  executing: { label: 'Executing...', color: 'blue', icon: Activity },
  waiting_approval: { label: 'Awaiting Approval', color: 'orange', icon: Clock },
  waiting_input: { label: 'Input Required', color: 'purple', icon: HelpCircle },
  paused: { label: 'Paused', color: 'yellow', icon: Pause },
  complete: { label: 'Complete', color: 'green', icon: CheckCircle2 },
  error: { label: 'Error', color: 'red', icon: AlertCircle },
};

// ============================================================================
// CONTEXT
// ============================================================================

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

const useWorkflow = (): WorkflowContextValue => {
  const context = useContext(WorkflowContext);
  if (!context) {throw new Error('useWorkflow must be used within WorkflowProvider');}
  return context;
};

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

interface AvatarProps {
  type: AvatarType;
  size?: AvatarSize;
}

const Avatar: React.FC<AvatarProps> = ({ type, size = 'md' }) => {
  const sizes: Record<AvatarSize, string> = { sm: 'w-6 h-6', md: 'w-8 h-8', lg: 'w-10 h-10' };
  const iconSizes: Record<AvatarSize, string> = { sm: 'w-3 h-3', md: 'w-4 h-4', lg: 'w-5 h-5' };
  const isUser = type === 'user';
  return (
    <div className={`${sizes[size]} rounded-lg flex items-center justify-center flex-shrink-0 ${
      isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-orange-500 to-amber-600'
    }`}>
      {isUser ? <User className={`${iconSizes[size]} text-white`} /> : <Bot className={`${iconSizes[size]} text-white`} />}
    </div>
  );
};

interface StatusBadgeProps {
  status: WorkflowStatusType;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = WORKFLOW_STATUS[status] || WORKFLOW_STATUS.idle;
  const Icon = config.icon;
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-${config.color}-500/10 border border-${config.color}-500/30`}>
      <Icon className={`w-3 h-3 text-${config.color}-500 ${status === 'thinking' || status === 'executing' ? 'animate-pulse' : ''}`} />
      <span className={`text-[10px] font-medium text-${config.color}-500`}>{config.label}</span>
    </div>
  );
};

interface DropdownProps<T extends DropdownOption> {
  value: string;
  onChange: (value: string) => void;
  options: T[];
  label?: string;
  className?: string;
}

function Dropdown<T extends DropdownOption>({
  value,
  onChange,
  options,
  label,
  className = '',
}: DropdownProps<T>): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {setIsOpen(false);}
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = options.find(o => o.id === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors text-xs"
      >
        {label && <span className="text-gray-500">{label}:</span>}
        <span className="text-white truncate max-w-[120px]">{selected?.name || 'Select...'}</span>
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
          {options.map(option => {
            const OptionIcon = option.icon;
            return (
              <button
                key={option.id}
                onClick={() => { onChange(option.id); setIsOpen(false); }}
                className={`w-full px-3 py-2 text-left hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                  value === option.id ? 'bg-gray-700' : ''
                }`}
              >
                {OptionIcon && <OptionIcon className="w-4 h-4 text-gray-400" />}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">{option.name}</div>
                  {option.description && <div className="text-[10px] text-gray-500">{option.description}</div>}
                </div>
                {value === option.id && <Check className="w-3 h-3 text-blue-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  size?: ToggleSize;
}

const Toggle: React.FC<ToggleProps> = ({ enabled, onChange, label, size = 'sm' }) => {
  const sizes: Record<ToggleSize, { track: string; thumb: string; translate: string }> = {
    sm: { track: 'w-8 h-4', thumb: 'w-3 h-3', translate: 'translate-x-4' },
    md: { track: 'w-10 h-5', thumb: 'w-4 h-4', translate: 'translate-x-5' },
  };
  const s = sizes[size];
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      {label && <span className="text-[10px] text-gray-400">{label}</span>}
      <button
        onClick={() => onChange(!enabled)}
        className={`relative ${s.track} rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-700'}`}
      >
        <div className={`absolute top-0.5 left-0.5 ${s.thumb} bg-white rounded-full transition-transform ${enabled ? s.translate : ''}`} />
      </button>
    </label>
  );
};

// ============================================================================
// TOOL APPROVAL COMPONENT
// ============================================================================

interface ToolApprovalCardProps {
  toolCall: ToolCall;
  onApprove: () => void;
  onReject: () => void;
  onModify?: (args: Record<string, unknown>) => void;
  status?: ToolCallStatus;
}

const ToolApprovalCard: React.FC<ToolApprovalCardProps> = ({
  toolCall,
  onApprove,
  onReject,
  onModify,
  status = 'pending',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editedArgs, setEditedArgs] = useState(JSON.stringify(toolCall.args, null, 2));
  const [isEditing, setIsEditing] = useState(false);

  const tool = AVAILABLE_TOOLS.find(t => t.id === toolCall.toolName) || {
    name: toolCall.toolName,
    category: 'system' as ToolCategory,
    risk: 'medium' as RiskLevel,
    description: 'Unknown tool',
  };

  const riskConfig = RISK_CONFIG[tool.risk];
  const categoryConfig = TOOL_CATEGORIES[tool.category] || TOOL_CATEGORIES.system;
  const CategoryIcon = categoryConfig.icon;
  const RiskIcon = riskConfig.icon;

  const statusConfig: Record<ToolCallStatus, { bg: string; border: string; text: string }> = {
    pending: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400' },
    approved: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
    rejected: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
    executing: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
    complete: { bg: 'bg-gray-500/10', border: 'border-gray-700', text: 'text-gray-400' },
  };

  const sc = statusConfig[status] || statusConfig.pending;

  const handleApprove = () => {
    if (isEditing) {
      try {
        const parsed = JSON.parse(editedArgs);
        onModify?.(parsed);
        setIsEditing(false);
      } catch {
        alert('Invalid JSON');
        return;
      }
    }
    onApprove();
  };

  return (
    <div className={`rounded-lg border ${sc.border} ${sc.bg} overflow-hidden`}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={`w-7 h-7 rounded-md bg-${categoryConfig.color}-500/20 flex items-center justify-center`}>
          <CategoryIcon className={`w-3.5 h-3.5 text-${categoryConfig.color}-400`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white">{tool.name}</span>
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-${riskConfig.color}-500/20`}>
              <RiskIcon className={`w-2.5 h-2.5 text-${riskConfig.color}-400`} />
              <span className={`text-[9px] text-${riskConfig.color}-400`}>{riskConfig.label}</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 truncate">{tool.description}</p>
        </div>
        <div className={`text-[10px] font-medium ${sc.text} capitalize`}>{status}</div>
        {isExpanded ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-gray-700/50">
          {/* Arguments */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500 font-medium">Arguments</span>
              {status === 'pending' && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }}
                  className="text-[10px] text-blue-400 hover:text-blue-300"
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
              )}
            </div>
            {isEditing ? (
              <textarea
                value={editedArgs}
                onChange={(e) => setEditedArgs(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-24 bg-gray-900 text-gray-300 text-[10px] font-mono p-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
              />
            ) : (
              <pre className="bg-gray-900 text-gray-300 text-[10px] font-mono p-2 rounded overflow-x-auto max-h-32">
                {JSON.stringify(toolCall.args, null, 2)}
              </pre>
            )}
          </div>

          {/* Result (if complete) */}
          {status === 'complete' && toolCall.result && (
            <div className="mt-2">
              <span className="text-[10px] text-gray-500 font-medium">Result</span>
              <pre className="bg-gray-900 text-green-400 text-[10px] font-mono p-2 rounded overflow-x-auto max-h-32 mt-1">
                {typeof toolCall.result === 'string' ? toolCall.result : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}

          {/* Actions */}
          {status === 'pending' && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={(e) => { e.stopPropagation(); handleApprove(); }}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-[10px] font-medium rounded transition-colors"
              >
                <Check className="w-3 h-3" />
                {isEditing ? 'Save & Approve' : 'Approve'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onReject(); }}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-medium rounded border border-red-500/30 transition-colors"
              >
                <X className="w-3 h-3" />
                Reject
              </button>
              <button
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-[10px] font-medium rounded transition-colors"
              >
                Skip
              </button>
            </div>
          )}

          {status === 'executing' && (
            <div className="flex items-center gap-2 mt-3 text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[10px]">Executing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// QUESTION / INPUT REQUEST COMPONENT
// ============================================================================

interface QuestionCardProps {
  question: Question;
  onSubmit: (answer: string | string[]) => void;
  status?: QuestionStatus;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, onSubmit, status = 'pending' }) => {
  const [answer, setAnswer] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const handleSubmit = () => {
    if (question.type === 'choice') {
      onSubmit(question.multiple ? selectedOptions : selectedOptions[0]);
    } else {
      onSubmit(answer);
    }
  };

  const toggleOption = (id: string) => {
    if (question.multiple) {
      setSelectedOptions(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    } else {
      setSelectedOptions([id]);
    }
  };

  const canSubmit = question.type === 'choice' ? selectedOptions.length > 0 : answer.trim().length > 0;
  const isAnswered = status === 'answered';

  return (
    <div className={`rounded-lg border ${isAnswered ? 'border-gray-700 bg-gray-800/30' : 'border-purple-500/30 bg-purple-500/10'} overflow-hidden`}>
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-purple-500/20 flex items-center justify-center">
            <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <span className="text-[10px] font-medium text-purple-400">
            {isAnswered ? 'Answered' : 'Input Required'}
          </span>
        </div>

        <p className="text-xs text-white mb-3">{question.text}</p>

        {!isAnswered ? (
          <>
            {question.type === 'choice' && question.options ? (
              <div className="space-y-1.5 mb-3">
                {question.options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border transition-all text-left ${
                      selectedOptions.includes(opt.id)
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-${question.multiple ? 'sm' : 'full'} border-2 flex items-center justify-center ${
                      selectedOptions.includes(opt.id) ? 'border-purple-500 bg-purple-500' : 'border-gray-600'
                    }`}>
                      {selectedOptions.includes(opt.id) && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className="text-[11px] text-gray-200">{opt.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mb-3">
                {question.multiline ? (
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={question.placeholder || 'Type your answer...'}
                    className="w-full h-20 bg-gray-900 text-white text-xs p-2 rounded border border-gray-700 focus:border-purple-500 focus:outline-none resize-none placeholder-gray-500"
                  />
                ) : (
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={question.placeholder || 'Type your answer...'}
                    className="w-full bg-gray-900 text-white text-xs px-2 py-1.5 rounded border border-gray-700 focus:border-purple-500 focus:outline-none placeholder-gray-500"
                  />
                )}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium rounded transition-colors ${
                canSubmit
                  ? 'bg-purple-600 hover:bg-purple-500 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-3 h-3" />
              Submit
            </button>
          </>
        ) : (
          <div className="bg-gray-800 rounded px-2 py-1.5 border border-gray-700">
            <div className="text-[10px] text-gray-500 mb-0.5">Your answer:</div>
            <div className="text-xs text-white">
              {question.type === 'choice' && question.options
                ? question.options.filter(o => question.answer?.includes(o.id)).map(o => o.label).join(', ')
                : question.answer
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MESSAGE COMPONENTS
// ============================================================================

interface UserMessageProps {
  content: string;
  attachments?: Attachment[];
  timestamp?: string;
}

const UserMessage: React.FC<UserMessageProps> = ({ content, attachments, timestamp }) => (
  <div className="flex gap-2 justify-end">
    <div className="max-w-[75%]">
      {attachments && attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5 justify-end">
          {attachments.map((att, i) => (
            <div key={i} className="relative">
              {att.type?.startsWith('image') ? (
                <img src={att.preview || att.url} alt="" className="h-16 rounded object-cover" />
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-700 rounded text-[10px]">
                  <FileText className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-300 truncate max-w-[100px]">{att.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="bg-blue-600 text-white px-3 py-2 rounded-xl rounded-br-sm">
        <p className="text-xs whitespace-pre-wrap">{content}</p>
      </div>
      {timestamp && (
        <div className="text-[9px] text-gray-500 text-right mt-0.5">{timestamp}</div>
      )}
    </div>
    <Avatar type="user" size="sm" />
  </div>
);

interface AssistantMessageProps {
  content: string;
  isStreaming?: boolean;
  reasoning?: string;
  timestamp?: string;
}

const AssistantMessage: React.FC<AssistantMessageProps> = ({ content, isStreaming, reasoning, timestamp }) => {
  const [showReasoning, setShowReasoning] = useState(false);

  return (
    <div className="flex gap-2">
      <Avatar type="assistant" size="sm" />
      <div className="max-w-[75%]">
        {reasoning && (
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center gap-1 text-[10px] text-amber-400 mb-1 hover:text-amber-300"
          >
            <Brain className="w-3 h-3" />
            {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
            <ChevronDown className={`w-3 h-3 transition-transform ${showReasoning ? 'rotate-180' : ''}`} />
          </button>
        )}
        {showReasoning && reasoning && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-1.5 mb-1.5">
            <p className="text-[10px] text-amber-300/80 italic">{reasoning}</p>
          </div>
        )}
        <div className="bg-gray-800 px-3 py-2 rounded-xl rounded-bl-sm border border-gray-700">
          <p className="text-xs text-gray-100 whitespace-pre-wrap">
            {content}
            {isStreaming && <span className="inline-block w-1.5 h-3.5 bg-amber-500 ml-0.5 animate-pulse" />}
          </p>
        </div>
        {timestamp && (
          <div className="text-[9px] text-gray-500 mt-0.5">{timestamp}</div>
        )}
      </div>
    </div>
  );
};

interface ThinkingIndicatorProps {
  thought?: string;
}

const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ thought }) => (
  <div className="flex gap-2">
    <Avatar type="assistant" size="sm" />
    <div className="bg-gray-800/50 border border-gray-700/50 px-3 py-2 rounded-xl rounded-bl-sm">
      <div className="flex items-center gap-1.5 mb-1">
        <Sparkles className="w-3 h-3 text-amber-500" />
        <span className="text-[10px] font-medium text-amber-500">Thinking...</span>
      </div>
      {thought && <p className="text-[10px] text-gray-400 italic">{thought}</p>}
      <div className="flex gap-1 mt-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  </div>
);

interface SystemMessageProps {
  type: SystemMessageType;
  content: string;
}

const SystemMessage: React.FC<SystemMessageProps> = ({ type, content }) => {
  const config: Record<SystemMessageType, { icon: LucideIcon; color: string }> = {
    info: { icon: Info, color: 'blue' },
    warning: { icon: AlertTriangle, color: 'amber' },
    error: { icon: AlertCircle, color: 'red' },
    success: { icon: CheckCircle2, color: 'green' },
  };
  const c = config[type] || config.info;
  const Icon = c.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 bg-${c.color}-500/10 border border-${c.color}-500/30 rounded-lg`}>
      <Icon className={`w-3.5 h-3.5 text-${c.color}-400`} />
      <span className={`text-[10px] text-${c.color}-300`}>{content}</span>
    </div>
  );
};

// ============================================================================
// COMMAND PALETTE
// ============================================================================

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (commandId: string) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onCommand }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = useMemo(() => [
    { id: 'tool-search', label: 'Search Tools', icon: Search, shortcut: 'T', category: 'tools' },
    { id: 'tool-add', label: 'Add Custom Tool', icon: Plus, shortcut: 'N', category: 'tools' },
    { id: 'workflow-run', label: 'Run Workflow', icon: Play, shortcut: 'R', category: 'workflow' },
    { id: 'workflow-pause', label: 'Pause', icon: Pause, shortcut: 'P', category: 'workflow' },
    { id: 'workflow-reset', label: 'Reset', icon: RotateCcw, category: 'workflow' },
    { id: 'approve-all', label: 'Approve All Pending', icon: CheckCircle2, shortcut: 'Y', category: 'permissions' },
    { id: 'reject-all', label: 'Reject All Pending', icon: XCircle, category: 'permissions' },
    { id: 'toggle-auto', label: 'Toggle Auto-Approve', icon: Zap, shortcut: 'A', category: 'permissions' },
    { id: 'export', label: 'Export Conversation', icon: Download, shortcut: 'E', category: 'data' },
    { id: 'settings', label: 'Settings', icon: Settings, shortcut: ',', category: 'settings' },
  ], []);

  const filtered = useMemo(() => {
    if (!query) {return commands;}
    const q = query.toLowerCase();
    return commands.filter(c => c.label.toLowerCase().includes(q) || c.shortcut?.toLowerCase() === q);
  }, [commands, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onCommand(filtered[selectedIndex].id);
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && query === '') {
          const cmd = filtered.find(c => c.shortcut?.toLowerCase() === e.key.toLowerCase());
          if (cmd) {
            e.preventDefault();
            onCommand(cmd.id);
            onClose();
          }
        }
    }
  };

  if (!isOpen) {return null;}

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-gray-900 rounded-lg border border-gray-700 shadow-2xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
          <Command className="w-3.5 h-3.5 text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-white text-xs placeholder-gray-500 focus:outline-none"
          />
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-[9px] text-gray-500">esc</kbd>
        </div>
        <div className="max-h-[280px] overflow-y-auto">
          {filtered.map((cmd, i) => {
            const CmdIcon = cmd.icon;
            return (
              <button
                key={cmd.id}
                onClick={() => { onCommand(cmd.id); onClose(); }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left ${
                  i === selectedIndex ? 'bg-blue-500/20' : 'hover:bg-gray-800/50'
                }`}
              >
                <CmdIcon className={`w-3.5 h-3.5 ${i === selectedIndex ? 'text-blue-400' : 'text-gray-500'}`} />
                <span className={`text-[11px] flex-1 ${i === selectedIndex ? 'text-white' : 'text-gray-300'}`}>{cmd.label}</span>
                {cmd.shortcut && (
                  <kbd className={`px-1 py-0.5 rounded text-[9px] font-mono ${
                    i === selectedIndex ? 'bg-blue-500/30 text-blue-300' : 'bg-gray-800 text-gray-500'
                  }`}>{cmd.shortcut}</kbd>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-gray-800 text-[9px] text-gray-500">
          <span><kbd className="px-1 py-0.5 bg-gray-800 rounded">↑↓</kbd> nav</span>
          <span><kbd className="px-1 py-0.5 bg-gray-800 rounded">↵</kbd> run</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// TOOL PERMISSION PANEL
// ============================================================================

interface ToolPermissionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const ToolPermissionPanel: React.FC<ToolPermissionPanelProps> = ({ isOpen, onClose }) => {
  const { toolPermissions, setToolPermissions, autoApprove, setAutoApprove } = useWorkflow();
  const [activeTab, setActiveTab] = useState<'tiers' | 'tools' | 'exceptions'>('tiers');

  if (!isOpen) {return null;}

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-gray-900 rounded-xl border border-gray-700 shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-white">Tool Permissions</span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-gray-800">
          {(['tiers', 'tools', 'exceptions'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-3 py-2 text-xs font-medium capitalize ${
                activeTab === tab ? 'text-white border-b-2 border-blue-500' : 'text-gray-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'tiers' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div>
                  <div className="text-xs font-medium text-white">Auto-Approve All</div>
                  <div className="text-[10px] text-gray-400">Skip approval for all tools</div>
                </div>
                <Toggle enabled={autoApprove} onChange={setAutoApprove} />
              </div>

              {(Object.entries(RISK_CONFIG) as [RiskLevel, RiskConfig][]).map(([risk, config]) => {
                const RiskIcon = config.icon;
                return (
                  <div key={risk} className={`p-3 rounded-lg border border-${config.color}-500/30 bg-${config.color}-500/10`}>
                    <div className="flex items-center gap-2 mb-2">
                      <RiskIcon className={`w-4 h-4 text-${config.color}-400`} />
                      <span className="text-xs font-medium text-white">{config.label}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {(['auto', 'ask', 'deny'] as PermissionAction[]).map(action => (
                        <button
                          key={action}
                          onClick={() => setToolPermissions(p => ({ ...p, [risk]: action }))}
                          className={`px-2 py-1.5 text-[10px] font-medium rounded capitalize ${
                            toolPermissions[risk] === action
                              ? 'bg-white/20 text-white'
                              : 'bg-gray-800 text-gray-400 hover:text-gray-300'
                          }`}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'tools' && (
            <div className="space-y-1">
              {AVAILABLE_TOOLS.map(tool => {
                const cat = TOOL_CATEGORIES[tool.category];
                const risk = RISK_CONFIG[tool.risk];
                const CatIcon = cat.icon;
                const RiskIcon = risk.icon;
                return (
                  <div key={tool.id} className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 rounded">
                    <CatIcon className={`w-3 h-3 text-${cat.color}-400`} />
                    <span className="text-[11px] text-gray-200 flex-1">{tool.name}</span>
                    <RiskIcon className={`w-3 h-3 text-${risk.color}-400`} />
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'exceptions' && (
            <div className="text-center py-8">
              <Shield className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No exceptions configured</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// INPUT AREA
// ============================================================================

interface InputAreaProps {
  onSend: (payload: SendMessagePayload) => void;
  disabled: boolean;
  onStop: () => void;
}

const InputArea: React.FC<InputAreaProps> = ({ onSend, disabled, onStop }) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFiles = (files: FileList | null) => {
    if (!files) {return;}
    const newAttachments: Attachment[] = Array.from(files).map(file => ({
      id: generateId(),
      name: file.name,
      type: file.type,
      file,
      preview: file.type.startsWith('image') ? URL.createObjectURL(file) : null,
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [message]);

  return (
    <div className="border-t border-gray-800 bg-gray-900/50 p-3">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {attachments.map(att => (
            <div key={att.id} className="relative group">
              {att.type?.startsWith('image') ? (
                <img src={att.preview || undefined} alt="" className="h-12 w-12 object-cover rounded border border-gray-700" />
              ) : (
                <div className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded border border-gray-700">
                  <FileText className="w-3 h-3 text-gray-400" />
                  <span className="text-[10px] text-gray-300 max-w-[80px] truncate">{att.name}</span>
                </div>
              )}
              <button
                onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-2.5 h-2.5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex gap-0.5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.multiple = true;
              input.onchange = (e) => handleFiles((e.target as HTMLInputElement).files);
              input.click();
            }}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            <Image className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsRecording(!isRecording)}
            className={`p-1.5 rounded transition-colors ${
              isRecording ? 'text-red-400 bg-red-400/20' : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            disabled={disabled}
            rows={1}
            className="w-full bg-gray-800 text-white text-xs px-3 py-2 rounded-lg border border-gray-700 focus:border-amber-500 focus:outline-none resize-none placeholder-gray-500 disabled:opacity-50"
          />
        </div>

        {disabled ? (
          <button
            onClick={onStop}
            className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
          >
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!message.trim() && attachments.length === 0}
            className={`p-2 rounded-lg transition-colors ${
              message.trim() || attachments.length > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-white'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN AGENTIC WORKFLOW COMPONENT
// ============================================================================

const AgenticWorkflow: React.FC = () => {
  // State
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet-20241022');
  const [sessions, setSessions] = useState<Session[]>([
    { id: 'session-1', name: 'Project Analysis', createdAt: new Date() },
    { id: 'session-2', name: 'Code Review', createdAt: new Date() },
  ]);
  const [selectedSession, setSelectedSession] = useState('session-1');
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatusType>('idle');
  const [autoApprove, setAutoApprove] = useState(false);
  const [toolPermissions, setToolPermissions] = useState<ToolPermissions>({ low: 'auto', medium: 'ask', high: 'ask' });
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isPermissionPanelOpen, setIsPermissionPanelOpen] = useState(false);
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCall[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<Question[]>([]);
  const [customMessages, setCustomMessages] = useState<ExtendedMessage[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Vercel AI SDK useChat hook
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    reload,
    append,
    setMessages,
  } = useChat({
    api: '/api/chat',
    body: {
      model: selectedModel,
      sessionId: selectedSession,
      toolPermissions,
      autoApprove,
    },
    onResponse: () => {
      setWorkflowStatus('thinking');
    },
    onFinish: (message) => {
      setWorkflowStatus('complete');
      // Check for tool calls in the response
      if (message.toolInvocations?.length) {
        handleToolCalls(message.toolInvocations);
      }
    },
    onError: (error) => {
      setWorkflowStatus('error');
      console.error('Chat error:', error);
    },
  });

  // Handle tool calls
  const handleToolCalls = (toolInvocations: ToolInvocation[]) => {
    toolInvocations.forEach(tc => {
      const tool = AVAILABLE_TOOLS.find(t => t.id === tc.toolName);
      const permission = tool ? toolPermissions[tool.risk] : 'ask';

      if (autoApprove || permission === 'auto') {
        // Auto-execute
        void executeToolCall({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args as Record<string, unknown>,
          status: 'pending',
        });
      } else if (permission === 'deny') {
        // Auto-reject
        rejectToolCall(tc.toolCallId);
      } else {
        // Add to pending
        setPendingToolCalls(prev => [...prev, {
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args as Record<string, unknown>,
          status: 'pending',
        }]);
        setWorkflowStatus('waiting_approval');
      }
    });
  };

  const executeToolCall = async (toolCall: ToolCall) => {
    setPendingToolCalls(prev =>
      prev.map(tc => tc.toolCallId === toolCall.toolCallId ? { ...tc, status: 'executing' } : tc)
    );
    setWorkflowStatus('executing');

    // Simulate tool execution
    await new Promise(r => setTimeout(r, 1500));

    const result = { success: true, data: `Result from ${toolCall.toolName}` };

    setPendingToolCalls(prev =>
      prev.map(tc => tc.toolCallId === toolCall.toolCallId ? { ...tc, status: 'complete', result } : tc)
    );

    // Continue the conversation with the tool result
    setWorkflowStatus('thinking');
  };

  const approveToolCall = (toolCallId: string) => {
    const tc = pendingToolCalls.find(t => t.toolCallId === toolCallId);
    if (tc) {void executeToolCall(tc);}
  };

  const rejectToolCall = (toolCallId: string) => {
    setPendingToolCalls(prev =>
      prev.map(tc => tc.toolCallId === toolCallId ? { ...tc, status: 'rejected' } : tc)
    );
    setWorkflowStatus('idle');
  };

  // Handle questions
  const askQuestion = (question: Omit<Question, 'id' | 'status'>): string => {
    const q: Question = { id: generateId(), ...question, status: 'pending' };
    setPendingQuestions(prev => [...prev, q]);
    setWorkflowStatus('waiting_input');
    return q.id;
  };

  const answerQuestion = (questionId: string, answer: string | string[]) => {
    setPendingQuestions(prev =>
      prev.map(q => q.id === questionId ? { ...q, status: 'answered', answer } : q)
    );
    setWorkflowStatus('thinking');
  };

  // Custom send handler
  const handleSend = ({ content, attachments }: SendMessagePayload) => {
    const newMessage: ExtendedMessage = {
      id: generateId(),
      role: 'user',
      content,
      attachments,
      timestamp: new Date().toLocaleTimeString(),
    };

    setCustomMessages(prev => [...prev, newMessage]);
    setWorkflowStatus('thinking');

    // Use Vercel AI SDK append
    append({
      role: 'user',
      content,
    });
  };

  // Command handler
  const handleCommand = (commandId: string) => {
    switch (commandId) {
      case 'toggle-auto':
        setAutoApprove(!autoApprove);
        break;
      case 'approve-all':
        pendingToolCalls.filter(tc => tc.status === 'pending').forEach(tc => approveToolCall(tc.toolCallId));
        break;
      case 'reject-all':
        pendingToolCalls.filter(tc => tc.status === 'pending').forEach(tc => rejectToolCall(tc.toolCallId));
        break;
      case 'workflow-pause':
        setWorkflowStatus(workflowStatus === 'paused' ? 'idle' : 'paused');
        break;
      case 'workflow-reset':
        setMessages([]);
        setCustomMessages([]);
        setPendingToolCalls([]);
        setPendingQuestions([]);
        setWorkflowStatus('idle');
        break;
      case 'settings':
        setIsPermissionPanelOpen(true);
        break;
      default:
        console.log('Command:', commandId);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'j')) {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, customMessages, pendingToolCalls, pendingQuestions]);

  // Merge messages for display
  const displayMessages = useMemo((): ExtendedMessage[] => {
    return messages.map(m => ({
      ...m,
      timestamp: new Date().toLocaleTimeString(),
    }));
  }, [messages]);

  // Context value
  const contextValue: WorkflowContextValue = {
    workflowStatus,
    setWorkflowStatus,
    autoApprove,
    setAutoApprove,
    toolPermissions,
    setToolPermissions,
    pendingToolCalls,
    pendingQuestions,
  };

  // Session options for dropdown
  const sessionOptions: DropdownOption[] = sessions.map(s => ({ id: s.id, name: s.name }));

  return (
    <WorkflowContext.Provider value={contextValue}>
      <div className="flex flex-col h-screen bg-gray-950 text-white">
        {/* Header */}
        <header className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                <Workflow className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-sm">Agentic Workflow</span>
            </div>

            <div className="h-5 w-px bg-gray-700" />

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

          <div className="flex items-center gap-2">
            <StatusBadge status={workflowStatus} />

            <Toggle
              enabled={autoApprove}
              onChange={setAutoApprove}
              label="Auto"
            />

            <button
              onClick={() => setIsPermissionPanelOpen(true)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            >
              <Shield className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPaletteOpen(true)}
              className="flex items-center gap-1 px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            >
              <Command className="w-3.5 h-3.5" />
              <kbd className="text-[9px] bg-gray-800 px-1 py-0.5 rounded">⌘K</kbd>
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {displayMessages.length === 0 && pendingToolCalls.length === 0 && pendingQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center mb-3">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-lg font-semibold mb-1">Start a Workflow</h2>
              <p className="text-xs text-gray-400 max-w-sm">
                Send a message to begin. I can use tools, ask clarifying questions, and work through complex tasks.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <kbd className="px-2 py-1 bg-gray-800 rounded text-[10px] text-gray-400">⌘K</kbd>
                <span className="text-[10px] text-gray-500">for commands</span>
              </div>
            </div>
          ) : (
            <>
              {displayMessages.map((message) => (
                <div key={message.id}>
                  {message.role === 'user' ? (
                    <UserMessage
                      content={message.content}
                      attachments={message.attachments}
                      timestamp={message.timestamp}
                    />
                  ) : (
                    <AssistantMessage
                      content={message.content}
                      isStreaming={isLoading && message.id === displayMessages[displayMessages.length - 1]?.id}
                      timestamp={message.timestamp}
                    />
                  )}
                </div>
              ))}

              {/* Pending Tool Calls */}
              {pendingToolCalls.map((tc) => (
                <ToolApprovalCard
                  key={tc.toolCallId}
                  toolCall={tc}
                  status={tc.status}
                  onApprove={() => approveToolCall(tc.toolCallId)}
                  onReject={() => rejectToolCall(tc.toolCallId)}
                />
              ))}

              {/* Pending Questions */}
              {pendingQuestions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  status={q.status}
                  onSubmit={(answer) => answerQuestion(q.id, answer)}
                />
              ))}

              {/* Thinking Indicator */}
              {isLoading && workflowStatus === 'thinking' && (
                <ThinkingIndicator thought="Processing your request..." />
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Workflow Controls */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/50 border-t border-gray-700/50">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleCommand('workflow-pause')}
              disabled={workflowStatus === 'idle' || workflowStatus === 'complete'}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors disabled:opacity-50 ${
                workflowStatus === 'paused'
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              {workflowStatus === 'paused' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              {workflowStatus === 'paused' ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={stop}
              disabled={!isLoading}
              className="flex items-center gap-1 px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-[10px] font-medium border border-red-600/30 disabled:opacity-50"
            >
              <Square className="w-3 h-3" />
              Stop
            </button>
            <button
              onClick={() => handleCommand('workflow-reset')}
              className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-[10px] font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          <div className="flex items-center gap-2">
            {pendingToolCalls.filter(tc => tc.status === 'pending').length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-orange-400">
                  {pendingToolCalls.filter(tc => tc.status === 'pending').length} pending
                </span>
                <button
                  onClick={() => handleCommand('approve-all')}
                  className="px-2 py-0.5 bg-green-600/20 text-green-400 text-[10px] rounded hover:bg-green-600/30"
                >
                  Approve All
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <InputArea
          onSend={handleSend}
          disabled={isLoading || workflowStatus === 'paused'}
          onStop={stop}
        />

        {/* Command Palette */}
        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          onCommand={handleCommand}
        />

        {/* Permission Panel */}
        <ToolPermissionPanel
          isOpen={isPermissionPanelOpen}
          onClose={() => setIsPermissionPanelOpen(false)}
        />
      </div>
    </WorkflowContext.Provider>
  );
};

export default AgenticWorkflow;

// ============================================================================
// EXPORTED TYPES
// ============================================================================

export type {
  RiskLevel,
  PermissionAction,
  ToolCategory,
  WorkflowStatusType,
  ToolCallStatus,
  QuestionStatus,
  QuestionType,
  SystemMessageType,
  AvatarType,
  AvatarSize,
  ToggleSize,
  ModelProvider,
  ModelConfig,
  ToolCategoryConfig,
  ToolDefinition,
  RiskConfig,
  WorkflowStatusConfig,
  Session,
  Attachment,
  ExtendedMessage,
  ToolCall,
  QuestionOption,
  Question,
  ToolPermissions,
  Command,
  DropdownOption,
  SendMessagePayload,
  WorkflowContextValue,
};

export {
  MODELS,
  TOOL_CATEGORIES,
  AVAILABLE_TOOLS,
  RISK_CONFIG,
  WORKFLOW_STATUS,
  useWorkflow,
  Avatar,
  StatusBadge,
  Dropdown,
  Toggle,
  ToolApprovalCard,
  QuestionCard,
  UserMessage,
  AssistantMessage,
  ThinkingIndicator,
  SystemMessage,
  CommandPalette,
  ToolPermissionPanel,
  InputArea,
};
