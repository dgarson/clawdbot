import React, { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type VoiceState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";
type TranscriptRole = "user" | "agent" | "system";

interface TranscriptEntry {
  id: string;
  role: TranscriptRole;
  text: string;
  timestamp: Date;
  duration?: number; // ms audio duration
  confidence?: number; // 0-1 STT confidence
  isPartial?: boolean;
}

interface VoiceAgent {
  id: string;
  name: string;
  emoji: string;
  voice: string;
  description: string;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const VOICE_AGENTS: VoiceAgent[] = [
  { id: "luis",    name: "Luis",    emoji: "🎨", voice: "shimmer",  description: "Principal UX Engineer — design, frontend, product" },
  { id: "xavier",  name: "Xavier",  emoji: "🏗️", voice: "onyx",    description: "CTO — strategy, architecture, team" },
  { id: "stephan", name: "Stephan", emoji: "📣", voice: "echo",     description: "CMO — brand, marketing, content" },
  { id: "tim",     name: "Tim",     emoji: "⚙️", voice: "fable",   description: "VP Architecture — engineering patterns, PRs" },
];

const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);
const mins = (n: number) => n * 60_000;

const SEED_TRANSCRIPT: TranscriptEntry[] = [
  {
    id: "t1",
    role: "system",
    text: "Voice session started. Connected to Luis.",
    timestamp: ago(mins(3)),
  },
  {
    id: "t2",
    role: "user",
    text: "Hey Luis, how's the Horizon UI sprint going?",
    timestamp: ago(mins(2) + 45_000),
    duration: 2800,
    confidence: 0.97,
  },
  {
    id: "t3",
    role: "agent",
    text: "Really well! We just crossed 27 views — way past the 10-12 goal. I've been building AuditLog, SystemHealth, IntegrationHub, GlobalSearch, and PromptLibrary in the last couple hours. Piper did TeamManagement, Quinn got BillingSubscription done, and Wes just shipped DataExportManager. Build is clean across all of them.",
    timestamp: ago(mins(2) + 10_000),
    duration: 11200,
  },
  {
    id: "t4",
    role: "user",
    text: "That's incredible. What are you working on next?",
    timestamp: ago(mins(1) + 30_000),
    duration: 3100,
    confidence: 0.95,
  },
  {
    id: "t5",
    role: "agent",
    text: "VoiceInterface — which is this view, actually. Then DeveloperConsole, which Reed is building right now. Still have a few hours before 7:30 AM. The goal is to ship something genuinely useful every session.",
    timestamp: ago(mins(1)),
    duration: 9600,
  },
  {
    id: "t6",
    role: "user",
    text: "Love it. Keep going.",
    timestamp: ago(mins(0) + 15_000),
    duration: 1800,
    confidence: 0.99,
  },
];

// ─── Audio visualizer bars ────────────────────────────────────────────────────

function AudioBars({ active, color }: { active: boolean; color: string }) {
  const BAR_COUNT = 12;
  return (
    <div className="flex items-center gap-px h-8" aria-hidden="true">
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const delay = (i * 0.07).toFixed(2);
        const minH = 2;
        const maxH = 32;
        return (
          <div
            key={i}
            className={cn("w-1 rounded-full transition-all", color)}
            style={{
              height: active ? `${minH + Math.sin(i * 1.3) * (maxH - minH) * 0.5 + (maxH - minH) * 0.5}px` : `${minH + 2}px`,
              animationName: active ? "audioBar" : "none",
              animationDuration: `${0.6 + (i % 3) * 0.15}s`,
              animationDelay: `${delay}s`,
              animationTimingFunction: "ease-in-out",
              animationIterationCount: "infinite",
              animationDirection: "alternate",
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Mic pulse ring ───────────────────────────────────────────────────────────

function MicPulseRing({ state }: { state: VoiceState }) {
  const isActive = state === "listening" || state === "speaking" || state === "thinking";
  const color = state === "listening" ? "bg-indigo-500" : state === "speaking" ? "bg-emerald-500" : state === "thinking" ? "bg-amber-500" : "bg-[var(--color-surface-3)]";

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer pulse rings */}
      {isActive && (
        <>
          <div className={cn("absolute rounded-full opacity-20 animate-ping", color, state === "listening" ? "h-36 w-36" : "h-32 w-32")} />
          <div className={cn("absolute rounded-full opacity-10 animate-ping", color, "h-44 w-44")} style={{ animationDelay: "0.3s" }} />
        </>
      )}
      {/* Main button */}
      <button
        aria-label={state === "listening" ? "Stop listening" : state === "idle" ? "Start voice call" : state}
        aria-pressed={state !== "idle"}
        className={cn(
          "relative z-10 flex items-center justify-center h-28 w-28 rounded-full border-4 transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
          state === "idle"      && "bg-[var(--color-surface-2)] border-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)] focus-visible:ring-zinc-500",
          state === "connecting" && "bg-[var(--color-surface-2)] border-[var(--color-surface-3)] animate-pulse",
          state === "listening" && "bg-indigo-600 border-indigo-400 hover:bg-indigo-700 focus-visible:ring-indigo-500",
          state === "thinking"  && "bg-amber-600 border-amber-400 focus-visible:ring-amber-500",
          state === "speaking"  && "bg-emerald-600 border-emerald-400 focus-visible:ring-emerald-500",
          state === "error"     && "bg-rose-700 border-rose-500 focus-visible:ring-rose-500",
        )}
      >
        {state === "idle" && (
          <svg className="h-12 w-12 text-[var(--color-text-primary)]" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="16" y="8" width="16" height="24" rx="8" />
            <path d="M8 28c0 8.837 7.163 16 16 16s16-7.163 16-16" />
            <line x1="24" y1="44" x2="24" y2="48" />
            <line x1="16" y1="48" x2="32" y2="48" />
          </svg>
        )}
        {state === "connecting" && (
          <svg className="h-10 w-10 text-[var(--color-text-primary)] animate-spin" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M42 24A18 18 0 1 1 24 6" />
          </svg>
        )}
        {state === "listening" && (
          <svg className="h-12 w-12 text-[var(--color-text-primary)]" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="16" y="8" width="16" height="24" rx="8" />
            <path d="M8 28c0 8.837 7.163 16 16 16s16-7.163 16-16" />
            <line x1="24" y1="44" x2="24" y2="48" />
            <line x1="16" y1="48" x2="32" y2="48" />
          </svg>
        )}
        {state === "thinking" && (
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-3 w-3 rounded-full bg-amber-200 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
        {state === "speaking" && (
          <svg className="h-12 w-12 text-[var(--color-text-primary)]" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="8,12 8,36 24,36 40,22 24,8" />
            <path d="M36 18c3 1.5 5 4.5 5 8s-2 6.5-5 8" />
            <path d="M40 12c5 3 8 8 8 14s-3 11-8 14" />
          </svg>
        )}
        {state === "error" && (
          <svg className="h-12 w-12 text-rose-200" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <circle cx="24" cy="24" r="18" />
            <path d="M24 16v12M24 34h.01" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── State label ──────────────────────────────────────────────────────────────

const STATE_CONFIG: Record<VoiceState, { label: string; color: string }> = {
  idle:       { label: "Tap to start voice call",           color: "text-[var(--color-text-muted)]" },
  connecting: { label: "Connecting…",                       color: "text-[var(--color-text-secondary)]" },
  listening:  { label: "Listening…",                        color: "text-indigo-300" },
  thinking:   { label: "Thinking…",                         color: "text-amber-300" },
  speaking:   { label: "Luis is speaking",                  color: "text-emerald-300" },
  error:      { label: "Connection lost. Tap to retry.",    color: "text-rose-400" },
};

// ─── Transcript Entry ─────────────────────────────────────────────────────────

function TranscriptLine({ entry }: { entry: TranscriptEntry }) {
  const isUser = entry.role === "user";
  const isSystem = entry.role === "system";
  const time = entry.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  if (isSystem) {
    return (
      <div className="flex items-center justify-center py-2">
        <span className="text-xs text-[var(--color-text-muted)] px-3 py-1 rounded-full bg-[var(--color-surface-1)] border border-[var(--color-border)]">{entry.text}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div className={cn(
        "flex-none h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0",
        isUser ? "bg-indigo-600 text-[var(--color-text-primary)]" : "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]"
      )}>
        {isUser ? "D" : "🎨"}
      </div>

      {/* Bubble */}
      <div className={cn("max-w-xs md:max-w-md", isUser && "items-end flex flex-col")}>
        <div className={cn(
          "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
          isUser
            ? "bg-indigo-600 text-[var(--color-text-primary)] rounded-tr-sm"
            : "bg-[var(--color-surface-2)] text-[var(--color-text-primary)] rounded-tl-sm",
          entry.isPartial && "opacity-60"
        )}>
          {entry.text}
          {entry.isPartial && <span className="ml-1 inline-flex gap-0.5"><span className="animate-bounce w-1 h-1 bg-current rounded-full" /><span className="animate-bounce w-1 h-1 bg-current rounded-full" style={{ animationDelay: "0.15s" }} /><span className="animate-bounce w-1 h-1 bg-current rounded-full" style={{ animationDelay: "0.3s" }} /></span>}
        </div>
        <div className={cn("flex items-center gap-2 mt-1", isUser && "flex-row-reverse")}>
          <span className="text-xs text-[var(--color-text-muted)]">{time}</span>
          {entry.duration && <span className="text-xs text-[var(--color-text-muted)]">{(entry.duration / 1000).toFixed(1)}s</span>}
          {entry.confidence !== undefined && entry.confidence < 0.9 && (
            <span className="text-xs text-amber-600" title="Low confidence transcription">~{Math.round(entry.confidence * 100)}%</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function VoiceInterface() {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [selectedAgent, setSelectedAgent] = useState<VoiceAgent>(VOICE_AGENTS[0]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(SEED_TRANSCRIPT);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [showTranscript, setShowTranscript] = useState(true);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<VoiceState>("idle");
  stateRef.current = voiceState;

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Session timer
  useEffect(() => {
    if (voiceState !== "idle" && voiceState !== "error") {
      timerRef.current = setInterval(() => setSessionDuration((d) => d + 1), 1000);
    } else {
      if (timerRef.current) {clearInterval(timerRef.current);}
    }
    return () => { if (timerRef.current) {clearInterval(timerRef.current);} };
  }, [voiceState]);

  // Simulate voice conversation loop
  const startSession = useCallback(() => {
    setVoiceState("connecting");
    setSessionDuration(0);
    setTimeout(() => {
      setVoiceState("listening");
      setTranscript((prev) => [...prev, {
        id: `sys-${Date.now()}`,
        role: "system",
        text: `New session started with ${selectedAgent.name}.`,
        timestamp: new Date(),
      }]);

      // Simulate a listening → thinking → speaking cycle
      setTimeout(() => {
        if (stateRef.current !== "listening") {return;}
        setTranscript((prev) => [...prev, {
          id: `user-${Date.now()}`,
          role: "user",
          text: "Hey, what's the status on Horizon UI?",
          timestamp: new Date(),
          duration: 2900,
          confidence: 0.96,
        }]);
        setVoiceState("thinking");
        setTimeout(() => {
          if (stateRef.current !== "thinking") {return;}
          setVoiceState("speaking");
          setTranscript((prev) => [...prev, {
            id: `agent-${Date.now()}`,
            role: "agent",
            text: `All good! 27 views shipped and counting. Build is clean. I'm working on VoiceInterface right now — this view, actually.`,
            timestamp: new Date(),
            duration: 7400,
          }]);
          setTimeout(() => {
            if (stateRef.current !== "speaking") {return;}
            setVoiceState("listening");
          }, 7500);
        }, 1800);
      }, 4000);
    }, 1200);
  }, [selectedAgent]);

  const stopSession = useCallback(() => {
    setVoiceState("idle");
    setSessionDuration(0);
    setTranscript((prev) => [...prev, {
      id: `sys-end-${Date.now()}`,
      role: "system",
      text: "Voice session ended.",
      timestamp: new Date(),
    }]);
  }, []);

  const handleMicPress = useCallback(() => {
    if (voiceState === "idle" || voiceState === "error") {
      startSession();
    } else if (voiceState === "listening") {
      setVoiceState("thinking");
      setTimeout(() => {
        if (stateRef.current !== "thinking") {return;}
        setVoiceState("speaking");
        setTimeout(() => {
          if (stateRef.current !== "speaking") {return;}
          setVoiceState("listening");
        }, 5000);
      }, 1500);
    }
  }, [voiceState, startSession]);

  const formatDuration = (secs: number): string => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const isActive = voiceState !== "idle" && voiceState !== "error";
  const stateCfg = STATE_CONFIG[voiceState];

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)]">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Voice Interface</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Speak directly to your agents</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTranscript((v) => !v)}
            aria-pressed={showTranscript}
            aria-label="Toggle transcript"
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              showTranscript ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/30" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border-[var(--color-border)]"
            )}
          >
            {showTranscript ? "Hide Transcript" : "Show Transcript"}
          </button>
          {isActive && (
            <button
              onClick={stopSession}
              aria-label="End voice session"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-colors"
            >
              End Call
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Main voice panel */}
        <div className={cn("flex flex-col items-center", showTranscript ? "w-80 flex-none border-r border-[var(--color-border)]" : "flex-1")}>
          {/* Agent selector */}
          <div className="w-full px-6 py-4 border-b border-[var(--color-border)]">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Agent</p>
            <div className="space-y-1">
              {VOICE_AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => { if (!isActive) {setSelectedAgent(agent);} }}
                  disabled={isActive}
                  aria-pressed={selectedAgent.id === agent.id}
                  aria-label={`Select ${agent.name} — ${agent.description}`}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    selectedAgent.id === agent.id ? "bg-indigo-600/20 border border-indigo-500/30" : "hover:bg-[var(--color-surface-1)] border border-transparent",
                    isActive && selectedAgent.id !== agent.id && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <span className="text-lg flex-none">{agent.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{agent.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{agent.voice}</p>
                  </div>
                  {selectedAgent.id === agent.id && (
                    <svg className="h-4 w-4 text-indigo-400 flex-none ml-auto" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l4 4 6-6" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Mic area */}
          <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6 py-8">
            {/* Session timer */}
            {isActive && (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-sm font-mono text-[var(--color-text-primary)]">{formatDuration(sessionDuration)}</span>
              </div>
            )}

            {/* Selected agent display */}
            <div className="text-center">
              <div className="text-5xl mb-2">{selectedAgent.emoji}</div>
              <p className="text-base font-semibold text-[var(--color-text-primary)]">{selectedAgent.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{selectedAgent.description}</p>
            </div>

            {/* Mic button */}
            <div onClick={handleMicPress}>
              <MicPulseRing state={voiceState} />
            </div>

            {/* Audio visualizer */}
            <AudioBars
              active={voiceState === "listening" || voiceState === "speaking"}
              color={voiceState === "speaking" ? "bg-emerald-500" : "bg-indigo-500"}
            />

            {/* State label */}
            <p className={cn("text-sm font-medium transition-colors", stateCfg.color)}>
              {stateCfg.label}
            </p>

            {/* Controls (when active) */}
            {isActive && (
              <div className="flex items-center gap-3">
                {/* Mute */}
                <button
                  onClick={() => setIsMuted((v) => !v)}
                  aria-pressed={isMuted}
                  aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                  className={cn(
                    "flex items-center justify-center h-10 w-10 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    isMuted ? "bg-rose-600/20 border-rose-500/30 text-rose-300" : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  {isMuted ? (
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M2 2l12 12M9 9.86A4 4 0 018 10V6a4 4 0 011 .14M5 10.73A4 4 0 014 8V6m4 8v2M7.5 16h1" /><path strokeLinecap="round" d="M12 8a4 4 0 01-.08.8" /></svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="5" y="1" width="6" height="9" rx="3" /><path strokeLinecap="round" d="M3 8a5 5 0 0010 0M8 13v2M6.5 15h3" /></svg>
                  )}
                </button>

                {/* Volume */}
                <div className="flex items-center gap-2">
                  <svg className="h-3.5 w-3.5 text-[var(--color-text-muted)]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <polygon points="1,5 1,11 4,11 8,14 8,2 4,5" />
                    <path strokeLinecap="round" d="M11 6a3 3 0 010 4" />
                  </svg>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    aria-label="Volume"
                    className="w-20 h-1 accent-indigo-500"
                  />
                  <span className="text-xs font-mono text-[var(--color-text-muted)] w-6">{volume}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Transcript panel */}
        {showTranscript && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-none px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Transcript</p>
              <button
                onClick={() => setTranscript([])}
                aria-label="Clear transcript"
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {transcript.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <span className="text-3xl">🎙️</span>
                  <p className="text-sm text-[var(--color-text-muted)]">Transcript will appear here</p>
                </div>
              ) : (
                transcript.map((entry) => <TranscriptLine key={entry.id} entry={entry} />)
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* Partial transcript indicator when listening */}
            {voiceState === "listening" && (
              <div className="flex-none px-5 py-3 border-t border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-xs text-[var(--color-text-muted)]">Listening for speech…</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes audioBar {
          from { transform: scaleY(0.3); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
