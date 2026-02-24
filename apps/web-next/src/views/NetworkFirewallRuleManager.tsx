import React, { useState } from "react";
import { cn } from "../lib/utils";

type Direction = "inbound" | "outbound";
type Protocol = "TCP" | "UDP" | "ICMP" | "ALL";
type RuleAction = "allow" | "deny" | "log";
type RuleStatus = "active" | "disabled" | "review";

interface FirewallRule {
  id: string;
  name: string;
  direction: Direction;
  protocol: Protocol;
  action: RuleAction;
  status: RuleStatus;
  priority: number;
  sourceIp: string;
  destIp: string;
  portRange: string;
  description: string;
  hitCount: number;
  lastHit: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
}

interface SecurityGroup {
  id: string;
  name: string;
  vpc: string;
  region: string;
  ruleCount: number;
  attachedResources: number;
  status: "active" | "unused";
  lastModified: string;
}

interface FirewallPolicy {
  id: string;
  name: string;
  description: string;
  ruleCount: number;
  appliedTo: string[];
  defaultAction: RuleAction;
  lastUpdated: string;
}

interface AuditEvent {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  before: string;
  after: string;
  ip: string;
}

const RULES: FirewallRule[] = [
  { id: "r1", name: "Allow HTTPS Inbound", direction: "inbound", protocol: "TCP", action: "allow", status: "active", priority: 100, sourceIp: "0.0.0.0/0", destIp: "10.0.1.0/24", portRange: "443", description: "Allow all HTTPS traffic to web tier", hitCount: 1247893, lastHit: "2s ago", tags: ["web", "public"], createdBy: "ops-team", createdAt: "2024-01-15" },
  { id: "r2", name: "Allow HTTP Inbound", direction: "inbound", protocol: "TCP", action: "allow", status: "active", priority: 110, sourceIp: "0.0.0.0/0", destIp: "10.0.1.0/24", portRange: "80", description: "Allow HTTP for redirect", hitCount: 438291, lastHit: "5s ago", tags: ["web", "public"], createdBy: "ops-team", createdAt: "2024-01-15" },
  { id: "r3", name: "Block Tor Exit Nodes", direction: "inbound", protocol: "TCP", action: "deny", status: "active", priority: 50, sourceIp: "tor-list", destIp: "0.0.0.0/0", portRange: "ANY", description: "Block known Tor exit node IPs", hitCount: 2841, lastHit: "3m ago", tags: ["security", "threat"], createdBy: "security", createdAt: "2024-02-03" },
  { id: "r4", name: "Allow DB from App Tier", direction: "inbound", protocol: "TCP", action: "allow", status: "active", priority: 200, sourceIp: "10.0.1.0/24", destIp: "10.0.2.0/24", portRange: "5432", description: "App tier to Postgres", hitCount: 8293847, lastHit: "1s ago", tags: ["db", "internal"], createdBy: "infra", createdAt: "2024-01-20" },
  { id: "r5", name: "SSH Admin Access", direction: "inbound", protocol: "TCP", action: "allow", status: "review", priority: 300, sourceIp: "192.168.100.0/24", destIp: "10.0.0.0/8", portRange: "22", description: "SSH from VPN range — under review for scope reduction", hitCount: 12039, lastHit: "1h ago", tags: ["ssh", "admin"], createdBy: "sysadmin", createdAt: "2023-11-10" },
  { id: "r6", name: "Allow Outbound HTTPS", direction: "outbound", protocol: "TCP", action: "allow", status: "active", priority: 100, sourceIp: "10.0.0.0/8", destIp: "0.0.0.0/0", portRange: "443", description: "Allow all internal hosts to reach external HTTPS", hitCount: 3921048, lastHit: "1s ago", tags: ["egress", "public"], createdBy: "ops-team", createdAt: "2024-01-15" },
  { id: "r7", name: "Block Outbound SMB", direction: "outbound", protocol: "TCP", action: "deny", status: "active", priority: 60, sourceIp: "0.0.0.0/0", destIp: "0.0.0.0/0", portRange: "445,139", description: "Block SMB exfiltration paths", hitCount: 47, lastHit: "2d ago", tags: ["security", "exfiltration"], createdBy: "security", createdAt: "2024-03-01" },
  { id: "r8", name: "Log All DNS", direction: "outbound", protocol: "UDP", action: "log", status: "active", priority: 400, sourceIp: "0.0.0.0/0", destIp: "0.0.0.0/0", portRange: "53", description: "Passive DNS logging for threat intel", hitCount: 9182736, lastHit: "1s ago", tags: ["dns", "logging"], createdBy: "security", createdAt: "2024-02-14" },
  { id: "r9", name: "Deny ICMP External", direction: "inbound", protocol: "ICMP", action: "deny", status: "disabled", priority: 150, sourceIp: "0.0.0.0/0", destIp: "10.0.0.0/8", portRange: "ANY", description: "Disabled — needed for health checks", hitCount: 0, lastHit: "never", tags: ["icmp"], createdBy: "ops-team", createdAt: "2024-04-10" },
  { id: "r10", name: "Allow Internal All", direction: "inbound", protocol: "ALL", action: "allow", status: "active", priority: 500, sourceIp: "10.0.0.0/8", destIp: "10.0.0.0/8", portRange: "ANY", description: "Unrestricted internal east-west traffic", hitCount: 29384712, lastHit: "1s ago", tags: ["internal"], createdBy: "infra", createdAt: "2023-10-01" },
];

const SECURITY_GROUPS: SecurityGroup[] = [
  { id: "sg1", name: "web-tier-sg", vpc: "vpc-prod-us-east", region: "us-east-1", ruleCount: 8, attachedResources: 12, status: "active", lastModified: "2h ago" },
  { id: "sg2", name: "app-tier-sg", vpc: "vpc-prod-us-east", region: "us-east-1", ruleCount: 14, attachedResources: 24, status: "active", lastModified: "1d ago" },
  { id: "sg3", name: "db-tier-sg", vpc: "vpc-prod-us-east", region: "us-east-1", ruleCount: 4, attachedResources: 6, status: "active", lastModified: "3d ago" },
  { id: "sg4", name: "bastion-sg", vpc: "vpc-mgmt", region: "us-east-1", ruleCount: 3, attachedResources: 2, status: "active", lastModified: "1w ago" },
  { id: "sg5", name: "legacy-app-sg", vpc: "vpc-prod-us-west", region: "us-west-2", ruleCount: 22, attachedResources: 0, status: "unused", lastModified: "2mo ago" },
];

const POLICIES: FirewallPolicy[] = [
  { id: "pol1", name: "Production Default", description: "Baseline production firewall policy — deny all, explicit allow", ruleCount: 34, appliedTo: ["web-tier-sg", "app-tier-sg", "db-tier-sg"], defaultAction: "deny", lastUpdated: "3d ago" },
  { id: "pol2", name: "Management Network", description: "Admin and ops tooling access policy", ruleCount: 12, appliedTo: ["bastion-sg"], defaultAction: "deny", lastUpdated: "1w ago" },
  { id: "pol3", name: "Dev Environment", description: "Permissive policy for dev/test environments", ruleCount: 8, appliedTo: ["dev-sg", "staging-sg"], defaultAction: "allow", lastUpdated: "2d ago" },
];

const AUDIT_EVENTS: AuditEvent[] = [
  { id: "a1", timestamp: "10:42:31", user: "alice@company.com", action: "RULE_MODIFIED", resource: "r5 / SSH Admin Access", before: "priority: 200", after: "priority: 300, status: review", ip: "192.168.1.45" },
  { id: "a2", timestamp: "09:15:02", user: "bob@company.com", action: "RULE_CREATED", resource: "r10 / Allow Internal All", before: "-", after: "sourceIp: 10.0.0.0/8, action: allow", ip: "192.168.1.87" },
  { id: "a3", timestamp: "08:53:18", user: "carol@company.com", action: "RULE_DISABLED", resource: "r9 / Deny ICMP External", before: "status: active", after: "status: disabled", ip: "192.168.1.12" },
  { id: "a4", timestamp: "Yesterday 17:22", user: "dave@company.com", action: "POLICY_APPLIED", resource: "pol3 / Dev Environment → staging-sg", before: "-", after: "attached", ip: "192.168.1.99" },
  { id: "a5", timestamp: "Yesterday 14:07", user: "security-bot", action: "RULE_CREATED", resource: "r3 / Block Tor Exit Nodes", before: "-", after: "auto-generated from threat feed", ip: "127.0.0.1" },
];

const actionColor: Record<RuleAction, string> = {
  allow: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400",
  deny:  "bg-rose-500/15 border-rose-500/40 text-rose-400",
  log:   "bg-sky-500/15 border-sky-500/40 text-sky-400",
};

const statusDot: Record<RuleStatus, string> = {
  active:   "bg-emerald-400",
  disabled: "bg-[var(--color-surface-3)]",
  review:   "bg-amber-400",
};

const directionBadge: Record<Direction, string> = {
  inbound:  "bg-indigo-500/15 border-indigo-500/30 text-indigo-400",
  outbound: "bg-purple-500/15 border-purple-500/30 text-purple-400",
};

function formatHits(n: number): string {
  if (n >= 1_000_000) {return `${(n / 1_000_000).toFixed(1)}M`;}
  if (n >= 1_000) {return `${(n / 1_000).toFixed(1)}K`;}
  return String(n);
}

export default function NetworkFirewallRuleManager() {
  const [tab, setTab] = useState<"rules" | "groups" | "policies" | "audit">("rules");
  const [selected, setSelected] = useState<FirewallRule | null>(RULES[0]);
  const [dirFilter, setDirFilter] = useState<"all" | Direction>("all");
  const [actionFilter, setActionFilter] = useState<"all" | RuleAction>("all");

  const filteredRules = RULES.filter(r =>
    (dirFilter === "all" || r.direction === dirFilter) &&
    (actionFilter === "all" || r.action === actionFilter)
  ).toSorted((a, b) => a.priority - b.priority);

  const inboundRules = RULES.filter(r => r.direction === "inbound");
  const outboundRules = RULES.filter(r => r.direction === "outbound");
  const denyRules = RULES.filter(r => r.action === "deny");
  const reviewRules = RULES.filter(r => r.status === "review");

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Firewall Rule Manager</h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Network access control — {RULES.length} rules across {SECURITY_GROUPS.length} security groups</p>
          </div>
          <div className="flex items-center gap-3">
            {reviewRules.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs text-amber-400">{reviewRules.length} rules need review</span>
              </div>
            )}
            <button className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium transition-colors">+ New Rule</button>
          </div>
        </div>
        {/* Stats */}
        <div className="flex gap-4 mt-3">
          {[
            { label: "Inbound Rules", value: inboundRules.length, color: "text-indigo-400" },
            { label: "Outbound Rules", value: outboundRules.length, color: "text-purple-400" },
            { label: "Deny Rules", value: denyRules.length, color: "text-rose-400" },
            { label: "Total Hits Today", value: formatHits(RULES.reduce((s, r) => s + r.hitCount, 0)), color: "text-emerald-400" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className={cn("text-base font-bold", s.color)}>{s.value}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{s.label}</div>
            </div>
          ))}
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {(["rules", "groups", "policies", "audit"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                tab === t ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]")}>
              {t === "groups" ? "Security Groups" : t === "audit" ? "Audit Log" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {/* Rules Tab */}
        {tab === "rules" && (
          <div className="flex h-full">
            {/* Left: Rules list */}
            <div className="w-[52%] flex-none border-r border-[var(--color-border)] flex flex-col">
              {/* Filters */}
              <div className="flex-none px-4 py-2.5 border-b border-[var(--color-border)] flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted)]">Direction:</span>
                {(["all", "inbound", "outbound"] as const).map(d => (
                  <button key={d} onClick={() => setDirFilter(d)}
                    className={cn("px-2 py-0.5 rounded text-xs capitalize transition-colors",
                      dirFilter === d ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]")}>
                    {d}
                  </button>
                ))}
                <span className="text-[var(--color-text-muted)]">|</span>
                <span className="text-xs text-[var(--color-text-muted)]">Action:</span>
                {(["all", "allow", "deny", "log"] as const).map(a => (
                  <button key={a} onClick={() => setActionFilter(a)}
                    className={cn("px-2 py-0.5 rounded text-xs capitalize transition-colors",
                      actionFilter === a ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]")}>
                    {a}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredRules.map(rule => (
                  <button key={rule.id} onClick={() => setSelected(rule)} className={cn(
                    "w-full text-left px-4 py-3 border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-1)] transition-colors",
                    selected?.id === rule.id && "bg-[var(--color-surface-1)] border-l-2 border-l-indigo-500"
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn("w-1.5 h-1.5 rounded-full flex-none mt-0.5", statusDot[rule.status])} />
                        <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{rule.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-none">
                        <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium", actionColor[rule.action])}>
                          {rule.action.toUpperCase()}
                        </span>
                        <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium", directionBadge[rule.direction])}>
                          {rule.direction === "inbound" ? "↓ IN" : "↑ OUT"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 pl-3.5">
                      <span className="text-[11px] text-[var(--color-text-muted)] font-mono">{rule.sourceIp} → {rule.destIp}:{rule.portRange}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 pl-3.5">
                      <span className="text-[10px] text-[var(--color-text-muted)]">Priority {rule.priority}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">·</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">{formatHits(rule.hitCount)} hits</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">·</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">Last hit {rule.lastHit}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {/* Right: Rule detail */}
            <div className="flex-1 overflow-y-auto p-5">
              {selected ? (
                <div className="space-y-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", statusDot[selected.status])} />
                        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{selected.name}</h2>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">{selected.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-2.5 py-1 rounded text-xs bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] transition-colors">Edit</button>
                      {selected.status === "active"
                        ? <button className="px-2.5 py-1 rounded text-xs bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition-colors">Disable</button>
                        : <button className="px-2.5 py-1 rounded text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition-colors">Enable</button>
                      }
                    </div>
                  </div>
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    <span className={cn("px-2 py-1 rounded border text-xs font-medium", actionColor[selected.action])}>{selected.action.toUpperCase()}</span>
                    <span className={cn("px-2 py-1 rounded border text-xs font-medium", directionBadge[selected.direction])}>{selected.direction}</span>
                    <span className="px-2 py-1 rounded border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">{selected.protocol}</span>
                    <span className="px-2 py-1 rounded border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">Priority {selected.priority}</span>
                    {selected.status === "review" && (
                      <span className="px-2 py-1 rounded border border-amber-500/40 text-xs text-amber-400 bg-amber-500/10">⚠ Under Review</span>
                    )}
                  </div>
                  {/* Routing */}
                  <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
                    <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-3">Traffic Pattern</div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-[var(--color-surface-2)] rounded-lg p-3 text-center">
                        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Source</div>
                        <div className="font-mono text-xs text-[var(--color-text-primary)]">{selected.sourceIp}</div>
                      </div>
                      <div className="text-center">
                        <div className={cn("text-lg", selected.action === "deny" ? "text-rose-400" : selected.action === "log" ? "text-sky-400" : "text-emerald-400")}>
                          {selected.action === "deny" ? "✕" : "→"}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">{selected.protocol}</div>
                      </div>
                      <div className="flex-1 bg-[var(--color-surface-2)] rounded-lg p-3 text-center">
                        <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Destination</div>
                        <div className="font-mono text-xs text-[var(--color-text-primary)]">{selected.destIp}:{selected.portRange}</div>
                      </div>
                    </div>
                  </div>
                  {/* Hit rate */}
                  <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
                    <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-3">Activity</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-[var(--color-text-muted)]">Total Hits</div>
                        <div className="text-xl font-bold text-[var(--color-text-primary)] mt-0.5">{formatHits(selected.hitCount)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--color-text-muted)]">Last Hit</div>
                        <div className="text-sm font-medium text-[var(--color-text-primary)] mt-0.5">{selected.lastHit}</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="text-[10px] text-[var(--color-text-muted)] mb-1">Relative traffic volume</div>
                      <div className="w-full bg-[var(--color-surface-2)] rounded-full h-1.5">
                        <div
                          className={cn("h-1.5 rounded-full", selected.action === "deny" ? "bg-rose-500" : selected.action === "log" ? "bg-sky-500" : "bg-emerald-500")}
                          style={{ width: `${Math.min(100, (selected.hitCount / 30000000) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Tags & metadata */}
                  <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
                    <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-3">Metadata</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-[var(--color-text-muted)]">Created by: </span><span className="text-[var(--color-text-primary)]">{selected.createdBy}</span></div>
                      <div><span className="text-[var(--color-text-muted)]">Created: </span><span className="text-[var(--color-text-primary)]">{selected.createdAt}</span></div>
                      <div><span className="text-[var(--color-text-muted)]">Rule ID: </span><span className="font-mono text-[var(--color-text-primary)]">{selected.id}</span></div>
                      <div><span className="text-[var(--color-text-muted)]">Status: </span><span className="text-[var(--color-text-primary)] capitalize">{selected.status}</span></div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {selected.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-xs text-[var(--color-text-secondary)]">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">Select a rule</div>
              )}
            </div>
          </div>
        )}

        {/* Security Groups Tab */}
        {tab === "groups" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-3">
              {SECURITY_GROUPS.map(sg => (
                <div key={sg.id} className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)] hover:border-[var(--color-border)] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-2 h-2 rounded-full", sg.status === "active" ? "bg-emerald-400" : "bg-[var(--color-surface-3)]")} />
                      <div>
                        <div className="font-medium text-[var(--color-text-primary)] text-sm">{sg.name}</div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{sg.vpc} · {sg.region}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">{sg.ruleCount}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">rules</div>
                      </div>
                      <div>
                        <div className={cn("text-sm font-semibold", sg.attachedResources === 0 ? "text-amber-400" : "text-[var(--color-text-primary)]")}>{sg.attachedResources}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">attached</div>
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">modified {sg.lastModified}</div>
                      {sg.status === "unused" && (
                        <span className="px-2 py-0.5 rounded border border-amber-500/40 text-[10px] text-amber-400 bg-amber-500/10">Unused</span>
                      )}
                    </div>
                  </div>
                  {/* Rule breakdown bar */}
                  <div className="mt-3 flex gap-1 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500" style={{ width: "60%" }} />
                    <div className="bg-rose-500" style={{ width: "25%" }} />
                    <div className="bg-sky-500" style={{ width: "15%" }} />
                  </div>
                  <div className="flex gap-4 mt-1.5 text-[10px] text-[var(--color-text-muted)]">
                    <span><span className="text-emerald-400">■</span> Allow</span>
                    <span><span className="text-rose-400">■</span> Deny</span>
                    <span><span className="text-sky-400">■</span> Log</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Policies Tab */}
        {tab === "policies" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-4">
              {POLICIES.map(pol => (
                <div key={pol.id} className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-[var(--color-text-primary)]">{pol.name}</h3>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">{pol.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("px-2 py-1 rounded border text-xs font-medium", actionColor[pol.defaultAction])}>
                        Default: {pol.defaultAction.toUpperCase()}
                      </span>
                      <button className="px-2.5 py-1 rounded text-xs bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] transition-colors">Edit</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-4">
                    <div className="flex-none">
                      <div className="text-xl font-bold text-[var(--color-text-primary)]">{pol.ruleCount}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">rules</div>
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] text-[var(--color-text-muted)] mb-1.5">Applied to</div>
                      <div className="flex flex-wrap gap-1.5">
                        {pol.appliedTo.map(sg => (
                          <span key={sg} className="px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-xs font-mono text-[var(--color-text-primary)]">{sg}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)] flex-none">Updated {pol.lastUpdated}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Tab */}
        {tab === "audit" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-2">
              {AUDIT_EVENTS.map(ev => (
                <div key={ev.id} className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)] hover:border-[var(--color-border)] transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{ev.timestamp}</span>
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium",
                          ev.action.includes("CREATED") ? "bg-emerald-500/15 text-emerald-400" :
                          ev.action.includes("DISABLED") ? "bg-amber-500/15 text-amber-400" :
                          ev.action.includes("MODIFIED") ? "bg-sky-500/15 text-sky-400" :
                          "bg-indigo-500/15 text-indigo-400"
                        )}>{ev.action}</span>
                        <span className="text-xs text-[var(--color-text-primary)] font-medium truncate">{ev.resource}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-[11px]">
                        <span className="text-[var(--color-text-muted)]">by <span className="text-[var(--color-text-primary)]">{ev.user}</span></span>
                        <span className="text-[var(--color-text-muted)]">from <span className="font-mono text-[var(--color-text-secondary)]">{ev.ip}</span></span>
                      </div>
                      {ev.before !== "-" && (
                        <div className="flex items-center gap-2 mt-2 text-[10px] font-mono">
                          <span className="text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">- {ev.before}</span>
                          <span className="text-[var(--color-text-muted)]">→</span>
                          <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">+ {ev.after}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
