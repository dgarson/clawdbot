import React, { useState } from "react";
import { cn } from "../lib/utils";

type MessageRole = "system" | "user" | "assistant";
type ModelId = "claude-sonnet-4-6" | "claude-opus-4-6" | "gpt-4o" | "gemini-3-flash" | "minimax-m2.5" | "llama-3.3-70b";

interface Message {
  role: MessageRole;
  content: string;
}

interface ModelConfig {
  id: ModelId;
  name: string;
  provider: string;
  maxTokens: number;
  supportsSystem: boolean;
  costPer1kIn: number;
  costPer1kOut: number;
}

interface PlaygroundSession {
  id: string;
  name: string;
  model: ModelId;
  messages: Message[];
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  createdAt: string;
}

const MODELS: ModelConfig[] = [
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "Anthropic", maxTokens: 8192, supportsSystem: true, costPer1kIn: 3, costPer1kOut: 15 },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "Anthropic", maxTokens: 8192, supportsSystem: true, costPer1kIn: 15, costPer1kOut: 75 },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", maxTokens: 4096, supportsSystem: true, costPer1kIn: 5, costPer1kOut: 15 },
  { id: "gemini-3-flash", name: "Gemini 3 Flash", provider: "Google", maxTokens: 8192, supportsSystem: true, costPer1kIn: 0.15, costPer1kOut: 0.6 },
  { id: "minimax-m2.5", name: "MiniMax M2.5", provider: "MiniMax", maxTokens: 4096, supportsSystem: true, costPer1kIn: 0.8, costPer1kOut: 3.2 },
  { id: "llama-3.3-70b", name: "Llama 3.3 70B", provider: "Meta", maxTokens: 4096, supportsSystem: false, costPer1kIn: 0.9, costPer1kOut: 0.9 },
];

const SAVED_SESSIONS: PlaygroundSession[] = [
  {
    id: "ps-001",
    name: "Soul editor prompting",
    model: "claude-sonnet-4-6",
    temperature: 0.8,
    maxTokens: 2048,
    systemPrompt: "You are an expert at writing agent personality descriptions. Be concise and vivid.",
    messages: [
      { role: "user", content: "Write a soul description for an agent named 'Luis' who is a UX engineer." },
      { role: "assistant", content: "Luis is a Principal UX Engineer who lives at the intersection of design and code. He's charming, decisive, and slightly obsessed with pixel-perfect details. He moves fast, communicates clearly, and never waits for permission to improve something. His instinct is always: make it beautiful, make it accessible, make it ship." },
    ],
    createdAt: "2026-02-21 22:40",
  },
  {
    id: "ps-002",
    name: "Cron expression explainer",
    model: "gpt-4o",
    temperature: 0.3,
    maxTokens: 512,
    systemPrompt: "You explain cron expressions in plain English.",
    messages: [
      { role: "user", content: "What does '0 */6 * * *' mean?" },
      { role: "assistant", content: "This runs every 6 hours, at the top of the hour — so at midnight, 6am, noon, and 6pm every day." },
    ],
    createdAt: "2026-02-21 20:15",
  },
  {
    id: "ps-003",
    name: "TypeScript code review",
    model: "claude-opus-4-6",
    temperature: 0.5,
    maxTokens: 4096,
    systemPrompt: "You are a TypeScript expert doing code review. Be specific and educational.",
    messages: [
      { role: "user", content: "Review this: `const x: any = fetch('/api')` — what's wrong?" },
      { role: "assistant", content: "Two issues: `any` defeats TypeScript's type system — you lose all type safety. And `fetch` returns a `Promise<Response>`, so you need to `await` it and type properly: `const res: Response = await fetch('/api');`. If you know the response shape, type it further: `const data: MyType = await res.json();`" },
    ],
    createdAt: "2026-02-21 18:00",
  },
];

const ROLE_STYLES: Record<MessageRole, string> = {
  system: "bg-amber-500/5 border-amber-500/20",
  user: "bg-indigo-500/5 border-indigo-500/20",
  assistant: "bg-zinc-800/50 border-zinc-700/50",
};

const ROLE_LABEL: Record<MessageRole, string> = {
  system: "system",
  user: "user",
  assistant: "assistant",
};

const ROLE_LABEL_COLOR: Record<MessageRole, string> = {
  system: "text-amber-400",
  user: "text-indigo-400",
  assistant: "text-zinc-400",
};

// Simulate a response based on content
function simulateResponse(messages: Message[], model: ModelId): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return "No user message to respond to.";
  const q = lastUser.content.toLowerCase();

  if (q.includes("hello") || q.includes("hi")) {
    return `Hello! I'm running on ${MODELS.find((m) => m.id === model)?.name ?? model}. How can I help you today?`;
  }
  if (q.includes("explain") || q.includes("what")) {
    return `Great question. Based on the context provided, here's my analysis: this is a simulated response from the ${MODELS.find((m) => m.id === model)?.name ?? model} model in the LLM Playground. In a real deployment, this would invoke the actual model API and stream the response back in real time.`;
  }
  if (q.includes("code") || q.includes("typescript") || q.includes("react")) {
    return "```typescript\n// Simulated code response\nconst example = (): string => {\n  return 'This is a playground simulation';\n};\n```\nIn production, the actual model would generate real, functional code based on your prompt and system context.";
  }
  return `Simulated response from ${MODELS.find((m) => m.id === model)?.name ?? model}. This playground demonstrates the UI for prompt engineering and model comparison. Connect a real API endpoint to get live responses.`;
}

export default function LLMPlayground() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>("ps-001");
  const [sessions, setSessions] = useState<PlaygroundSession[]>(SAVED_SESSIONS);

  const [draftModel, setDraftModel] = useState<ModelId>("claude-sonnet-4-6");
  const [draftTemp, setDraftTemp] = useState(0.7);
  const [draftMaxTokens, setDraftMaxTokens] = useState(2048);
  const [draftSystem, setDraftSystem] = useState("");
  const [draftMessages, setDraftMessages] = useState<Message[]>([]);
  const [draftInput, setDraftInput] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [panel, setPanel] = useState<"sessions" | "params">("sessions");

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  // Local edit state for active session
  const [editInput, setEditInput] = useState("");

  function loadSession(session: PlaygroundSession) {
    setActiveSessionId(session.id);
    setDraftModel(session.model);
    setDraftTemp(session.temperature);
    setDraftMaxTokens(session.maxTokens);
    setDraftSystem(session.systemPrompt);
    setDraftMessages(session.messages);
    setEditInput("");
  }

  function newSession() {
    setActiveSessionId(null);
    setDraftModel("claude-sonnet-4-6");
    setDraftTemp(0.7);
    setDraftMaxTokens(2048);
    setDraftSystem("");
    setDraftMessages([]);
    setDraftInput("");
    setEditInput("");
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const input = activeSession ? editInput : draftInput;
    if (!input.trim()) return;

    const model = activeSession ? activeSession.model : draftModel;
    const userMsg: Message = { role: "user", content: input.trim() };

    if (activeSession) {
      const updatedMsgs = [...activeSession.messages, userMsg];
      setIsSimulating(true);
      setTimeout(() => {
        const assistantMsg: Message = {
          role: "assistant",
          content: simulateResponse(updatedMsgs, model),
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSession.id
              ? { ...s, messages: [...updatedMsgs, assistantMsg] }
              : s
          )
        );
        setIsSimulating(false);
        setEditInput("");
      }, 800);
    } else {
      const updatedMsgs = [...draftMessages, userMsg];
      setIsSimulating(true);
      setTimeout(() => {
        const assistantMsg: Message = {
          role: "assistant",
          content: simulateResponse(updatedMsgs, draftModel),
        };
        setDraftMessages([...updatedMsgs, assistantMsg]);
        setIsSimulating(false);
        setDraftInput("");
      }, 800);
    }
  }

  const messages = activeSession ? activeSession.messages : draftMessages;
  const model = activeSession ? activeSession.model : draftModel;
  const temp = activeSession ? activeSession.temperature : draftTemp;
  const maxTok = activeSession ? activeSession.maxTokens : draftMaxTokens;
  const sysPrompt = activeSession ? activeSession.systemPrompt : draftSystem;
  const inputVal = activeSession ? editInput : draftInput;
  const setInputVal = activeSession ? setEditInput : setDraftInput;

  const modelConfig = MODELS.find((m) => m.id === model);
  const estimatedTokens = messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0);
  const estimatedCost = modelConfig
    ? ((estimatedTokens / 1000) * modelConfig.costPer1kIn + (estimatedTokens / 1000) * modelConfig.costPer1kOut * 0.3) / 100
    : 0;

  return (
    <div className="h-full flex bg-zinc-950 overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-64 shrink-0 border-r border-zinc-800 flex flex-col overflow-hidden">
        {/* Sidebar tabs */}
        <div className="shrink-0 border-b border-zinc-800 flex" role="tablist">
          {(["sessions", "params"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={panel === t}
              onClick={() => setPanel(t)}
              className={cn(
                "flex-1 py-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                panel === t ? "text-indigo-400 border-b-2 border-indigo-500" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {t === "sessions" ? "Sessions" : "Params"}
            </button>
          ))}
        </div>

        {panel === "sessions" && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              <button
                onClick={newSession}
                className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                + New Session
              </button>
            </div>
            <ul className="divide-y divide-zinc-800/50" role="listbox" aria-label="Saved sessions">
              {sessions.map((session) => (
                <li key={session.id}>
                  <button
                    role="option"
                    aria-selected={session.id === activeSessionId}
                    onClick={() => loadSession(session)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 hover:bg-zinc-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
                      session.id === activeSessionId && "bg-zinc-800 border-l-2 border-indigo-500"
                    )}
                  >
                    <div className="text-xs font-medium text-zinc-200 truncate">{session.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5 truncate">
                      {MODELS.find((m) => m.id === session.model)?.name ?? session.model}
                    </div>
                    <div className="text-xs text-zinc-600 mt-0.5">{session.createdAt}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {panel === "params" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Model */}
            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">Model</label>
              <select
                value={model}
                onChange={(e) => setDraftModel(e.target.value as ModelId)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={!!activeSession}
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {modelConfig && (
                <div className="mt-1 text-xs text-zinc-600">
                  {modelConfig.provider} · ${(modelConfig.costPer1kIn / 100).toFixed(4)}/1k in
                </div>
              )}
            </div>

            {/* Temperature */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-400 font-medium">Temperature</label>
                <span className="text-xs text-zinc-300 font-mono">{temp.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.01}
                value={temp}
                onChange={(e) => setDraftTemp(parseFloat(e.target.value))}
                className="w-full accent-indigo-500"
                disabled={!!activeSession}
                aria-label={`Temperature: ${temp}`}
              />
              <div className="flex justify-between text-xs text-zinc-600 mt-0.5">
                <span>deterministic</span>
                <span>creative</span>
              </div>
            </div>

            {/* Max tokens */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-400 font-medium">Max tokens</label>
                <span className="text-xs text-zinc-300 font-mono">{maxTok}</span>
              </div>
              <input
                type="range"
                min={256}
                max={modelConfig?.maxTokens ?? 4096}
                step={256}
                value={maxTok}
                onChange={(e) => setDraftMaxTokens(parseInt(e.target.value))}
                className="w-full accent-indigo-500"
                disabled={!!activeSession}
                aria-label={`Max tokens: ${maxTok}`}
              />
            </div>

            {/* System prompt */}
            <div>
              <label className="text-xs text-zinc-400 font-medium block mb-1">System Prompt</label>
              <textarea
                value={sysPrompt}
                onChange={(e) => setDraftSystem(e.target.value)}
                rows={5}
                disabled={!!activeSession}
                placeholder="Enter system prompt…"
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-zinc-600 disabled:opacity-50"
              />
            </div>

            {/* Cost estimate */}
            <div className="bg-zinc-900 rounded border border-zinc-800 p-3 space-y-1">
              <div className="text-xs font-medium text-zinc-400 mb-1">Estimates</div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Context tokens</span>
                <span className="text-zinc-300">{estimatedTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Est. cost</span>
                <span className="text-zinc-300">${estimatedCost.toFixed(4)}</span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b border-zinc-800 px-5 py-3 flex items-center gap-3">
          <div>
            <span className="text-sm font-semibold text-white">
              {activeSession ? activeSession.name : "New Session"}
            </span>
            <span className="ml-2 text-xs text-zinc-500">{modelConfig?.name ?? model}</span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
            <span>temp {temp.toFixed(1)}</span>
            <span>·</span>
            <span>max {maxTok.toLocaleString()} tok</span>
          </div>
        </div>

        {/* System prompt display */}
        {sysPrompt && (
          <div className="shrink-0 mx-4 mt-3 rounded border border-amber-500/20 bg-amber-500/5 px-4 py-2">
            <div className="text-xs font-medium text-amber-400 mb-0.5">System</div>
            <p className="text-xs text-amber-100/70 leading-relaxed line-clamp-2">{sysPrompt}</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
              Start a conversation below
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg border p-4",
                ROLE_STYLES[msg.role]
              )}
            >
              <div className={cn("text-xs font-semibold mb-2 uppercase tracking-wide", ROLE_LABEL_COLOR[msg.role])}>
                {ROLE_LABEL[msg.role]}
              </div>
              <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          ))}
          {isSimulating && (
            <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-4">
              <div className="text-xs font-semibold mb-2 uppercase tracking-wide text-zinc-400">assistant</div>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="shrink-0 border-t border-zinc-800 p-4">
          <div className="flex gap-2">
            <textarea
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e as unknown as React.FormEvent);
                }
              }}
              rows={3}
              placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
              className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-zinc-600"
              disabled={isSimulating}
              aria-label="Message input"
            />
            <button
              type="submit"
              disabled={!inputVal.trim() || isSimulating}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors self-end focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
