import React, { useState, useEffect, useRef } from "react";
import { Inbox } from "lucide-react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";
import { Skeleton } from "../components/ui/Skeleton";

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

function AgentInboxSkeleton() {
  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-surface-0 text-fg-primary font-sans overflow-hidden">
      {/* Sidebar skeleton */}
      <aside className="md:w-64 border-b md:border-b-0 md:border-r border-tok-border flex flex-col p-4 space-y-8 shrink-0">
        <div>
          <Skeleton variant="text" className="h-3 w-16 mb-4" />
          <div className="space-y-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1.5">
                <Skeleton variant="text" className="h-4 w-28" />
                <Skeleton variant="rect" className="h-4 w-6 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div>
          <Skeleton variant="text" className="h-3 w-24 mb-4" />
          <div className="flex flex-wrap gap-2 px-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-6 w-14 rounded-full" />
            ))}
          </div>
        </div>
      </aside>
      {/* Item list skeleton */}
      <main className="md:w-[450px] border-b md:border-b-0 md:border-r border-tok-border flex flex-col shrink-0">
        <div className="p-4 border-b border-tok-border flex justify-between items-center">
          <Skeleton variant="text" className="h-5 w-24" />
          <Skeleton variant="text" className="h-3 w-12" />
        </div>
        <div className="flex-1 divide-y divide-tok-border">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="p-4 flex gap-3">
              <Skeleton variant="circle" className="w-10 h-10 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                  <Skeleton variant="text" className="h-3 w-20" />
                  <Skeleton variant="text" className="h-3 w-10" />
                </div>
                <Skeleton variant="text" className="h-4 w-3/4" />
                <Skeleton variant="text" className="h-3 w-full" />
                <div className="flex gap-2">
                  <Skeleton variant="circle" className="w-2 h-2" />
                  <Skeleton variant="rect" className="h-4 w-16 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      {/* Detail panel skeleton */}
      <section className="flex-1 flex flex-col bg-surface-1/20">
        <div className="p-6 border-b border-tok-border space-y-4">
          <div className="flex gap-4 items-center">
            <Skeleton variant="circle" className="w-12 h-12" />
            <div className="space-y-2">
              <Skeleton variant="text" className="h-5 w-64" />
              <Skeleton variant="text" className="h-3 w-48" />
            </div>
          </div>
          <div className="flex gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton variant="text" className="h-2.5 w-12" />
                <Skeleton variant="rect" className="h-7 w-20 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 p-8 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="text" className="h-4 w-full" />
          ))}
          <Skeleton variant="text" className="h-4 w-2/3" />
        </div>
      </section>
    </div>
  );
}

const AgentInbox: React.FC<{ isLoading?: boolean }> = ({ isLoading = false }) => {
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
    if (currentFolder === 'unread') {return item.status === 'unread';}
    if (currentFolder === 'action-required') {return item.actionRequired && item.status !== 'archived';}
    if (currentFolder === 'archived') {return item.status === 'archived';}
    return item.status !== 'archived';
  });

  const finalItems = fromFilter 
    ? filteredByFolder.filter(i => i.from === fromFilter)
    : filteredByFolder;

  const uniqueSenders = Array.from(new Set(items.map(i => i.from))).toSorted();

  // Styling Helpers
  const getPriorityColor = (p: InboxPriority) => {
    switch (p) {
      case 'urgent': return 'bg-rose-400';
      case 'high': return 'bg-rose-400/60';
      case 'normal': return 'bg-indigo-500';
      case 'low': return 'bg-surface-3';
    }
  };

  const getPriorityLabel = (p: InboxPriority) => {
    switch (p) {
      case 'urgent': return 'Urgent priority';
      case 'high': return 'High priority';
      case 'normal': return 'Normal priority';
      case 'low': return 'Low priority';
    }
  };

  const getKindBadgeStyles = (k: InboxItemKind) => {
    switch (k) {
      case 'task': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'mention': return 'bg-amber-400/10 text-amber-400 border-amber-400/20';
      case 'alert': return 'bg-rose-400/10 text-rose-400 border-rose-400/20';
      case 'review-request': return 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20';
      case 'approval': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'system': return 'bg-surface-2 text-fg-secondary border-tok-border';
    }
  };

  const getInitials = (name: string) => {
    if (name === "system") {return "SYS";}
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-indigo-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 
      'bg-purple-500', 'bg-cyan-500', 'bg-pink-500'
    ];
    if (name === 'system') {return 'bg-surface-3';}
    const charCodeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  if (isLoading) return <AgentInboxSkeleton />;

  return (
    <>
      {/* Skip link */}
      <a
        href="#inbox-list"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-violet-600 focus:text-[var(--color-text-primary)] focus:rounded-lg focus:font-medium focus:outline-none"
      >
        Skip to inbox
      </a>

      <div className="flex flex-col md:flex-row h-screen w-full bg-surface-0 text-fg-primary font-sans overflow-hidden">
        {/* Left: Sidebar */}
        <aside aria-label="Inbox navigation" className="md:w-64 border-b md:border-b-0 md:border-r border-tok-border flex flex-col p-4 space-y-8 shrink-0">
          <div>
            <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-4 px-2">Inbox</h2>
            <nav className="space-y-1" aria-label="Folders">
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
                  aria-pressed={currentFolder === folder.id}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                    currentFolder === folder.id ? "bg-surface-1 text-fg-primary" : "text-fg-secondary hover:text-fg-primary hover:bg-surface-1/50"
                  )}
                >
                  <span>{folder.label}</span>
                  {folder.count > 0 && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      folder.id === 'unread' || folder.id === 'action-required' ? "bg-indigo-500 text-fg-primary" : "bg-surface-2 text-fg-muted"
                    )}>
                      {folder.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div>
            <h2 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-4 px-2">From Agent</h2>
            <div className="flex flex-wrap gap-2 px-2" role="group" aria-label="Filter by sender">
              <button
                onClick={() => setFromFilter(null)}
                aria-pressed={fromFilter === null}
                className={cn(
                  "text-[11px] px-2 py-1 rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                  fromFilter === null ? "bg-surface-2 border-tok-border text-fg-primary" : "border-tok-border text-fg-muted hover:border-tok-border"
                )}
              >
                Everyone
              </button>
              {uniqueSenders.map(sender => (
                <button
                  key={sender}
                  onClick={() => setFromFilter(sender)}
                  aria-pressed={fromFilter === sender}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                    fromFilter === sender ? "bg-surface-2 border-tok-border text-fg-primary" : "border-tok-border text-fg-muted hover:border-tok-border"
                  )}
                >
                  {sender}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Middle: Item List */}
        <section id="inbox-list" aria-label="Message list" className="md:w-[450px] border-b md:border-b-0 md:border-r border-tok-border flex flex-col shrink-0">
          <div className="p-4 border-b border-tok-border flex justify-between items-center bg-surface-0/50 backdrop-blur-sm sticky top-0 z-10">
            <h1 className="text-lg font-bold capitalize">{currentFolder.replace('-', ' ')}</h1>
            <div className="text-xs text-fg-muted">{finalItems.length} items</div>
          </div>
          
          <div className="flex-1 overflow-y-auto divide-y divide-tok-border" role="list" aria-label="Inbox messages">
            {finalItems.length === 0 ? (
              <ContextualEmptyState
                icon={Inbox}
                title="Inbox zero!"
                description="No messages match your current filters. Try adjusting your filter criteria."
                size="sm"
              />
            ) : (
              finalItems.map(item => (
                <button
                  key={item.id}
                  role="listitem"
                  onClick={() => {
                    setSelectedId(item.id);
                    if (item.status === 'unread') {updateItemStatus(item.id, 'read');}
                  }}
                  aria-current={selectedId === item.id ? 'true' : undefined}
                  className={cn(
                    "w-full text-left p-4 flex gap-3 transition-colors hover:bg-surface-1/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 focus-visible:outline-none",
                    selectedId === item.id ? "bg-surface-1" : "bg-transparent"
                  )}
                >
                  <div className={cn("w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-fg-primary shadow-sm", getAvatarColor(item.from))} aria-hidden="true">
                    {getInitials(item.from)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <span className="text-xs text-fg-secondary font-medium truncate">{item.from}</span>
                      <span className="text-[10px] text-fg-muted whitespace-nowrap ml-2">
                        {new Date(item.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h3 className={cn(
                      "text-sm truncate mb-0.5",
                      item.status === 'unread' ? "font-bold text-fg-primary" : "font-normal text-fg-secondary"
                    )}>
                      {item.subject}
                    </h3>
                    <p className="text-xs text-fg-muted line-clamp-1 mb-2">{item.body}</p>
                    <div className="flex items-center gap-2">
                      {/* Priority dot with aria-label */}
                      <div
                        className={cn("w-2 h-2 rounded-full", getPriorityColor(item.priority))}
                        aria-label={getPriorityLabel(item.priority)}
                        role="img"
                      />
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
        </section>

        {/* Right: Detail Panel */}
        <section
          aria-label="Message detail"
          aria-live="polite"
          className="flex-1 flex flex-col bg-surface-1/20"
        >
          {selectedItem ? (
            <>
              {/* Detail Header */}
              <div className="p-3 sm:p-4 md:p-6 border-b border-tok-border bg-surface-1/40">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-4 items-center">
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shadow-lg", getAvatarColor(selectedItem.from))} aria-hidden="true">
                      {getInitials(selectedItem.from)}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-fg-primary leading-tight">{selectedItem.subject}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-fg-secondary">From <span className="text-fg-primary">{selectedItem.from}</span></span>
                        <span className="text-fg-muted text-xs" aria-hidden="true">•</span>
                        <span className="text-xs text-fg-secondary">To <span className="text-fg-primary">Luis</span></span>
                        <span className="text-fg-muted text-xs" aria-hidden="true">•</span>
                        <span className="text-xs text-fg-secondary">{new Date(selectedItem.receivedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => updateItemStatus(selectedItem.id, selectedItem.status === 'unread' ? 'read' : 'unread')}
                      className="p-2 text-fg-secondary hover:text-fg-primary hover:bg-surface-2 rounded-md transition-all border border-transparent hover:border-tok-border focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                      aria-label={selectedItem.status === 'unread' ? "Mark as read" : "Mark as unread"}
                    >
                      <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </button>
                    <button 
                      onClick={() => updateItemStatus(selectedItem.id, 'snoozed')}
                      className="p-2 text-fg-secondary hover:text-amber-400 hover:bg-surface-2 rounded-md transition-all border border-transparent hover:border-tok-border focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                      aria-label="Snooze message"
                    >
                      <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                    <button 
                      onClick={() => updateItemStatus(selectedItem.id, 'archived')}
                      className="p-2 text-fg-secondary hover:text-emerald-400 hover:bg-surface-2 rounded-md transition-all border border-transparent hover:border-tok-border focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
                      aria-label="Archive message"
                    >
                      <svg className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                    </button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-fg-muted uppercase font-semibold">Priority</span>
                    <div className="flex items-center gap-2 px-2 py-1 bg-surface-1 border border-tok-border rounded text-xs">
                      <div className={cn("w-2 h-2 rounded-full", getPriorityColor(selectedItem.priority))} aria-hidden="true" />
                      <span className="capitalize">{selectedItem.priority}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-fg-muted uppercase font-semibold">Kind</span>
                    <div className={cn("px-2 py-1 border rounded text-xs font-medium uppercase", getKindBadgeStyles(selectedItem.kind))}>
                      {selectedItem.kind.replace('-', ' ')}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-fg-muted uppercase font-semibold">Status</span>
                    <div className="px-2 py-1 bg-surface-1 border border-tok-border rounded text-xs text-fg-secondary capitalize">
                      {selectedItem.status}
                    </div>
                  </div>
                </div>
              </div>

              {/* Detail Body */}
              <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
                {selectedItem.status === 'snoozed' && (
                  <div role="status" className="mb-6 p-3 bg-amber-400/10 border border-amber-400/20 rounded-lg text-amber-400 text-xs flex items-center gap-2">
                    <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    This item is currently snoozed and will reappear in your inbox later.
                  </div>
                )}
                
                <div className="prose prose-invert max-w-none">
                  <p className="text-fg-secondary leading-relaxed whitespace-pre-wrap text-base">
                    {selectedItem.body}
                  </p>
                </div>

                {selectedItem.actionRequired && selectedItem.actions && selectedItem.actions.length > 0 && (
                  <div className="mt-12 pt-8 border-t border-tok-border flex gap-3">
                    {selectedItem.actions.map((action, idx) => (
                      <button
                        key={idx}
                        className={cn(
                          "px-6 py-2 rounded-md text-sm font-semibold transition-all shadow-sm active:scale-95 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none",
                          action.variant === 'primary' && "bg-indigo-500 hover:bg-indigo-600 text-fg-primary",
                          action.variant === 'danger' && "bg-rose-500 hover:bg-rose-600 text-fg-primary",
                          action.variant === 'secondary' && "bg-surface-2 hover:bg-surface-3 text-fg-primary border border-tok-border"
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
            <div className="flex-1 flex flex-col items-center justify-center text-fg-muted space-y-4">
              <svg className="w-16 h-16 opacity-20" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm">Select an item to view details</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default AgentInbox;
