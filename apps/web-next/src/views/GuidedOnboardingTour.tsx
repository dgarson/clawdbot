import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  Loader2,
  Wifi,
  WifiOff,
  Hash,
  Send,
  Bot,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type StepId = 1 | 2 | 3 | 4 | 5;

interface ChatMessage {
  id: string;
  from: 'user' | 'agent';
  text: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_LABELS = [
  'Gateway',
  'Channel',
  'Agent',
  'Test Message',
  'Complete',
];

const CHANNEL_OPTIONS = [
  { id: 'slack', label: 'Slack', emoji: '💬' },
  { id: 'telegram', label: 'Telegram', emoji: '✈️' },
  { id: 'whatsapp', label: 'WhatsApp', emoji: '📱' },
  { id: 'discord', label: 'Discord', emoji: '🎮' },
  { id: 'signal', label: 'Signal', emoji: '🔒' },
];

const AGENT_EMOJIS = ['🧠', '🤖', '⚡', '🎨', '🔍', '🏗️', '🛡️', '🧪', '💼', '🧙', '🚀', '🦉'];

const AGENT_ROLES = [
  'Personal Assistant',
  'Code Reviewer',
  'Research Agent',
  'Custom',
];

// ─── Confetti ─────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  'bg-violet-500',
  'bg-pink-500',
  'bg-yellow-400',
  'bg-emerald-400',
  'bg-sky-400',
  'bg-orange-400',
];

function ConfettiBurst() {
  const dots = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="relative flex items-center justify-center h-32 w-full overflow-hidden pointer-events-none select-none">
      <style>{`
        @keyframes confettiDot {
          0%   { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0.3); opacity: 0; }
        }
        .confetti-dot {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          animation: confettiDot 1.2s ease-out forwards;
        }
      `}</style>
      {dots.map((i) => {
        const angle = (i / dots.length) * 360;
        const dist = 60 + Math.random() * 60;
        const tx = Math.cos((angle * Math.PI) / 180) * dist;
        const ty = Math.sin((angle * Math.PI) / 180) * dist;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const delay = Math.random() * 0.3;
        return (
          <div
            key={i}
            className={cn('confetti-dot', color)}
            style={
              {
                '--tx': `${tx}px`,
                '--ty': `${ty}px`,
                animationDelay: `${delay}s`,
              } as React.CSSProperties
            }
          />
        );
      })}
      <div className="z-10 text-4xl">🎉</div>
    </div>
  );
}

// ─── Stepper Header ───────────────────────────────────────────────────────────

interface StepperProps {
  current: StepId;
  completed: Set<StepId>;
  onNavigate: (step: StepId) => void;
}

function Stepper({ current, completed, onNavigate }: StepperProps) {
  return (
    <div className="flex items-center gap-0 w-full mb-8">
      {STEP_LABELS.map((label, idx) => {
        const step = (idx + 1) as StepId;
        const isDone = completed.has(step);
        const isCurrent = current === step;
        const canClick = isDone || step <= current;

        return (
          <React.Fragment key={step}>
            {/* Connector line */}
            {idx > 0 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-1 transition-colors duration-300',
                  completed.has((idx) as StepId) ? 'bg-violet-600' : 'bg-zinc-700'
                )}
              />
            )}
            {/* Dot + label */}
            <button
              onClick={() => canClick && onNavigate(step)}
              disabled={!canClick}
              className={cn(
                'flex flex-col items-center gap-1.5 group',
                canClick ? 'cursor-pointer' : 'cursor-default'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-2',
                  isDone
                    ? 'bg-violet-600 border-violet-600'
                    : isCurrent
                    ? 'bg-transparent border-violet-500'
                    : 'bg-zinc-800 border-zinc-700'
                )}
              >
                {isDone ? (
                  <Check size={14} className="text-white" />
                ) : (
                  <span
                    className={cn(
                      'text-xs font-bold',
                      isCurrent ? 'text-violet-400' : 'text-zinc-500'
                    )}
                  >
                    {step}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  isDone
                    ? 'text-violet-400'
                    : isCurrent
                    ? 'text-white'
                    : 'text-zinc-500'
                )}
              >
                {label}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Step 1: Gateway Connection ───────────────────────────────────────────────

interface Step1Props {
  onSuccess: () => void;
}

function Step1Gateway({ onSuccess }: Step1Props) {
  const [url, setUrl] = useState('http://localhost:9999');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  function testConnection() {
    setStatus('loading');
    setTimeout(() => {
      // Simulate: succeed if url contains localhost or a known pattern
      const ok = url.trim().length > 0 && !url.includes('bad');
      setStatus(ok ? 'success' : 'error');
      if (ok) setTimeout(onSuccess, 600);
    }, 800);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Connect to your Gateway</h2>
        <p className="text-zinc-400 text-sm">
          OpenClaw routes all messages through the Gateway. Let's verify it's reachable.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-300">Gateway URL</label>
        <input
          type="text"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setStatus('idle'); }}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
          placeholder="http://localhost:9999"
        />
      </div>

      <button
        onClick={testConnection}
        disabled={status === 'loading' || status === 'success'}
        className={cn(
          'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200',
          status === 'success'
            ? 'bg-emerald-600 text-white cursor-default'
            : 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-60 disabled:cursor-not-allowed'
        )}
      >
        {status === 'loading' ? (
          <Loader2 size={16} className="animate-spin" />
        ) : status === 'success' ? (
          <Check size={16} />
        ) : (
          <Wifi size={16} />
        )}
        {status === 'loading' ? 'Testing…' : status === 'success' ? 'Connected!' : 'Test Connection'}
      </button>

      {status === 'success' && (
        <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-950/40 border border-emerald-800 rounded-lg px-4 py-3">
          <Check size={15} />
          <span>Gateway online ✓ v2026.2.20</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg px-4 py-3">
          <WifiOff size={15} />
          <span>Could not reach gateway. Check the URL and try again.</span>
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Configure a Channel ─────────────────────────────────────────────

interface Step2Props {
  onSuccess: () => void;
}

function Step2Channel({ onSuccess }: Step2Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  function verify() {
    if (!token.trim()) return;
    setStatus('loading');
    setTimeout(() => {
      setStatus('success');
      setTimeout(onSuccess, 600);
    }, 600);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Configure a Channel</h2>
        <p className="text-zinc-400 text-sm">
          Choose where your agents will send and receive messages.
        </p>
      </div>

      {/* Channel picker */}
      <div className="grid grid-cols-5 gap-3">
        {CHANNEL_OPTIONS.map((ch) => (
          <button
            key={ch.id}
            onClick={() => { setSelected(ch.id); setStatus('idle'); setToken(''); }}
            className={cn(
              'flex flex-col items-center gap-2 py-4 rounded-lg border transition-all duration-200',
              selected === ch.id
                ? 'border-violet-500 bg-violet-950/30'
                : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
            )}
          >
            <span className="text-2xl">{ch.emoji}</span>
            <span className="text-xs font-medium text-zinc-300">{ch.label}</span>
          </button>
        ))}
      </div>

      {/* Token field */}
      {selected && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-zinc-300">
            {CHANNEL_OPTIONS.find((c) => c.id === selected)?.label} Bot Token
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => { setToken(e.target.value); setStatus('idle'); }}
              placeholder="Paste your bot token here…"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
            />
            <button
              onClick={verify}
              disabled={!token.trim() || status === 'loading' || status === 'success'}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap',
                status === 'success'
                  ? 'bg-emerald-600 text-white cursor-default'
                  : 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {status === 'loading' ? (
                <Loader2 size={15} className="animate-spin" />
              ) : status === 'success' ? (
                <Check size={15} />
              ) : (
                <Hash size={15} />
              )}
              {status === 'loading' ? 'Verifying…' : status === 'success' ? 'Verified!' : 'Verify'}
            </button>
          </div>

          {status === 'success' && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-950/40 border border-emerald-800 rounded-lg px-4 py-3">
              <Check size={15} />
              <span>Channel connected ✓</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Create Your First Agent ─────────────────────────────────────────

interface Step3Props {
  onSuccess: (name: string, emoji: string, role: string) => void;
}

function Step3Agent({ onSuccess }: Step3Props) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(AGENT_EMOJIS[0]);
  const [role, setRole] = useState(AGENT_ROLES[0]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  function create() {
    if (!name.trim()) return;
    setStatus('loading');
    setTimeout(() => {
      setStatus('success');
      setTimeout(() => onSuccess(name.trim(), emoji, role), 500);
    }, 400);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Create Your First Agent</h2>
        <p className="text-zinc-400 text-sm">Give your agent a name, a face, and a role.</p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Agent Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Aria, Helper, Codebot…"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      {/* Emoji picker */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Pick an Avatar</label>
        <div className="grid grid-cols-6 gap-2">
          {AGENT_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={cn(
                'text-2xl p-2.5 rounded-lg border transition-all duration-150',
                emoji === e
                  ? 'border-violet-500 bg-violet-950/30'
                  : 'border-zinc-700 bg-zinc-800/60 hover:border-zinc-600'
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Role selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-zinc-300">Role</label>
        <div className="grid grid-cols-2 gap-2">
          {AGENT_ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={cn(
                'text-sm px-4 py-2.5 rounded-lg border font-medium transition-all duration-150',
                role === r
                  ? 'border-violet-500 bg-violet-950/30 text-violet-300'
                  : 'border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Preview card */}
      {name.trim() && (
        <div
          className={cn(
            'flex items-center gap-4 p-4 rounded-xl border transition-all duration-300',
            status === 'success'
              ? 'border-emerald-700 bg-emerald-950/30'
              : 'border-zinc-700 bg-zinc-800/50'
          )}
        >
          <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center text-2xl flex-shrink-0">
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">{name}</span>
              {status === 'success' && (
                <span className="text-xs bg-emerald-600/20 text-emerald-400 border border-emerald-700 rounded-full px-2 py-0.5">
                  Active
                </span>
              )}
            </div>
            <span className="text-zinc-400 text-sm">{role}</span>
          </div>
          <Bot size={18} className="text-zinc-500 flex-shrink-0" />
        </div>
      )}

      <button
        onClick={create}
        disabled={!name.trim() || status === 'loading' || status === 'success'}
        className={cn(
          'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200',
          status === 'success'
            ? 'bg-emerald-600 text-white cursor-default'
            : 'bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {status === 'loading' ? (
          <Loader2 size={16} className="animate-spin" />
        ) : status === 'success' ? (
          <Check size={16} />
        ) : (
          <Zap size={16} />
        )}
        {status === 'loading' ? 'Creating…' : status === 'success' ? 'Agent Created!' : 'Create Agent'}
      </button>
    </div>
  );
}

// ─── Step 4: Send a Test Message ─────────────────────────────────────────────

interface Step4Props {
  agentName: string;
  agentEmoji: string;
  onSuccess: () => void;
}

function Step4TestMessage({ agentName, agentEmoji, onSuccess }: Step4Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [replySent, setReplySent] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send() {
    const text = input.trim();
    if (!text || sending || replySent) return;
    setSending(true);
    const userMsg: ChatMessage = { id: 'u1', from: 'user', text };
    setMessages((m) => [...m, userMsg]);
    setInput('');

    setTimeout(() => {
      const agentMsg: ChatMessage = {
        id: 'a1',
        from: 'agent',
        text: `Hi! I'm ${agentName}. I'm ready to help. Try asking me anything.`,
      };
      setMessages((m) => [...m, agentMsg]);
      setSending(false);
      setReplySent(true);
      setTimeout(onSuccess, 800);
    }, 1200);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Send a Test Message</h2>
        <p className="text-zinc-400 text-sm">
          Say hello to your new agent and confirm everything's working.
        </p>
      </div>

      {/* Agent header */}
      <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-700 bg-zinc-800/50">
        <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-xl flex-shrink-0">
          {agentEmoji}
        </div>
        <div>
          <div className="text-white text-sm font-semibold">{agentName}</div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="min-h-[160px] max-h-[240px] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm pt-8">
            <MessageSquare size={16} className="mr-2" />
            Type a message to get started…
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn('flex', m.from === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                m.from === 'user'
                  ? 'bg-violet-600 text-white rounded-br-sm'
                  : 'bg-zinc-800 text-zinc-200 rounded-bl-sm'
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={replySent || sending}
          placeholder="Message your agent…"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending || replySent}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-all duration-150"
        >
          <Send size={15} />
          Send
        </button>
      </div>
    </div>
  );
}

// ─── Step 5: Tour Complete ────────────────────────────────────────────────────

interface Step5Props {
  agentName: string;
  channelId: string | null;
}

function Step5Complete({ agentName, channelId }: Step5Props) {
  const channelLabel =
    CHANNEL_OPTIONS.find((c) => c.id === channelId)?.label ?? 'Channel';
  const checklist = [
    { label: 'Gateway connected', done: true },
    { label: `${channelLabel} channel configured`, done: true },
    { label: `Agent "${agentName}" created`, done: true },
    { label: 'First message sent', done: true },
  ];

  return (
    <div className="space-y-6">
      <ConfettiBurst />

      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold text-white">You're all set! 🎉</h2>
        <p className="text-zinc-400 text-sm">
          OpenClaw is configured and your first agent is live.
        </p>
      </div>

      {/* Summary card */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-5 space-y-3">
        <div className="text-sm font-semibold text-zinc-300 mb-1">Setup complete ✓</div>
        {checklist.map((item) => (
          <div key={item.label} className="flex items-center gap-3 text-sm">
            <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
              <Check size={12} className="text-white" />
            </div>
            <span className="text-zinc-300">{item.label}</span>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex gap-3">
        <a
          href="/dashboard"
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-semibold transition-all duration-150"
        >
          <LayoutDashboard size={16} />
          Open Dashboard
        </a>
        <a
          href="https://docs.openclaw.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white rounded-lg text-sm font-semibold transition-all duration-150"
        >
          <BookOpen size={16} />
          Explore Docs
          <ExternalLink size={13} className="opacity-60" />
        </a>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GuidedOnboardingTour() {
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [completed, setCompleted] = useState<Set<StepId>>(new Set());

  // Agent data from step 3
  const [agentName, setAgentName] = useState('Agent');
  const [agentEmoji, setAgentEmoji] = useState('🤖');

  // Channel data from step 2
  const [channelId, setChannelId] = useState<string | null>(null);

  function markComplete(step: StepId) {
    setCompleted((prev) => new Set([...prev, step]));
  }

  function advance(step: StepId) {
    markComplete(step);
    const next = (step + 1) as StepId;
    if (next <= 5) setCurrentStep(next);
  }

  function navigateTo(step: StepId) {
    if (completed.has(step) || step <= currentStep) {
      setCurrentStep(step);
    }
  }

  function goBack() {
    if (currentStep > 1) setCurrentStep((s) => (s - 1) as StepId);
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-700 mb-4">
            <Bot size={22} className="text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to OpenClaw</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Let's get you set up in about 5 minutes.
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          {/* Stepper */}
          <Stepper
            current={currentStep}
            completed={completed}
            onNavigate={navigateTo}
          />

          {/* Step content */}
          <div className="min-h-[340px]">
            {currentStep === 1 && (
              <Step1Gateway onSuccess={() => advance(1)} />
            )}
            {currentStep === 2 && (
              <Step2Channel
                onSuccess={() => {
                  // Capture selected channel from child via a small trick
                  advance(2);
                }}
              />
            )}
            {currentStep === 3 && (
              <Step3Agent
                onSuccess={(name, emoji, role) => {
                  setAgentName(name);
                  setAgentEmoji(emoji);
                  advance(3);
                }}
              />
            )}
            {currentStep === 4 && (
              <Step4TestMessage
                agentName={agentName}
                agentEmoji={agentEmoji}
                onSuccess={() => advance(4)}
              />
            )}
            {currentStep === 5 && (
              <Step5Complete agentName={agentName} channelId={channelId} />
            )}
          </div>

          {/* Navigation bar */}
          {currentStep < 5 && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-800">
              <button
                onClick={goBack}
                disabled={currentStep === 1}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <span className="text-xs text-zinc-600">
                Step {currentStep} of 5
              </span>
              <button
                onClick={() => navigateTo((currentStep + 1) as StepId)}
                disabled={!completed.has(currentStep)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-zinc-600 mt-4">
          You can revisit any completed step by clicking the step dots above.
        </p>
      </div>
    </div>
  );
}
