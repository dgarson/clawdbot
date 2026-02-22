import React, { useState } from "react";
import { cn } from "../lib/utils";

type MessageStatus = "sent" | "delivered" | "read";
type PresenceStatus = "online" | "away" | "offline" | "dnd";

interface Reaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

interface ThreadMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorEmoji: string;
  content: string;
  timestamp: string;
  reactions: Reaction[];
}

interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorEmoji: string;
  content: string;
  timestamp: string;
  status: MessageStatus;
  isSystem: boolean;
  reactions: Reaction[];
  threadCount: number;
  thread: ThreadMessage[];
  isPinned: boolean;
}

interface Channel {
  id: string;
  name: string;
  emoji: string;
  description: string;
  unread: number;
  mentions: number;
  isMuted: boolean;
  isPrivate: boolean;
  memberCount: number;
  lastActivity: string;
}

interface Member {
  id: string;
  name: string;
  emoji: string;
  role: string;
  presence: PresenceStatus;
}

const MEMBERS: Member[] = [
  { id: "luis",    name: "Luis",    emoji: "🎨", role: "Principal UX Eng", presence: "online" },
  { id: "xavier",  name: "Xavier",  emoji: "🧠", role: "CTO",              presence: "online" },
  { id: "piper",   name: "Piper",   emoji: "🪈", role: "UI Worker",        presence: "away"   },
  { id: "quinn",   name: "Quinn",   emoji: "🎯", role: "UI Worker",        presence: "online" },
  { id: "reed",    name: "Reed",    emoji: "📐", role: "UI Worker",        presence: "offline" },
  { id: "wes",     name: "Wes",     emoji: "⚡", role: "UI Worker",        presence: "dnd"    },
  { id: "tim",     name: "Tim",     emoji: "🏗️", role: "VP Architecture",  presence: "online" },
  { id: "stephan", name: "Stephan", emoji: "📣", role: "CMO",              presence: "away"   },
];

const presenceColor = (p: PresenceStatus) => {
  if (p === "online")  return "bg-emerald-400";
  if (p === "away")    return "bg-amber-400";
  if (p === "dnd")     return "bg-rose-400";
  return "bg-zinc-600";
};

const CHANNELS: Channel[] = [
  { id: "general",   name: "general",       emoji: "💬", description: "Team-wide announcements and water cooler chat", unread: 3,  mentions: 1, isMuted: false, isPrivate: false, memberCount: 12, lastActivity: "2m ago" },
  { id: "cb-inbox",  name: "cb-inbox",      emoji: "📥", description: "Agent notifications and task updates",          unread: 7,  mentions: 3, isMuted: false, isPrivate: false, memberCount: 12, lastActivity: "1m ago" },
  { id: "dev",       name: "dev",           emoji: "💻", description: "Engineering discussion, PRs, and code reviews",  unread: 0,  mentions: 0, isMuted: false, isPrivate: false, memberCount: 8,  lastActivity: "5m ago" },
  { id: "design",    name: "design",        emoji: "🎨", description: "UX design reviews and feedback",                unread: 2,  mentions: 2, isMuted: false, isPrivate: false, memberCount: 5,  lastActivity: "15m ago" },
  { id: "releases",  name: "releases",      emoji: "🚀", description: "Deployment and release tracking",               unread: 0,  mentions: 0, isMuted: true,  isPrivate: false, memberCount: 12, lastActivity: "1h ago" },
  { id: "incidents", name: "incidents",     emoji: "🔥", description: "Active incident response coordination",          unread: 0,  mentions: 0, isMuted: false, isPrivate: false, memberCount: 12, lastActivity: "2h ago" },
  { id: "product-ui","name": "product-ui",  emoji: "🖼️", description: "Private: Product & UI Squad",                  unread: 4,  mentions: 0, isMuted: false, isPrivate: true,  memberCount: 6,  lastActivity: "3m ago" },
];

const MESSAGES: Record<string, ChatMessage[]> = {
  general: [
    { id: "g1", authorId: "xavier", authorName: "Xavier", authorEmoji: "🧠", content: "Good morning team! Big sprint today — let's hit 100 views before the deadline 🎯", timestamp: "07:02", status: "read", isSystem: false, reactions: [{ emoji: "🔥", count: 4, reactedByMe: false }, { emoji: "💪", count: 3, reactedByMe: true }], threadCount: 2, thread: [], isPinned: true },
    { id: "g2", authorId: "luis",   authorName: "Luis",   authorEmoji: "🎨", content: "Already at 98 views and counting. The sprint mandate continues 🚀", timestamp: "07:04", status: "read", isSystem: false, reactions: [{ emoji: "🎨", count: 2, reactedByMe: false }], threadCount: 0, thread: [], isPinned: false },
    { id: "g3", authorId: "piper",  authorName: "Piper",  authorEmoji: "🪈", content: "BudgetTracker and ActivityTimeline are merged — PR reviews welcome!", timestamp: "07:05", status: "read", isSystem: false, reactions: [], threadCount: 1, thread: [{ id: "g3t1", authorId: "luis", authorName: "Luis", authorEmoji: "🎨", content: "Reviewed and merged ✅", timestamp: "07:06", reactions: [] }], isPinned: false },
    { id: "g4", authorId: "system", authorName: "System", authorEmoji: "🤖", content: "Quinn joined the channel", timestamp: "07:10", status: "delivered", isSystem: true, reactions: [], threadCount: 0, thread: [], isPinned: false },
    { id: "g5", authorId: "quinn",  authorName: "Quinn",  authorEmoji: "🎯", content: "AccessControlMatrix is in progress — sending the file shortly", timestamp: "07:11", status: "sent", isSystem: false, reactions: [{ emoji: "👍", count: 1, reactedByMe: false }], threadCount: 0, thread: [], isPinned: false },
  ],
  "cb-inbox": [
    { id: "i1", authorId: "system", authorName: "System", authorEmoji: "🤖", content: "PR #247 merged: feat(ui)/views-96-97 (SearchResultsView + HealthChecklist)", timestamp: "06:45", status: "read", isSystem: true, reactions: [], threadCount: 0, thread: [], isPinned: false },
    { id: "i2", authorId: "system", authorName: "System", authorEmoji: "🤖", content: "Build passed ✅ — 98 views in dist", timestamp: "06:50", status: "read", isSystem: true, reactions: [{ emoji: "✅", count: 2, reactedByMe: false }], threadCount: 0, thread: [], isPinned: false },
    { id: "i3", authorId: "xavier", authorName: "Xavier", authorEmoji: "🧠", content: "@luis Incredible sprint output. Keep pushing — every view counts toward the Horizon launch.", timestamp: "07:00", status: "read", isSystem: false, reactions: [{ emoji: "🙏", count: 1, reactedByMe: true }], threadCount: 0, thread: [], isPinned: false },
  ],
  dev: [
    { id: "d1", authorId: "tim",  authorName: "Tim",  authorEmoji: "🏗️", content: "Frontend build is clean. Architecture is holding up well for 98+ lazy views.", timestamp: "06:30", status: "read", isSystem: false, reactions: [], threadCount: 0, thread: [], isPinned: false },
    { id: "d2", authorId: "wes",  authorName: "Wes",  authorEmoji: "⚡", content: "Bundle sizes look great — largest chunks are <20kB gzipped", timestamp: "06:32", status: "read", isSystem: false, reactions: [{ emoji: "🚀", count: 3, reactedByMe: false }], threadCount: 0, thread: [], isPinned: false },
    { id: "d3", authorId: "reed", authorName: "Reed", authorEmoji: "📐", content: "Heads up: ChatRoomView agent errored silently. Luis is rebuilding manually.", timestamp: "07:08", status: "sent", isSystem: false, reactions: [{ emoji: "😅", count: 1, reactedByMe: false }], threadCount: 0, thread: [], isPinned: false },
  ],
  "product-ui": [
    { id: "p1", authorId: "luis",  authorName: "Luis",  authorEmoji: "🎨", content: "Squad: current assignments — Quinn → AccessControlMatrix, Wes → InfrastructureMap. I'm building ChatRoomView and ReportGenerator directly.", timestamp: "07:12", status: "read", isSystem: false, reactions: [{ emoji: "💪", count: 3, reactedByMe: false }], threadCount: 0, thread: [], isPinned: true },
    { id: "p2", authorId: "piper", authorName: "Piper", authorEmoji: "🪈", content: "Ready for next assignment after InfraMap lands", timestamp: "07:13", status: "sent", isSystem: false, reactions: [], threadCount: 0, thread: [], isPinned: false },
  ],
};

const EMOJI_REACTIONS = ["👍", "❤️", "🔥", "🎉", "😂", "✅", "🚀", "💯"];

export default function ChatRoomView() {
  const [activeChannelId, setActiveChannelId] = useState<string>("general");
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(MESSAGES);
  const [inputText, setInputText] = useState<string>("");
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [threadInput, setThreadInput] = useState<string>("");
  const [showReactionPickerFor, setShowReactionPickerFor] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const channel = CHANNELS.find(c => c.id === activeChannelId)!;
  const channelMessages = messages[activeChannelId] ?? [];
  const openThread = openThreadId ? channelMessages.find(m => m.id === openThreadId) ?? null : null;

  const filteredMessages = searchQuery
    ? channelMessages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : channelMessages;

  function sendMessage() {
    if (!inputText.trim()) return;
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      authorId: "luis",
      authorName: "Luis",
      authorEmoji: "🎨",
      content: inputText.trim(),
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      status: "sent",
      isSystem: false,
      reactions: [],
      threadCount: 0,
      thread: [],
      isPinned: false,
    };
    setMessages(prev => ({
      ...prev,
      [activeChannelId]: [...(prev[activeChannelId] ?? []), newMsg],
    }));
    setInputText("");
  }

  function sendThreadReply() {
    if (!threadInput.trim() || !openThreadId) return;
    const reply: ThreadMessage = {
      id: `thread-${Date.now()}`,
      authorId: "luis",
      authorName: "Luis",
      authorEmoji: "🎨",
      content: threadInput.trim(),
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      reactions: [],
    };
    setMessages(prev => ({
      ...prev,
      [activeChannelId]: prev[activeChannelId].map(m =>
        m.id === openThreadId
          ? { ...m, threadCount: m.threadCount + 1, thread: [...m.thread, reply] }
          : m
      ),
    }));
    setThreadInput("");
  }

  function addReaction(msgId: string, emoji: string) {
    setMessages(prev => ({
      ...prev,
      [activeChannelId]: prev[activeChannelId].map(m => {
        if (m.id !== msgId) return m;
        const existing = m.reactions.find(r => r.emoji === emoji);
        if (existing) {
          return {
            ...m,
            reactions: existing.reactedByMe
              ? m.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count - 1, reactedByMe: false } : r).filter(r => r.count > 0)
              : m.reactions.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r),
          };
        }
        return { ...m, reactions: [...m.reactions, { emoji, count: 1, reactedByMe: true }] };
      }),
    }));
    setShowReactionPickerFor(null);
  }

  function togglePin(msgId: string) {
    setMessages(prev => ({
      ...prev,
      [activeChannelId]: prev[activeChannelId].map(m =>
        m.id === msgId ? { ...m, isPinned: !m.isPinned } : m
      ),
    }));
  }

  return (
    <div className="flex h-full bg-zinc-950 overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        {/* Workspace header */}
        <div className="px-3 py-3 border-b border-zinc-800">
          <div className="font-semibold text-white text-sm">OpenClaw HQ</div>
          <div className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            12 members online
          </div>
        </div>

        {/* Channels */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Channels</div>
          {CHANNELS.filter(c => !c.isPrivate).map(ch => (
            <button
              key={ch.id}
              onClick={() => { setActiveChannelId(ch.id); setOpenThreadId(null); }}
              className={cn(
                "w-full text-left px-3 py-1 flex items-center gap-2 rounded mx-1 my-0.5 text-sm transition-colors",
                activeChannelId === ch.id ? "bg-indigo-500/20 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              )}
            >
              <span className="text-zinc-500">#</span>
              <span className="flex-1 truncate">{ch.name}</span>
              {ch.mentions > 0 && (
                <span className="bg-rose-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {ch.mentions}
                </span>
              )}
              {ch.unread > 0 && ch.mentions === 0 && (
                <span className="text-[10px] font-semibold text-zinc-300">{ch.unread}</span>
              )}
            </button>
          ))}

          <div className="px-3 py-1 mt-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Private</div>
          {CHANNELS.filter(c => c.isPrivate).map(ch => (
            <button
              key={ch.id}
              onClick={() => { setActiveChannelId(ch.id); setOpenThreadId(null); }}
              className={cn(
                "w-full text-left px-3 py-1 flex items-center gap-2 rounded mx-1 my-0.5 text-sm transition-colors",
                activeChannelId === ch.id ? "bg-indigo-500/20 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              )}
            >
              <span className="text-zinc-500">🔒</span>
              <span className="flex-1 truncate">{ch.name}</span>
              {ch.unread > 0 && (
                <span className="text-[10px] font-semibold text-zinc-300">{ch.unread}</span>
              )}
            </button>
          ))}
        </div>

        {/* My presence */}
        <div className="p-3 border-t border-zinc-800 flex items-center gap-2">
          <div className="relative">
            <span className="text-lg">🎨</span>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-zinc-900" />
          </div>
          <div>
            <div className="text-xs font-medium text-white">Luis</div>
            <div className="text-[10px] text-zinc-500">Principal UX Eng</div>
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 font-medium">#</span>
              <span className="font-semibold text-white">{channel.name}</span>
              {channel.isPrivate && <span className="text-[10px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">private</span>}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">{channel.description}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="bg-zinc-800 border border-zinc-700 text-white text-xs px-3 py-1.5 rounded placeholder-zinc-500 focus:outline-none focus:border-indigo-500 w-40"
            />
            <button
              onClick={() => setShowMembers(v => !v)}
              className={cn("text-xs px-3 py-1.5 rounded border transition-colors", showMembers ? "bg-indigo-500/20 border-indigo-500 text-indigo-300" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white")}
            >
              👥 {channel.memberCount}
            </button>
          </div>
        </div>

        {/* Messages + thread panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Messages */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {filteredMessages.length === 0 && (
                <div className="text-center py-12 text-zinc-600">
                  {searchQuery ? `No messages matching "${searchQuery}"` : "No messages yet"}
                </div>
              )}
              {filteredMessages.map(msg => (
                <div
                  key={msg.id}
                  className={cn(
                    "group relative flex gap-3 px-2 py-1.5 rounded hover:bg-zinc-900 transition-colors",
                    msg.isPinned && "border-l-2 border-amber-400"
                  )}
                  onClick={() => setShowReactionPickerFor(null)}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center bg-zinc-800 text-base mt-0.5">
                    {msg.authorEmoji}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {!msg.isSystem && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-semibold text-sm text-white">{msg.authorName}</span>
                        <span className="text-[10px] text-zinc-600">{msg.timestamp}</span>
                        {msg.isPinned && <span className="text-[10px] text-amber-400">📌 pinned</span>}
                      </div>
                    )}
                    <p className={cn("text-sm leading-relaxed", msg.isSystem ? "text-zinc-500 italic" : "text-zinc-200")}>
                      {msg.content}
                    </p>

                    {/* Reactions */}
                    {msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {msg.reactions.map(r => (
                          <button
                            key={r.emoji}
                            onClick={e => { e.stopPropagation(); addReaction(msg.id, r.emoji); }}
                            className={cn(
                              "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors",
                              r.reactedByMe
                                ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                            )}
                          >
                            {r.emoji} {r.count}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Thread */}
                    {msg.threadCount > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); setOpenThreadId(openThreadId === msg.id ? null : msg.id); }}
                        className="mt-1.5 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        💬 {msg.threadCount} {msg.threadCount === 1 ? "reply" : "replies"}
                      </button>
                    )}
                  </div>

                  {/* Hover actions */}
                  <div className="absolute right-2 top-1.5 hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); setShowReactionPickerFor(showReactionPickerFor === msg.id ? null : msg.id); }}
                      className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white px-2 py-1 rounded"
                    >
                      😊
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setOpenThreadId(openThreadId === msg.id ? null : msg.id); }}
                      className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white px-2 py-1 rounded"
                    >
                      💬
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); togglePin(msg.id); }}
                      className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white px-2 py-1 rounded"
                    >
                      📌
                    </button>
                  </div>

                  {/* Reaction picker */}
                  {showReactionPickerFor === msg.id && (
                    <div
                      className="absolute right-2 top-10 z-10 bg-zinc-800 border border-zinc-700 rounded p-2 flex gap-1 shadow-lg"
                      onClick={e => e.stopPropagation()}
                    >
                      {EMOJI_REACTIONS.map(e => (
                        <button key={e} onClick={() => addReaction(msg.id, e)} className="hover:scale-125 transition-transform text-lg">
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Message input */}
            <div className="p-4 border-t border-zinc-800">
              <div className="flex gap-2 items-end">
                <div className="flex-1 bg-zinc-800 border border-zinc-700 rounded overflow-hidden focus-within:border-indigo-500 transition-colors">
                  <textarea
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={`Message #${channel.name}`}
                    className="w-full bg-transparent text-white text-sm px-3 py-2 placeholder-zinc-500 focus:outline-none resize-none"
                    rows={1}
                  />
                  <div className="flex items-center gap-2 px-3 py-1.5 border-t border-zinc-700">
                    <button className="text-zinc-500 hover:text-zinc-300 text-sm">😊</button>
                    <button className="text-zinc-500 hover:text-zinc-300 text-sm">📎</button>
                    <span className="text-[10px] text-zinc-600 ml-auto">↵ to send · ⇧↵ newline</span>
                  </div>
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim()}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Thread panel */}
          {openThread && (
            <div className="w-72 flex-shrink-0 border-l border-zinc-800 flex flex-col bg-zinc-900">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <span className="font-semibold text-sm text-white">Thread</span>
                <button onClick={() => setOpenThreadId(null)} className="text-zinc-500 hover:text-white text-xs">✕ Close</button>
              </div>

              {/* Original message */}
              <div className="p-4 border-b border-zinc-800">
                <div className="flex gap-2">
                  <span className="text-base">{openThread.authorEmoji}</span>
                  <div>
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="font-semibold text-sm text-white">{openThread.authorName}</span>
                      <span className="text-[10px] text-zinc-600">{openThread.timestamp}</span>
                    </div>
                    <p className="text-sm text-zinc-200">{openThread.content}</p>
                  </div>
                </div>
              </div>

              {/* Thread replies */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {openThread.thread.length === 0 && (
                  <p className="text-xs text-zinc-600 text-center">No replies yet</p>
                )}
                {openThread.thread.map(reply => (
                  <div key={reply.id} className="flex gap-2">
                    <span className="text-base">{reply.authorEmoji}</span>
                    <div>
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-semibold text-xs text-white">{reply.authorName}</span>
                        <span className="text-[10px] text-zinc-600">{reply.timestamp}</span>
                      </div>
                      <p className="text-sm text-zinc-200">{reply.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Thread input */}
              <div className="p-3 border-t border-zinc-800">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={threadInput}
                    onChange={e => setThreadInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") sendThreadReply(); }}
                    placeholder="Reply in thread..."
                    className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-xs px-3 py-2 rounded placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={sendThreadReply}
                    disabled={!threadInput.trim()}
                    className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white px-3 py-1.5 rounded text-xs"
                  >
                    ↵
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Members panel */}
          {showMembers && !openThread && (
            <div className="w-56 flex-shrink-0 border-l border-zinc-800 flex flex-col bg-zinc-900">
              <div className="px-4 py-3 border-b border-zinc-800">
                <span className="font-semibold text-sm text-white">Members — {channel.memberCount}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Online — {MEMBERS.filter(m => m.presence === "online").length}</div>
                {MEMBERS.filter(m => m.presence === "online").map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800">
                    <div className="relative">
                      <span className="text-base">{m.emoji}</span>
                      <span className={cn("absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-zinc-900", presenceColor(m.presence))} />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-white">{m.name}</div>
                      <div className="text-[10px] text-zinc-500">{m.role}</div>
                    </div>
                  </div>
                ))}
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-3 mb-2">Away / DND</div>
                {MEMBERS.filter(m => m.presence === "away" || m.presence === "dnd").map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800">
                    <div className="relative">
                      <span className="text-base opacity-60">{m.emoji}</span>
                      <span className={cn("absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-zinc-900", presenceColor(m.presence))} />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-zinc-400">{m.name}</div>
                      <div className="text-[10px] text-zinc-600">{m.presence === "dnd" ? "Do not disturb" : "Away"}</div>
                    </div>
                  </div>
                ))}
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-3 mb-2">Offline</div>
                {MEMBERS.filter(m => m.presence === "offline").map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800">
                    <div className="relative">
                      <span className="text-base opacity-40">{m.emoji}</span>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-zinc-900 bg-zinc-600" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-zinc-600">{m.name}</div>
                      <div className="text-[10px] text-zinc-700">{m.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
