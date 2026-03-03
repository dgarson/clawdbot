import React, { useState } from "react";
import { cn } from "../lib/utils";

/**
 * MessageQueueManager Dashboard
 * 
 * A comprehensive message queue management interface for Horizon UI.
 * Features: Queue monitoring, message browsing, DLQ management, and configuration.
 * 
 * DESIGN SYSTEM:
 * - Dark theme: bg-zinc-950 (page), bg-zinc-900 (cards), border-zinc-800, text-white
 * - Accent: indigo-500/600, success: emerald-400, error: rose-400, warning: amber-400
 * - Accessibility: Keyboard navigable tabs, semantic HTML, ARIA labels.
 */

// --- Types ---

type QueueType = "Standard" | "FIFO";
type QueueStatus = "active" | "paused" | "draining";

interface MessageQueue {
  id: string;
  name: string;
  type: QueueType;
  depth: number;
  inFlight: number;
  consumers: number;
  throughput: number; // msg/s
  status: QueueStatus;
  visibilityTimeout: number; // seconds
  retentionPeriod: number; // days
  delaySeconds: number;
}

interface Message {
  id: string;
  queueId: string;
  timestamp: string;
  size: string;
  contentType: string;
  deliveryCount: number;
  payload: unknown;
}

interface DeadLetterMessage extends Message {
  originalQueue: string;
  failureReason: string;
  firstFailure: string;
  lastFailure: string;
  retryCount: number;
}

// --- Mock Data ---

const MOCK_QUEUES: MessageQueue[] = [
  { id: "q-1", name: "orders-processing", type: "FIFO", depth: 1240, inFlight: 45, consumers: 12, throughput: 150.5, status: "active", visibilityTimeout: 30, retentionPeriod: 4, delaySeconds: 0 },
  { id: "q-2", name: "email-notifications", type: "Standard", depth: 450, inFlight: 12, consumers: 5, throughput: 45.2, status: "active", visibilityTimeout: 60, retentionPeriod: 7, delaySeconds: 5 },
  { id: "q-3", name: "user-signup-webhooks", type: "Standard", depth: 0, inFlight: 0, consumers: 3, throughput: 0, status: "active", visibilityTimeout: 30, retentionPeriod: 14, delaySeconds: 0 },
  { id: "q-4", name: "inventory-updates", type: "FIFO", depth: 89, inFlight: 10, consumers: 8, throughput: 12.8, status: "paused", visibilityTimeout: 45, retentionPeriod: 4, delaySeconds: 0 },
  { id: "q-5", name: "image-resize-tasks", type: "Standard", depth: 5600, inFlight: 120, consumers: 25, throughput: 340.0, status: "active", visibilityTimeout: 300, retentionPeriod: 1, delaySeconds: 0 },
  { id: "q-6", name: "payment-reconciliation", type: "FIFO", depth: 12, inFlight: 2, consumers: 2, throughput: 1.5, status: "active", visibilityTimeout: 120, retentionPeriod: 30, delaySeconds: 0 },
  { id: "q-7", name: "analytics-events-bulk", type: "Standard", depth: 45200, inFlight: 1000, consumers: 50, throughput: 1250.0, status: "draining", visibilityTimeout: 60, retentionPeriod: 3, delaySeconds: 0 },
  { id: "q-8", name: "audit-logs-archival", type: "Standard", depth: 150, inFlight: 5, consumers: 1, throughput: 5.0, status: "active", visibilityTimeout: 30, retentionPeriod: 365, delaySeconds: 0 },
];

const MOCK_MESSAGES: Message[] = Array.from({ length: 15 }).map((_, i) => ({
  id: `msg-${1000 + i}`,
  queueId: i < 8 ? `q-${i + 1}` : "q-1",
  timestamp: new Date(Date.now() - i * 1000 * 60).toISOString(),
  size: `${(Math.random() * 10).toFixed(2)} KB`,
  contentType: i % 3 === 0 ? "application/json" : "text/plain",
  deliveryCount: Math.floor(Math.random() * 3),
  payload: {
    order_id: `ORD-${5000 + i}`,
    customer: "John Doe",
    items: [{ id: "p-1", qty: 2 }, { id: "p-5", qty: 1 }],
    metadata: { source: "web-storefront", version: "2.1.0" }
  }
}));

const MOCK_DLQ: DeadLetterMessage[] = [
  { id: "msg-err-1", queueId: "dlq", originalQueue: "orders-processing", timestamp: "2024-02-20T10:30:00Z", size: "1.2 KB", contentType: "application/json", deliveryCount: 5, failureReason: "Database timeout after 3 retries", firstFailure: "2024-02-20T10:25:00Z", lastFailure: "2024-02-20T10:30:00Z", retryCount: 5, payload: { error: "ETIMEDOUT", target: "db-primary" } },
  { id: "msg-err-2", queueId: "dlq", originalQueue: "email-notifications", timestamp: "2024-02-21T14:15:00Z", size: "0.8 KB", contentType: "text/plain", deliveryCount: 3, failureReason: "Invalid email recipient format", firstFailure: "2024-02-21T14:10:00Z", lastFailure: "2024-02-21T14:15:00Z", retryCount: 3, payload: "Recipient: invalid-email-addr" },
  { id: "msg-err-3", queueId: "dlq", originalQueue: "orders-processing", timestamp: "2024-02-21T16:45:00Z", size: "2.5 KB", contentType: "application/json", deliveryCount: 5, failureReason: "Constraint violation: negative quantity", firstFailure: "2024-02-21T16:40:00Z", lastFailure: "2024-02-21T16:45:00Z", retryCount: 5, payload: { order_id: "ORD-999", qty: -1 } },
  { id: "msg-err-4", queueId: "dlq", originalQueue: "payment-reconciliation", timestamp: "2024-02-22T08:00:00Z", size: "1.5 KB", contentType: "application/json", deliveryCount: 5, failureReason: "Upstream API 502 Bad Gateway", firstFailure: "2024-02-22T07:50:00Z", lastFailure: "2024-02-22T08:00:00Z", retryCount: 5, payload: { tx_id: "tx_abc123", amount: 150.00 } },
  { id: "msg-err-5", queueId: "dlq", originalQueue: "inventory-updates", timestamp: "2024-02-22T09:30:00Z", size: "3.2 KB", contentType: "application/json", deliveryCount: 5, failureReason: "Lock wait timeout exceeded", firstFailure: "2024-02-22T09:20:00Z", lastFailure: "2024-02-22T09:30:00Z", retryCount: 5, payload: { sku: "SKU-PRO-MAX", delta: -5 } },
];

// --- Sub-components ---

const Badge = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", className)}>
    {children}
  </span>
);

const IconButton = ({ children, onClick, title, className, disabled }: { children: React.ReactNode, onClick?: () => void, title?: string, className?: string, disabled?: boolean }) => (
  <button 
    onClick={onClick} 
    title={title}
    disabled={disabled}
    className={cn("p-1.5 rounded-md transition-colors hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed", className)}
  >
    {children}
  </button>
);

const ProgressBar = ({ value, max, colorClass = "bg-indigo-500" }: { value: number, max: number, colorClass?: string }) => {
  const percentage = Math.min(Math.round((value / max) * 100), 100);
  return (
    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
      <div 
        className={cn("h-full transition-all duration-500", colorClass)} 
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

// --- Main Component ---

export default function MessageQueueManager() {
  const [activeTab, setActiveTab] = useState<"queues" | "messages" | "dlq" | "settings">("queues");
  const [expandedQueueId, setExpandedQueueId] = useState<string | null>(null);
  const [selectedQueueId, setSelectedQueueId] = useState<string>("q-1");
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(MOCK_MESSAGES[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  // Filtered lists
  const filteredMessages = MOCK_MESSAGES.filter(m => 
    m.queueId === selectedQueueId && 
    (filterType === "all" || m.contentType === filterType) &&
    (searchTerm === "" || m.id.includes(searchTerm) || JSON.stringify(m.payload).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusEmoji = (status: QueueStatus) => {
    switch (status) {
      case "active": return "🟢";
      case "paused": return "🟡";
      case "draining": return "🟠";
      default: return "⚪";
    }
  };

  const renderTabButton = (id: typeof activeTab, label: string) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        aria-selected={isActive}
        role="tab"
        className={cn(
          "px-4 py-3 text-sm font-medium transition-all border-b-2 outline-none",
          isActive 
            ? "text-indigo-400 border-indigo-500 bg-indigo-500/5" 
            : "text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-zinc-800/50"
        )}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 font-sans">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Message Queue Manager</h1>
          <p className="text-zinc-500 text-sm mt-1">Monitor and control your message distribution infrastructure</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-4 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
              <span className="text-zinc-400">Nodes:</span>
              <span className="font-mono font-bold">5/5 Online</span>
            </div>
            <div className="w-px h-4 bg-zinc-800"></div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400">Total Throughput:</span>
              <span className="font-mono font-bold text-indigo-400">1.8k msg/s</span>
            </div>
          </div>
          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-900/20">
            + Create Queue
          </button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav className="flex border-b border-zinc-800 mb-6" role="tablist">
        {renderTabButton("queues", "Queues")}
        {renderTabButton("messages", "Messages")}
        {renderTabButton("dlq", "Dead Letter")}
        {renderTabButton("settings", "Settings")}
      </nav>

      {/* Tab Content */}
      <main className="min-h-[600px]">
        {activeTab === "queues" && (
          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
              <div className="col-span-3">Queue Name</div>
              <div className="col-span-1">Type</div>
              <div className="col-span-2 text-right">Depth / In-Flight</div>
              <div className="col-span-1 text-right">Consumers</div>
              <div className="col-span-2 text-right">Throughput</div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-1"></div>
            </div>

            {MOCK_QUEUES.map((queue) => (
              <div 
                key={queue.id} 
                className={cn(
                  "bg-zinc-900 border rounded-xl overflow-hidden transition-all",
                  expandedQueueId === queue.id ? "border-zinc-700 ring-1 ring-zinc-800 shadow-xl" : "border-zinc-800 hover:border-zinc-700"
                )}
              >
                <div 
                  className="grid grid-cols-12 gap-4 items-center p-4 cursor-pointer select-none"
                  onClick={() => setExpandedQueueId(expandedQueueId === queue.id ? null : queue.id)}
                >
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-mono text-indigo-400">
                      {queue.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-zinc-200">{queue.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">ID: {queue.id}</div>
                    </div>
                  </div>
                  <div className="col-span-1">
                    <Badge className={queue.type === "FIFO" ? "bg-amber-900/30 text-amber-400 border border-amber-800/50" : "bg-blue-900/30 text-blue-400 border border-blue-800/50"}>
                      {queue.type}
                    </Badge>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-zinc-300">{queue.depth.toLocaleString()}</span>
                      <span className="text-zinc-500">/ {queue.inFlight}</span>
                    </div>
                    <ProgressBar value={queue.depth} max={10000} colorClass={queue.depth > 5000 ? "bg-rose-500" : "bg-indigo-500"} />
                  </div>
                  <div className="col-span-1 text-right font-mono text-sm text-zinc-300">
                    {queue.consumers}
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="text-sm font-mono text-emerald-400">{queue.throughput.toFixed(1)}</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-tighter">msg/sec</div>
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold border capitalize",
                      queue.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      queue.status === "paused" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    )}>
                      <span>{getStatusEmoji(queue.status)}</span>
                      {queue.status}
                    </div>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className={cn("inline-block transition-transform duration-200", expandedQueueId === queue.id ? "rotate-180" : "")}>
                      🔽
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedQueueId === queue.id && (
                  <div className="bg-zinc-950/50 border-t border-zinc-800 p-6 grid grid-cols-4 gap-8">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Queue Configuration</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-zinc-400">Visibility Timeout</span>
                          <span className="font-mono text-indigo-400">{queue.visibilityTimeout}s</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-zinc-400">Message Retention</span>
                          <span className="font-mono text-indigo-400">{queue.retentionPeriod} days</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-zinc-400">Delay Seconds</span>
                          <span className="font-mono text-indigo-400">{queue.delaySeconds}s</span>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 space-y-4 border-x border-zinc-800 px-8">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Live Metrics (60s)</h4>
                      <div className="flex items-end gap-1 h-24">
                        {[40, 65, 30, 85, 45, 90, 20, 55, 75, 60, 40, 35, 80, 95, 50, 60, 70, 45, 30, 55].map((h, i) => (
                          <div 
                            key={i} 
                            className="flex-1 bg-indigo-500/30 border-t-2 border-indigo-400 hover:bg-indigo-400 transition-all rounded-t-sm" 
                            style={{ height: `${h}%` }}
                            title={`Time ${i}: ${h} msg/s`}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                        <span>-60s</span>
                        <span>Now</span>
                      </div>
                    </div>
                    <div className="flex flex-col justify-center gap-3">
                      <button className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold rounded-lg transition-colors border border-zinc-700">
                        {queue.status === "active" ? "⏸ Pause Queue" : "▶️ Resume Queue"}
                      </button>
                      <button className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold rounded-lg transition-colors border border-zinc-700">
                        🔄 Purge Messages
                      </button>
                      <button className="w-full py-2 bg-rose-900/20 hover:bg-rose-900/40 text-rose-400 text-xs font-bold rounded-lg transition-colors border border-rose-900/30">
                        🗑 Delete Queue
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "messages" && (
          <div className="grid grid-cols-12 gap-6 h-[700px]">
            {/* Sidebar List */}
            <div className="col-span-7 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-zinc-800 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="text-sm font-bold flex items-center gap-2">
                    📦 Message Browser
                    <select 
                      value={selectedQueueId} 
                      onChange={(e) => setSelectedQueueId(e.target.value)}
                      className="ml-2 bg-zinc-800 border-none text-xs rounded px-2 py-1 outline-none text-indigo-400 font-mono"
                    >
                      {MOCK_QUEUES.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                    </select>
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                    {filteredMessages.length} Messages Found
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      type="text" 
                      placeholder="Search message ID or content..." 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 transition-colors"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <select 
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    <option value="application/json">JSON</option>
                    <option value="text/plain">Plain Text</option>
                  </select>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-3">Message ID</th>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3 text-right">Size</th>
                      <th className="px-4 py-3 text-center">Retries</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {filteredMessages.map((msg) => (
                      <tr 
                        key={msg.id}
                        onClick={() => setSelectedMessage(msg)}
                        className={cn(
                          "group cursor-pointer transition-colors",
                          selectedMessage?.id === msg.id ? "bg-indigo-500/10" : "hover:bg-zinc-800/40"
                        )}
                      >
                        <td className="px-4 py-4">
                          <div className="text-xs font-mono font-bold text-zinc-300 group-hover:text-indigo-400">
                            {msg.id}
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-1">{msg.contentType}</div>
                        </td>
                        <td className="px-4 py-4 text-xs text-zinc-400">
                          {new Date(msg.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-4 py-4 text-xs text-zinc-400 font-mono text-right">
                          {msg.size}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={cn(
                            "inline-block w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold",
                            msg.deliveryCount > 0 ? "bg-amber-900/30 text-amber-400" : "bg-zinc-800 text-zinc-500"
                          )}>
                            {msg.deliveryCount}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredMessages.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-20 text-center text-zinc-500">
                          <div className="text-2xl mb-2">🔎</div>
                          <div className="text-sm">No messages found matching criteria</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="col-span-5 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden">
              {selectedMessage ? (
                <>
                  <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                    <div className="font-bold text-sm">Payload Preview</div>
                    <div className="flex gap-2">
                      <IconButton title="Copy Payload">📋</IconButton>
                      <IconButton title="Download">💾</IconButton>
                      <IconButton title="Delete Message" className="text-rose-400 hover:bg-rose-900/20">🗑</IconButton>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
                    <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4 min-h-full">
                      <pre className="text-indigo-300">
                        {JSON.stringify(selectedMessage.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                  <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 text-[10px] space-y-2">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Message ID</span>
                      <span className="text-zinc-300 font-mono">{selectedMessage.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Created At</span>
                      <span className="text-zinc-300 font-mono">{selectedMessage.timestamp}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Content-Type</span>
                      <span className="text-zinc-300 font-mono">{selectedMessage.contentType}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                  <div className="text-4xl mb-4">👈</div>
                  <p>Select a message to view its payload</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "dlq" && (
          <div className="space-y-6">
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚨</span>
                <div>
                  <div className="font-bold text-rose-400 text-sm">Dead Letter Queue Alert</div>
                  <div className="text-rose-400/70 text-xs">There are {MOCK_DLQ.length} messages currently in the DLQ requiring attention.</div>
                </div>
              </div>
              <div className="flex gap-3">
                <button className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white rounded-lg text-xs font-bold transition-colors">
                  Purge All DLQ
                </button>
                <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold transition-colors border border-zinc-700">
                  Bulk Retry (5)
                </button>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-zinc-950 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                  <tr>
                    <th className="px-6 py-4">Source Queue / ID</th>
                    <th className="px-6 py-4">Failure Reason</th>
                    <th className="px-6 py-4 text-center">Retries</th>
                    <th className="px-6 py-4">Time Window</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {MOCK_DLQ.map((msg) => (
                    <tr key={msg.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-zinc-200">{msg.originalQueue}</div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-1">{msg.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-rose-400 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          {msg.failureReason}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge className="bg-rose-900/30 text-rose-400 border border-rose-800/50">
                          {msg.retryCount}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[10px] text-zinc-400">
                          <div className="flex justify-between"><span>First:</span> <span className="font-mono">{new Date(msg.firstFailure).toLocaleTimeString()}</span></div>
                          <div className="flex justify-between mt-1 text-zinc-500"><span>Last:</span> <span className="font-mono">{new Date(msg.lastFailure).toLocaleTimeString()}</span></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 rounded text-[10px] font-bold uppercase transition-colors">
                            Retry
                          </button>
                          <button className="p-1.5 bg-zinc-800 hover:bg-rose-900/20 text-zinc-400 hover:text-rose-400 rounded transition-colors border border-zinc-700">
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-8 space-y-6">
              <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  ⚙️ Global Queue Configuration
                </h3>
                
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Default Visibility Timeout</label>
                      <div className="flex items-center gap-4">
                        <input type="range" className="flex-1 accent-indigo-500" min="0" max="3600" defaultValue="30" />
                        <span className="text-sm font-mono text-indigo-400 w-12 text-right">30s</span>
                      </div>
                      <p className="text-[10px] text-zinc-600 italic">How long messages remain invisible after being consumed</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Message Retention Period</label>
                      <div className="flex items-center gap-4">
                        <input type="range" className="flex-1 accent-indigo-500" min="1" max="14" defaultValue="4" />
                        <span className="text-sm font-mono text-indigo-400 w-12 text-right">4d</span>
                      </div>
                      <p className="text-[10px] text-zinc-600 italic">Number of days to keep messages in the queue</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Max Batch Size</label>
                      <input 
                        type="number" 
                        defaultValue="10"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" 
                      />
                      <p className="text-[10px] text-zinc-600 italic">Maximum messages received per poll request</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Max Message Size (KB)</label>
                      <input 
                        type="number" 
                        defaultValue="256"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" 
                      />
                      <p className="text-[10px] text-zinc-600 italic">Payload size limit before auto-rejection</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-zinc-800 flex justify-end gap-3">
                  <button className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-bold transition-colors">
                    Discard Changes
                  </button>
                  <button className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-indigo-900/20">
                    Save Configuration
                  </button>
                </div>
              </section>

              <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  🔒 Security & Encryption
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                    <div>
                      <div className="text-sm font-bold">Server-Side Encryption (SSE)</div>
                      <div className="text-xs text-zinc-500">Encrypt message bodies using AES-256-GCM</div>
                    </div>
                    <div className="w-10 h-5 bg-indigo-600 rounded-full relative cursor-pointer">
                      <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                    <div>
                      <div className="text-sm font-bold">KMS Key Management</div>
                      <div className="text-xs text-zinc-500">Use custom AWS/GCP KMS keys for rotation</div>
                    </div>
                    <button className="text-xs font-bold text-indigo-400 hover:underline">Configure Keys</button>
                  </div>
                </div>
              </section>
            </div>

            <div className="col-span-4 space-y-6">
              <section className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-6">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  ℹ️ System Health Status
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">Memory Usage</span>
                      <span className="font-mono text-zinc-300">4.2 GB / 16 GB</span>
                    </div>
                    <ProgressBar value={4.2} max={16} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">CPU Load (Avg)</span>
                      <span className="font-mono text-zinc-300">28%</span>
                    </div>
                    <ProgressBar value={28} max={100} colorClass="bg-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-400">Disk I/O</span>
                      <span className="font-mono text-zinc-300">125 MB/s</span>
                    </div>
                    <ProgressBar value={65} max={100} colorClass="bg-amber-400" />
                  </div>
                </div>
              </section>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
                <div className="text-3xl mb-2">📜</div>
                <h4 className="font-bold text-sm mb-1">Audit Logs</h4>
                <p className="text-xs text-zinc-500 mb-4">View configuration history and access logs for compliance</p>
                <button className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-bold transition-colors">
                  Open Audit Viewer
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer / Status Bar */}
      <footer className="mt-12 pt-6 border-t border-zinc-900 flex justify-between items-center text-[10px] text-zinc-600 font-mono">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> API GATEWAY: STABLE</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> REPLICATION: SYNCED</span>
        </div>
        <div>
          v2.4.12-release • Last checked: {new Date().toLocaleTimeString()}
        </div>
      </footer>
    </div>
  );
}
