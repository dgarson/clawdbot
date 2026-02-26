import React, { useState } from "react";
import { cn } from "../lib/utils";

type InboxItemKind = 'task' | 'mention' | 'alert' | 'review-request' | 'system' | 'approval';
type InboxPriority = 'urgent' | 'high' | 'normal' | 'low';
type InboxStatus = 'unread' | 'read' | 'archived' | 'snoozed';

interface InboxItem {
  id: string;
  kind: InboxItemKind;
  priority: InboxPriority;
  status: InboxStatus;
  from: string;
  to: string;
  subject: string;
  body: string;
  receivedAt: string;
  actionRequired: boolean;
  actions?: Array<{ label: string; variant: 'primary' | 'danger' | 'secondary' }>;
}

const INITIAL_ITEMS: InboxItem[] = [
  {
    id: "1",
    from: "Xavier",
    to: "Luis",
    kind: "review-request",
    priority: "high",
    status: "unread",
    subject: "Review megabranch PR #142 — feat/horizon-sprint",
    body: "The core dashboard layout is ready for review. This includes the sidebar navigation and the initial widget grid structure. Please focus on the responsive breakpoints.",
    receivedAt: "2026-02-22T02:00:00Z",
    actionRequired: true,
    actions: [
      { label: "Approve", variant: "primary" },
      { label: "Request Changes", variant: "secondary" }
    ]
  },
  {
    id: "2",
    from: "Joey",
    to: "Luis",
    kind: "task",
    priority: "normal",
    status: "unread",
    subject: "Update UX_WORK_QUEUE.md with sprint status",
    body: "We need to sync the current sprint progress with the work queue file for the stakeholders' meeting tomorrow.",
    receivedAt: "2026-02-22T01:30:00Z",
    actionRequired: true,
    actions: [{ label: "Mark Done", variant: "primary" }]
  },
  {
    id: "3",
    from: "system",
    to: "Luis",
    kind: "alert",
    priority: "urgent",
    status: "unread",
    subject: "Build failed: TS errors in ThemeEditor.tsx",
    body: "Pipeline 'Horizon UI' failed at step 'type-check'. Error: Property 'colorScheme' does not exist on type 'ThemeConfig'.",
    receivedAt: "2026-02-22T01:15:00Z",
    actionRequired: true,
    actions: [
      { label: "View Error", variant: "danger" },
      { label: "Dismiss", variant: "secondary" }
    ]
  },
  {
    id: "4",
    from: "Tim",
    to: "Luis",
    kind: "system",
    priority: "normal",
    status: "read",
    subject: "PR #138 merged to dgarson/fork",
    body: "Your changes for the accessibility audit have been successfully merged into the fork branch.",
    receivedAt: "2026-02-21T23:45:00Z",
    actionRequired: false
  },
  {
    id: "5",
    from: "Xavier",
    to: "Luis",
    kind: "mention",
    priority: "high",
    status: "unread",
    subject: "@Luis what's the ETA on AgentTracer?",
    body: "The backend squad needs the AgentTracer component to start integrating the telemetry data. Any updates?",
    receivedAt: "2026-02-21T22:20:00Z",
    actionRequired: true,
    actions: [{ label: "Reply", variant: "primary" }]
  },
  {
    id: "6",
    from: "Piper",
    to: "Luis",
    kind: "review-request",
    priority: "normal",
    status: "unread",
    subject: "ApiPlayground PR ready for review",
    body: "I've added the interaction states for the new API playground. Let me know if the hover effects are too subtle.",
    receivedAt: "2026-02-21T21:10:00Z",
    actionRequired: true,
    actions: [
      { label: "Review", variant: "primary" },
      { label: "Approve", variant: "secondary" }
    ]
  },
  {
    id: "7",
    from: "system",
    to: "Luis",
    kind: "system",
    priority: "low",
    status: "read",
    subject: "Daily backup complete — 2.4 GB archived",
    body: "The daily snapshot of the workspace has been uploaded to S3. Retention period: 30 days.",
    receivedAt: "2026-02-21T20:00:00Z",
    actionRequired: false
  },
  {
    id: "8",
    from: "David",
    to: "Luis",
    kind: "approval",
    priority: "urgent",
    status: "unread",
    subject: "APPROVAL REQUIRED: Deploy Horizon UI to staging",
    body: "This deployment includes the new design tokens and the updated Agent Inbox view. Please verify before staging release.",
    receivedAt: "2026-02-21T19:30:00Z",
    actionRequired: true,
    actions: [
      { label: "Approve", variant: "primary" },
      { label: "Deny", variant: "danger" }
    ]
  },
  {
    id: "9",
    from: "Stephan",
    to: "Luis",
    kind: "task",
    priority: "normal",
    status: "unread",
    subject: "Brand review: ThemeEditor colors match guidelines?",
    body: "Could you double-check the hex codes in the new ThemeEditor? I'm worried the zinc-800 borders might be too dark against the background.",
    receivedAt: "2026-02-21T18:15:00Z",
    actionRequired: true,
    actions: [
      { label: "Reply", variant: "primary" },
      { label: "Defer", variant: "secondary" }
    ]
  },
  {
    id: "10",
    from: "Quinn",
    to: "Luis",
    kind: "review-request",
    priority: "normal",
    status: "unread",
    subject: "PluginManager PR — LGTM pending your approval",
    body: "The state management for the plugin manager is now robust. I've handled all the edge cases for failed installations.",
    receivedAt: "2026-02-21T17:00:00Z",
    actionRequired: true,
    actions: [
      { label: "Approve", variant: "primary" },
      { label: "Request Changes", variant: "secondary" }
    ]
  },
  {
    id: "11",
    from: "system",
    to: "Luis",
    kind: "alert",
    priority: "high",
    status: "unread",
    subject: "Rate limit warning: GPT-4o at 87% hourly quota",
    body: "The agent orchestrator is hitting token limits. Consider optimizing prompts or increasing the rate limit window.",
    receivedAt: "2026-02-21T16:45:00Z",
    actionRequired: true,
    actions: [
      { label: "View", variant: "primary" },
      { label: "Dismiss", variant: "secondary" }
    ]
  },
  {
    id: "12",
    from: "Wes",
    to: "Luis",
    kind: "mention",
    priority: "low",
    status: "read",
    subject: "@Luis CostOptimizer is done!",
    body: "Just finished the refactor on the CostOptimizer primitives. They should be much easier to use in the new views now.",
    receivedAt: "2026-02-21T15:30:00Z",
    actionRequired: false
  },
  {
    id: "13",
    from: "system",
    to: "Luis",
    kind: "system",
    priority: "low",
    status: "read",
    subject: "Cron job: morning-heartbeat completed in 14.3s",
    body: "Automated checks for environment health were successful. No issues found in current workspace nodes.",
    receivedAt: "2026-02-21T08:00:00Z",
    actionRequired: false
  },
  {
    id: "14",
    from: "Reed",
    to: "Luis",
    kind: "review-request",
    priority: "normal",
    status: "unread",
    subject: "WorkspaceSettings — please review and merge",
    body: "I've completed the accessibility audit on the WorkspaceSettings view. Keyboard navigation and screen reader labels are fully implemented.",
    receivedAt: "2026-02-21T07:30:00Z",
    actionRequired: true,
    actions: [{ label: "Review", variant: "primary" }]
  }
];

type Folder = 'all' | 'unread' | 'action-required' | 'archived';

const AgentInbox: React.FC = () => {
  const [items, setItems] = useState<InboxItem[]>(INITIAL_ITEMS);
  const [selectedId, setSelectedId] = useState<string | null>(INITIAL_ITEMS[0].id);
  const [currentFolder, setCurrentFolder] = useState<Folder>('all');
  const [fromFilter, setFromFilter] = useState<string | null>(null);

  const selectedItem = items.find(i => i.id === selectedId) || null;

  // Helpers
  const updateItemStatus = (id: string, status: InboxStatus) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, status } : item));
  };

  const getUnreadCount = (filteredItems: InboxItem[]) => filteredItems.filter(i => i.status === 'unread').length;
  const getActionRequiredCount = (filteredItems: InboxItem[]) => filteredItems.filter(i => i.actionRequired && i.status !== 'archived').length;

  // Filter Logic
  const filteredByFolder = items.filter(item => {
    if (currentFolder === 'unread') return item.status === 'unread';
    if (currentFolder === 'action-required') return item.actionRequired && item.status !== 'archived';
    if (currentFolder === 'archived') return item.status === 'archived';
    return item.status !== 'archived';
  });

  const finalItems = fromFilter 
    ? filteredByFolder.filter(i => i.from === fromFilter)
    : filteredByFolder;

  const uniqueSenders = Array.from(new Set(items.map(i => i.from))).sort();

  // Styling Helpers
  const getPriorityColor = (p: InboxPriority) => {
    switch (p) {
      case 'urgent': return 'bg-rose-400';
      case 'high': return 'bg-rose-400/60';
      case 'normal': return 'bg-indigo-500';
      case 'low': return 'bg-zinc-500';
    }
  };

  const getKindBadgeStyles = (k: InboxItemKind) => {
    switch (k) {
      case 'task': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'mention': return 'bg-amber-400/10 text-amber-400 border-amber-400/20';
      case 'alert': return 'bg-rose-400/10 text-rose-400 border-rose-400/20';
      case 'review-request': return 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20';
      case 'approval': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'system': return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const getInitials = (name: string) => {
    if (name === "system") return "SYS";
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-indigo-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 
      'bg-purple-500', 'bg-cyan-500', 'bg-pink-500'
    ];
    if (name === 'system') return 'bg-zinc-700';
    const charCodeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-white font-sans overflow-hidden">
      {/* Left: Sidebar */}
      <aside className="w-64 border-r border-zinc-800 flex flex-col p-4 space-y-8 shrink-0">
        <div>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-2">Inbox</h2>
          <nav className="space-y-1">
            {[
              { id: 'all', label: 'All Items', count: items.filter(i => i.status !== 'archived').length },
              { id: 'unread', label: 'Unread', count: getUnreadCount(items) },
              { id: 'action-required', label: 'Action Required', count: getActionRequiredCount(items) },
              { id: 'archived', label: 'Archived', count: items.filter(i => i.status === 'archived').length },
            ].map((folder) => (
              <button
                key={folder.id}
                onClick={() => {
                  setCurrentFolder(folder.id as Folder);
                  setFromFilter(null);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                  currentFolder === folder.id ? "bg-zinc-900 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
                )}
              >
                <span>{folder.label}</span>
                {folder.count > 0 && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    folder.id === 'unread' || folder.id === 'action-required' ? "bg-indigo-500 text-white" : "bg-zinc-800 text-zinc-500"
                  )}>
                    {folder.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-2">From Agent</h2>
          <div className="flex flex-wrap gap-2 px-2">
            <button
              onClick={() => setFromFilter(null)}
              className={cn(
                "text-[11px] px-2 py-1 rounded-full border transition-colors",
                fromFilter === null ? "bg-zinc-800 border-zinc-700 text-white" : "border-zinc-800 text-zinc-500 hover:border-zinc-700"
              )}
            >
              Everyone
            </button>
            {uniqueSenders.map(sender => (
              <button
                key={sender}
                onClick={() => setFromFilter(sender)}
                className={cn(
                  "text-[11px] px-2 py-1 rounded-full border transition-colors",
                  fromFilter === sender ? "bg-zinc-800 border-zinc-700 text-white" : "border-zinc-800 text-zinc-500 hover:border-zinc-700"
                )}
              >
                {sender}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Middle: Item List */}
      <main className="w-[450px] border-r border-zinc-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50 backdrop-blur-sm sticky top-0 z-10">
          <h1 className="text-lg font-bold capitalize">{currentFolder.replace('-', ' ')}</h1>
          <div className="text-xs text-zinc-500">{finalItems.length} items</div>
        </div>
        
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
          {finalItems.length === 0 ? (
            <div className="p-8 text-center text-zinc-600 text-sm">No items found in this view.</div>
          ) : (
            finalItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  if (item.status === 'unread') updateItemStatus(item.id, 'read');
                }}
                className={cn(
                  "w-full text-left p-4 flex gap-3 transition-colors hover:bg-zinc-900/40",
                  selectedId === item.id ? "bg-zinc-900" : "bg-transparent"
                )}
              >
                <div className={cn("w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-sm", getAvatarColor(item.from))}>
                  {getInitials(item.from)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-0.5">
                    <span className="text-xs text-zinc-400 font-medium truncate">{item.from}</span>
                    <span className="text-[10px] text-zinc-500 whitespace-nowrap ml-2">
                      {new Date(item.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h3 className={cn(
                    "text-sm truncate mb-0.5",
                    item.status === 'unread' ? "font-bold text-white" : "font-normal text-zinc-300"
                  )}>
                    {item.subject}
                  </h3>
                  <p className="text-xs text-zinc-500 line-clamp-1 mb-2">{item.body}</p>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", getPriorityColor(item.priority))} title={`Priority: ${item.priority}`} />
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase",
                      getKindBadgeStyles(item.kind)
                    )}>
                      {item.kind.replace('-', ' ')}
                    </span>
                    {item.actionRequired && item.status !== 'archived' && (
                      <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-tight">Action Req.</span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </main>

      {/* Right: Detail Panel */}
      <section className="flex-1 flex flex-col bg-zinc-900/20">
        {selectedItem ? (
          <>
            {/* Detail Header */}
            <div className="p-6 border-b border-zinc-800 bg-zinc-900/40">
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-4 items-center">
                  <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shadow-lg", getAvatarColor(selectedItem.from))}>
                    {getInitials(selectedItem.from)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white leading-tight">{selectedItem.subject}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-zinc-400">From <span className="text-zinc-200">{selectedItem.from}</span></span>
                      <span className="text-zinc-700 text-xs">•</span>
                      <span className="text-xs text-zinc-400">To <span className="text-zinc-200">Luis</span></span>
                      <span className="text-zinc-700 text-xs">•</span>
                      <span className="text-xs text-zinc-400">{new Date(selectedItem.receivedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => updateItemStatus(selectedItem.id, selectedItem.status === 'unread' ? 'read' : 'unread')}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-all border border-transparent hover:border-zinc-700"
                    title={selectedItem.status === 'unread' ? "Mark as read" : "Mark as unread"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </button>
                  <button 
                    onClick={() => updateItemStatus(selectedItem.id, 'snoozed')}
                    className="p-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded-md transition-all border border-transparent hover:border-zinc-700"
                    title="Snooze"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                  <button 
                    onClick={() => updateItemStatus(selectedItem.id, 'archived')}
                    className="p-2 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded-md transition-all border border-transparent hover:border-zinc-700"
                    title="Archive"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                  </button>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Priority</span>
                  <div className="flex items-center gap-2 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs">
                    <div className={cn("w-2 h-2 rounded-full", getPriorityColor(selectedItem.priority))} />
                    <span className="capitalize">{selectedItem.priority}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Kind</span>
                  <div className={cn("px-2 py-1 border rounded text-xs font-medium uppercase", getKindBadgeStyles(selectedItem.kind))}>
                    {selectedItem.kind.replace('-', ' ')}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-semibold">Status</span>
                  <div className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300 capitalize">
                    {selectedItem.status}
                  </div>
                </div>
              </div>
            </div>

            {/* Detail Body */}
            <div className="flex-1 p-8 overflow-y-auto">
              {selectedItem.status === 'snoozed' && (
                <div className="mb-6 p-3 bg-amber-400/10 border border-amber-400/20 rounded-lg text-amber-400 text-xs flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  This item is currently snoozed and will reappear in your inbox later.
                </div>
              )}
              
              <div className="prose prose-invert max-w-none">
                <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-base">
                  {selectedItem.body}
                </p>
              </div>

              {selectedItem.actionRequired && selectedItem.actions && selectedItem.actions.length > 0 && (
                <div className="mt-12 pt-8 border-t border-zinc-800 flex gap-3">
                  {selectedItem.actions.map((action, idx) => (
                    <button
                      key={idx}
                      className={cn(
                        "px-6 py-2 rounded-md text-sm font-semibold transition-all shadow-sm active:scale-95",
                        action.variant === 'primary' && "bg-indigo-500 hover:bg-indigo-600 text-white",
                        action.variant === 'danger' && "bg-rose-500 hover:bg-rose-600 text-white",
                        action.variant === 'secondary' && "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                      )}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 space-y-4">
            <svg className="w-16 h-16 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm">Select an item to view details</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default AgentInbox;
