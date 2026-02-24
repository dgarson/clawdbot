import React, { useState } from "react";
import { cn } from "../lib/utils";

type ChannelType = "public" | "private" | "shared";
type WebhookStatus = "active" | "inactive" | "error";
type BotPermission = "read" | "write" | "admin" | "none";

interface SlackChannel {
  id: string;
  name: string;
  type: ChannelType;
  members: number;
  isMonitored: boolean;
  isBotMember: boolean;
  lastMessage: string;
  purpose: string;
  notifyOnEvents: string[];
}

interface SlackWebhook {
  id: string;
  name: string;
  channel: string;
  url: string;
  status: WebhookStatus;
  lastTriggered: string;
  triggerCount: number;
  events: string[];
}

interface BotConfig {
  scope: string;
  description: string;
  permission: BotPermission;
  required: boolean;
}

const EVENT_TYPES = [
  "agent.started", "agent.completed", "agent.failed",
  "deploy.started", "deploy.completed", "deploy.failed",
  "alert.triggered", "alert.resolved",
  "pr.opened", "pr.merged", "pr.reviewed",
  "incident.created", "incident.resolved",
];

const CHANNELS: SlackChannel[] = [
  { id: "C001", name: "cb-inbox",        type: "public",  members: 14, isMonitored: true,  isBotMember: true,  lastMessage: "1m ago",  purpose: "Agent notifications and task updates", notifyOnEvents: ["agent.completed","agent.failed","deploy.completed"] },
  { id: "C002", name: "cb-activity",     type: "public",  members: 14, isMonitored: true,  isBotMember: true,  lastMessage: "3m ago",  purpose: "PR activity and git events", notifyOnEvents: ["pr.opened","pr.merged"] },
  { id: "C003", name: "alerts",          type: "public",  members: 12, isMonitored: true,  isBotMember: true,  lastMessage: "12m ago", purpose: "System alerts and incident notifications", notifyOnEvents: ["alert.triggered","incident.created"] },
  { id: "C004", name: "releases",        type: "public",  members: 12, isMonitored: false, isBotMember: true,  lastMessage: "1h ago",  purpose: "Deploy and release tracking", notifyOnEvents: ["deploy.started","deploy.completed","deploy.failed"] },
  { id: "C005", name: "dev",             type: "public",  members: 8,  isMonitored: false, isBotMember: false, lastMessage: "5m ago",  purpose: "Engineering discussion", notifyOnEvents: [] },
  { id: "C006", name: "product-ui",      type: "private", members: 6,  isMonitored: false, isBotMember: true,  lastMessage: "8m ago",  purpose: "Product & UI Squad channel", notifyOnEvents: ["pr.reviewed"] },
  { id: "C007", name: "incidents",       type: "public",  members: 14, isMonitored: true,  isBotMember: true,  lastMessage: "2h ago",  purpose: "Active incident coordination", notifyOnEvents: ["incident.created","incident.resolved","alert.triggered"] },
  { id: "C008", name: "xavier-dm",       type: "shared",  members: 2,  isMonitored: false, isBotMember: false, lastMessage: "30m ago", purpose: "Direct messages with Xavier", notifyOnEvents: [] },
];

const WEBHOOKS: SlackWebhook[] = [
  { id: "wh1", name: "Agent Notifications",    channel: "#cb-inbox",    url: "https://hooks.slack.com/services/T01/B01/xxx1", status: "active",   lastTriggered: "1m ago",  triggerCount: 2847, events: ["agent.completed","agent.failed"] },
  { id: "wh2", name: "Deploy Pipeline",        channel: "#releases",    url: "https://hooks.slack.com/services/T01/B02/xxx2", status: "active",   lastTriggered: "1h ago",  triggerCount: 184,  events: ["deploy.started","deploy.completed","deploy.failed"] },
  { id: "wh3", name: "Critical Alerts",        channel: "#alerts",      url: "https://hooks.slack.com/services/T01/B03/xxx3", status: "active",   lastTriggered: "12m ago", triggerCount: 56,   events: ["alert.triggered","incident.created"] },
  { id: "wh4", name: "PR Activity",            channel: "#cb-activity", url: "https://hooks.slack.com/services/T01/B04/xxx4", status: "active",   lastTriggered: "3m ago",  triggerCount: 1243, events: ["pr.opened","pr.merged","pr.reviewed"] },
  { id: "wh5", name: "Legacy Notifications",   channel: "#general",     url: "https://hooks.slack.com/services/T01/B05/xxx5", status: "inactive", lastTriggered: "7d ago",  triggerCount: 89,   events: ["agent.started"] },
  { id: "wh6", name: "Error Escalation",       channel: "#incidents",   url: "https://hooks.slack.com/services/T01/B06/xxx6", status: "error",    lastTriggered: "2d ago",  triggerCount: 12,   events: ["agent.failed","incident.created"] },
];

const BOT_SCOPES: BotConfig[] = [
  { scope: "channels:read",      description: "View basic info about public channels",     permission: "read",  required: true  },
  { scope: "channels:write",     description: "Join, leave, and manage channels",          permission: "write", required: false },
  { scope: "chat:write",         description: "Send messages as the bot",                  permission: "write", required: true  },
  { scope: "chat:write.public",  description: "Send messages to public channels",          permission: "write", required: true  },
  { scope: "files:write",        description: "Upload and modify files",                   permission: "write", required: false },
  { scope: "groups:read",        description: "View basic info about private channels",    permission: "read",  required: false },
  { scope: "im:read",            description: "View basic info about direct messages",     permission: "read",  required: false },
  { scope: "im:write",           description: "Start direct message conversations",        permission: "write", required: false },
  { scope: "reactions:write",    description: "Add and edit emoji reactions",              permission: "write", required: false },
  { scope: "users:read",         description: "View people in the workspace",              permission: "read",  required: true  },
  { scope: "webhooks:incoming",  description: "Post messages with incoming webhooks",      permission: "admin", required: true  },
];

const webhookStatusColor = (s: WebhookStatus) => {
  if (s === "active")   {return "text-emerald-400 bg-emerald-400/10";}
  if (s === "inactive") {return "text-zinc-400 bg-zinc-400/10";}
  return "text-rose-400 bg-rose-400/10";
};

const permColor = (p: BotPermission) => {
  if (p === "admin")  {return "text-rose-400";}
  if (p === "write")  {return "text-amber-400";}
  if (p === "read")   {return "text-emerald-400";}
  return "text-zinc-600";
};

export default function SlackIntegrationManager() {
  const [activeTab, setActiveTab] = useState<"channels" | "webhooks" | "bot" | "logs">("channels");
  const [channels, setChannels] = useState<SlackChannel[]>(CHANNELS);
  const [webhooks, setWebhooks] = useState<SlackWebhook[]>(WEBHOOKS);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | ChannelType>("all");

  const selectedChannel = channels.find(c => c.id === selectedChannelId);
  const selectedWebhook = webhooks.find(w => w.id === selectedWebhookId);

  const filteredChannels = filterType === "all" ? channels : channels.filter(c => c.type === filterType);
  const monitoredCount = channels.filter(c => c.isMonitored).length;
  const botChannels = channels.filter(c => c.isBotMember).length;
  const activeWebhooks = webhooks.filter(w => w.status === "active").length;
  const totalTriggers = webhooks.reduce((s, w) => s + w.triggerCount, 0);

  function toggleMonitor(id: string) {
    setChannels(prev => prev.map(c => c.id === id ? { ...c, isMonitored: !c.isMonitored } : c));
  }

  function toggleWebhookStatus(id: string) {
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, status: w.status === "active" ? "inactive" : "active" } : w));
  }

  function toggleEventNotification(channelId: string, event: string) {
    setChannels(prev => prev.map(c => {
      if (c.id !== channelId) {return c;}
      const has = c.notifyOnEvents.includes(event);
      return { ...c, notifyOnEvents: has ? c.notifyOnEvents.filter(e => e !== event) : [...c.notifyOnEvents, event] };
    }));
  }

  const MOCK_LOGS = [
    { time: "07:14:02", event: "agent.completed", channel: "#cb-inbox",    status: "delivered", payload: '{"agent":"Quinn","task":"AccessControlMatrix","status":"done"}' },
    { time: "07:11:55", event: "pr.reviewed",      channel: "#cb-activity", status: "delivered", payload: '{"pr":247,"author":"Luis","action":"approve"}' },
    { time: "07:08:33", event: "agent.failed",     channel: "#cb-inbox",    status: "delivered", payload: '{"agent":"Reed","task":"ChatRoomView","error":"silent_fail"}' },
    { time: "07:00:12", event: "alert.triggered",  channel: "#alerts",      status: "delivered", payload: '{"level":"warning","msg":"LLM latency elevated"}' },
    { time: "06:50:44", event: "deploy.completed", channel: "#releases",    status: "delivered", payload: '{"env":"staging","views":98,"status":"success"}' },
    { time: "06:48:11", event: "pr.merged",        channel: "#cb-activity", status: "delivered", payload: '{"pr":246,"author":"Luis","title":"views #96-97"}' },
    { time: "05:12:30", event: "agent.failed",     channel: "#incidents",   status: "error",     payload: '{"err":"webhook_timeout","retry":false}' },
  ];

  return (
    <div className="flex h-full bg-zinc-950 flex-col overflow-hidden">
      {/* Header stats */}
      <div className="flex items-center gap-6 px-6 py-3 border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">💬</span>
          <div>
            <div className="text-xs font-semibold text-white">OpenClaw Slack App</div>
            <div className="text-[10px] text-emerald-400">Connected · workspace: openclaw-hq</div>
          </div>
        </div>
        <div className="ml-6 flex items-center gap-6">
          {[
            { label: "Channels Monitored", value: monitoredCount },
            { label: "Bot In",             value: `${botChannels} channels` },
            { label: "Active Webhooks",    value: activeWebhooks },
            { label: "Total Triggers",     value: totalTriggers.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs font-semibold text-white">{value}</div>
              <div className="text-[10px] text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
        {(["channels", "webhooks", "bot", "logs"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-2.5 text-sm font-medium transition-colors border-b-2 capitalize",
              activeTab === tab ? "border-indigo-500 text-indigo-300" : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            {tab === "channels" ? `📢 Channels (${channels.length})` :
             tab === "webhooks" ? `🔗 Webhooks (${webhooks.length})` :
             tab === "bot"      ? "🤖 Bot Scopes" : "📋 Event Logs"}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {activeTab === "channels" && (
          <>
            {/* Channel list */}
            <div className="flex-1 overflow-y-auto">
              {/* Filter */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
                {(["all", "public", "private", "shared"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterType(f)}
                    className={cn(
                      "text-xs px-3 py-1 rounded border transition-colors capitalize",
                      filterType === f ? "bg-indigo-500/20 border-indigo-500 text-indigo-300" : "border-zinc-700 text-zinc-500 hover:text-zinc-300 bg-zinc-800"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider">
                    <th className="text-left px-4 py-2">Channel</th>
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-left px-4 py-2">Members</th>
                    <th className="text-left px-4 py-2">Bot</th>
                    <th className="text-left px-4 py-2">Monitored</th>
                    <th className="text-left px-4 py-2">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filteredChannels.map(ch => (
                    <tr
                      key={ch.id}
                      onClick={() => setSelectedChannelId(selectedChannelId === ch.id ? null : ch.id)}
                      className={cn("cursor-pointer hover:bg-zinc-900 transition-colors", selectedChannelId === ch.id && "bg-indigo-500/5")}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500">{ch.type === "private" ? "🔒" : "#"}</span>
                          <span className="text-sm text-white">{ch.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded capitalize", ch.type === "private" ? "bg-purple-500/10 text-purple-400" : ch.type === "shared" ? "bg-blue-500/10 text-blue-400" : "bg-zinc-800 text-zinc-400")}>
                          {ch.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{ch.members}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs", ch.isBotMember ? "text-emerald-400" : "text-zinc-600")}>
                          {ch.isBotMember ? "✓ Member" : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={e => { e.stopPropagation(); toggleMonitor(ch.id); }}
                          className={cn(
                            "text-[10px] px-2 py-1 rounded border transition-colors",
                            ch.isMonitored ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600"
                          )}
                        >
                          {ch.isMonitored ? "Monitored" : "Off"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{ch.lastMessage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Channel detail */}
            {selectedChannel && (
              <div className="w-72 flex-shrink-0 border-l border-zinc-800 p-4 bg-zinc-900 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-white text-sm">#{selectedChannel.name}</span>
                  <button onClick={() => setSelectedChannelId(null)} className="text-zinc-500 hover:text-white text-xs">✕</button>
                </div>
                <p className="text-xs text-zinc-400 mb-4">{selectedChannel.purpose}</p>

                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Event Notifications</div>
                <div className="space-y-1.5">
                  {EVENT_TYPES.map(ev => (
                    <div key={ev} onClick={() => toggleEventNotification(selectedChannel.id, ev)} className={cn("flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer transition-colors", selectedChannel.notifyOnEvents.includes(ev) ? "bg-indigo-500/10 border-indigo-500/30" : "border-zinc-800 hover:bg-zinc-800")}>
                      <div className={cn("w-3 h-3 rounded border flex items-center justify-center text-[8px]", selectedChannel.notifyOnEvents.includes(ev) ? "bg-indigo-500 border-indigo-500 text-white" : "border-zinc-600")}>
                        {selectedChannel.notifyOnEvents.includes(ev) && "✓"}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400">{ev}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "webhooks" && (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-zinc-800/50">
                {webhooks.map(wh => (
                  <div
                    key={wh.id}
                    onClick={() => setSelectedWebhookId(selectedWebhookId === wh.id ? null : wh.id)}
                    className={cn("p-4 cursor-pointer hover:bg-zinc-900 transition-colors", selectedWebhookId === wh.id && "bg-indigo-500/5")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-semibold text-white">{wh.name}</span>
                          <span className={cn("text-[10px] px-2 py-0.5 rounded font-medium capitalize", webhookStatusColor(wh.status))}>{wh.status}</span>
                        </div>
                        <div className="text-xs text-zinc-500">→ {wh.channel}</div>
                        <div className="flex items-center gap-4 mt-2 text-[10px] text-zinc-500">
                          <span>Last: {wh.lastTriggered}</span>
                          <span>Total: {wh.triggerCount.toLocaleString()} triggers</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {wh.events.map(ev => <span key={ev} className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{ev}</span>)}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); toggleWebhookStatus(wh.id); }}
                        className={cn("text-xs px-3 py-1.5 rounded border transition-colors", wh.status === "active" ? "border-emerald-600 text-emerald-400 hover:bg-emerald-500/10" : "border-zinc-700 text-zinc-500 hover:border-zinc-600")}
                      >
                        {wh.status === "active" ? "Pause" : "Enable"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "bot" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl">
              <p className="text-xs text-zinc-400 mb-4">OAuth scopes granted to the ClawdBot Slack app</p>
              <div className="bg-zinc-900 rounded border border-zinc-800 divide-y divide-zinc-800">
                {BOT_SCOPES.map(sc => (
                  <div key={sc.scope} className="flex items-center gap-4 px-4 py-3">
                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0", sc.required ? "bg-indigo-500" : "bg-zinc-600")} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-white">{sc.scope}</code>
                        {sc.required && <span className="text-[9px] text-indigo-400 border border-indigo-400/30 px-1 rounded">required</span>}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{sc.description}</div>
                    </div>
                    <span className={cn("text-[10px] font-medium uppercase tracking-wider", permColor(sc.permission))}>
                      {sc.permission}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider sticky top-0 bg-zinc-950">
                  <th className="text-left px-4 py-2">Time</th>
                  <th className="text-left px-4 py-2">Event</th>
                  <th className="text-left px-4 py-2">Channel</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {MOCK_LOGS.map((log, i) => (
                  <tr key={i} className="hover:bg-zinc-900 transition-colors">
                    <td className="px-4 py-2 font-mono text-zinc-500">{log.time}</td>
                    <td className="px-4 py-2 font-mono text-indigo-300">{log.event}</td>
                    <td className="px-4 py-2 text-zinc-400">{log.channel}</td>
                    <td className="px-4 py-2">
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px]", log.status === "delivered" ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400")}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px] text-zinc-600 max-w-xs truncate">{log.payload}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
