import React, { useState } from "react";
import { cn } from "../lib/utils";
import {
  Bot,
  Tool,
  Brain,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Users,
  Key,
  Terminal,
  Globe,
  MessageSquare,
  HardDrive,
  Activity,
  Zap,
  Eye,
  Cpu,
  Settings,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Layers,
  Workflow,
  Timer,
  Gauge,
  Package,
} from "lucide-react";

type AgentStatus = "active" | "idle" | "degraded" | "offline";
type ToolStatus = "enabled" | "disabled" | "degraded" | "unavailable";
type PermissionLevel = "none" | "read" | "write" | "admin";
type SkillLevel = "none" | "basic" | "advanced" | "expert";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  model: string;
  toolsEnabled: number;
  skillsLoaded: number;
  permissions: PermissionLevel[];
  lastActive: string;
  uptime: string;
  healthScore: number;
}

interface Tool {
  id: string;
  name: string;
  category: string;
  description: string;
}

interface ToolCapability {
  toolId: string;
  status: ToolStatus;
  lastUsed?: string;
  errorCount?: number;
}

interface Skill {
  id: string;
  name: string;
  category: string;
  level: SkillLevel;
}

interface PermissionGrant {
  id: string;
  permission: string;
  scope: string;
  level: PermissionLevel;
  grantedAt: string;
  expiresAt?: string;
}

interface HealthAlert {
  id: string;
  agentId: string;
  severity: "critical" | "warning" | "info";
  message: string;
  toolId?: string;
  timestamp: string;
}

const AGENTS: Agent[] = [
  { id: "a1", name: "Reed", role: "ARIA Specialist", status: "active", model: "claude-3.5-sonnet", toolsEnabled: 12, skillsLoaded: 8, permissions: ["read", "write"], lastActive: "now", uptime: "14d 6h", healthScore: 98 },
  { id: "a2", name: "Sam", role: "Animation Engineer", status: "active", model: "claude-3.5-sonnet", toolsEnabled: 14, skillsLoaded: 6, permissions: ["read", "write"], lastActive: "2m ago", uptime: "14d 6h", healthScore: 95 },
  { id: "a3", name: "Wes", role: "State Architect", status: "active", model: "claude-3.5-sonnet", toolsEnabled: 16, skillsLoaded: 9, permissions: ["read", "write", "admin"], lastActive: "now", uptime: "14d 6h", healthScore: 100 },
  { id: "a4", name: "Piper", role: "Interaction Designer", status: "idle", model: "claude-3-opus", toolsEnabled: 10, skillsLoaded: 5, permissions: ["read"], lastActive: "1h ago", uptime: "14d 6h", healthScore: 92 },
  { id: "a5", name: "Luis", role: "Principal UX Engineer", status: "active", model: "claude-3.5-sonnet", toolsEnabled: 18, skillsLoaded: 12, permissions: ["read", "write", "admin"], lastActive: "now", uptime: "14d 6h", healthScore: 99 },
  { id: "a6", name: "Quinn", role: "State Management", status: "active", model: "claude-3.5-sonnet", toolsEnabled: 15, skillsLoaded: 7, permissions: ["read", "write"], lastActive: "5m ago", uptime: "14d 6h", healthScore: 97 },
  { id: "a7", name: "Barry", role: "Replay Engine", status: "degraded", model: "claude-3-opus", toolsEnabled: 8, skillsLoaded: 4, permissions: ["read", "write"], lastActive: "15m ago", uptime: "2d 3h", healthScore: 65 },
  { id: "a8", name: "Devin", role: "Code Agent", status: "active", model: "claude-3.5-sonnet", toolsEnabled: 22, skillsLoaded: 14, permissions: ["read", "write", "admin"], lastActive: "now", uptime: "14d 6h", healthScore: 94 },
  { id: "a9", name: "Atlas", role: "Infrastructure", status: "offline", model: "claude-3-sonnet", toolsEnabled: 6, skillsLoaded: 3, permissions: ["read"], lastActive: "3d ago", uptime: "0h", healthScore: 0 },
  { id: "a10", name: "Nova", role: "Voice Interface", status: "active", model: "claude-3.5-sonnet", toolsEnabled: 9, skillsLoaded: 5, permissions: ["read", "write"], lastActive: "1m ago", uptime: "14d 6h", healthScore: 91 },
];

const TOOLS: Tool[] = [
  { id: "t1", name: "Read Files", category: "filesystem", description: "Read files from the workspace" },
  { id: "t2", name: "Write Files", category: "filesystem", description: "Create or overwrite files" },
  { id: "t3", name: "Edit Files", category: "filesystem", description: "Make precise edits to files" },
  { id: "t4", name: "Execute Shell", category: "execution", description: "Run shell commands" },
  { id: "t5", name: "Browser Control", category: "browser", description: "Control web browser automation" },
  { id: "t6", name: "Web Search", category: "web", description: "Search the web using Brave API" },
  { id: "t7", name: "Web Fetch", category: "web", description: "Fetch and extract content from URLs" },
  { id: "t8", name: "Send Message", category: "communication", description: "Send messages via channels" },
  { id: "t9", name: "Read Messages", category: "communication", description: "Read messages from channels" },
  { id: "t10", name: "Voice Call", category: "communication", description: "Make phone calls" },
  { id: "t11", name: "TTS Output", category: "audio", description: "Convert text to speech" },
  { id: "t12", name: "Image Analysis", category: "ai", description: "Analyze images with vision models" },
  { id: "t13", name: "Subagent Spawn", category: "orchestration", description: "Spawn sub-agent sessions" },
  { id: "t14", name: "Node Control", category: "infrastructure", description: "Control paired nodes" },
  { id: "t15", name: "Canvas Control", category: "ui", description: "Control canvas elements" },
  { id: "t16", name: "Database Query", category: "data", description: "Query databases" },
  { id: "t17", name: "Secret Access", category: "security", description: "Access vault secrets" },
  { id: "t18", name: "SSH Access", category: "infrastructure", description: "SSH to remote hosts" },
];

const SKILLS: Skill[] = [
  { id: "s1", name: "React", category: "frontend", level: "expert" },
  { id: "s2", name: "TypeScript", category: "frontend", level: "expert" },
  { id: "s3", name: "Tailwind", category: "frontend", level: "expert" },
  { id: "s4", name: "Node.js", category: "backend", level: "advanced" },
  { id: "s5", name: "PostgreSQL", category: "database", level: "advanced" },
  { id: "s6", name: "Docker", category: "infrastructure", level: "advanced" },
  { id: "s7", name: "Kubernetes", category: "infrastructure", level: "basic" },
  { id: "s8", name: "AWS", category: "cloud", level: "advanced" },
  { id: "s9", name: "GraphQL", category: "backend", level: "advanced" },
  { id: "s10", name: "Testing", category: "quality", level: "expert" },
  { id: "s11", name: "CI/CD", category: "devops", level: "advanced" },
  { id: "s12", name: "Security", category: "compliance", level: "basic" },
];

const AGENT_TOOLS: Record<string, ToolCapability[]> = {
  "a1": [
    { toolId: "t1", status: "enabled", lastUsed: "1m ago" },
    { toolId: "t2", status: "enabled", lastUsed: "5m ago" },
    { toolId: "t3", status: "enabled", lastUsed: "3m ago" },
    { toolId: "t6", status: "enabled", lastUsed: "10m ago" },
    { toolId: "t7", status: "enabled", lastUsed: "8m ago" },
    { toolId: "t12", status: "enabled", lastUsed: "15m ago" },
    { toolId: "t15", status: "enabled", lastUsed: "2m ago" },
    { toolId: "t17", status: "disabled" },
  ],
  "a2": [
    { toolId: "t1", status: "enabled", lastUsed: "30s ago" },
    { toolId: "t2", status: "enabled", lastUsed: "1m ago" },
    { toolId: "t3", status: "enabled", lastUsed: "45s ago" },
    { toolId: "t4", status: "enabled", lastUsed: "2m ago" },
    { toolId: "t5", status: "degraded", lastUsed: "10m ago", errorCount: 3 },
    { toolId: "t6", status: "enabled", lastUsed: "5m ago" },
    { toolId: "t7", status: "enabled", lastUsed: "3m ago" },
    { toolId: "t12", status: "enabled", lastUsed: "20m ago" },
  ],
  "a3": [
    { toolId: "t1", status: "enabled", lastUsed: "now" },
    { toolId: "t2", status: "enabled", lastUsed: "now" },
    { toolId: "t3", status: "enabled", lastUsed: "now" },
    { toolId: "t4", status: "enabled", lastUsed: "1m ago" },
    { toolId: "t6", status: "enabled", lastUsed: "5m ago" },
    { toolId: "t7", status: "enabled", lastUsed: "3m ago" },
    { toolId: "t8", status: "enabled", lastUsed: "2m ago" },
    { toolId: "t9", status: "enabled", lastUsed: "1m ago" },
    { toolId: "t13", status: "enabled", lastUsed: "30s ago" },
    { toolId: "t15", status: "enabled", lastUsed: "1m ago" },
  ],
  "a4": [
    { toolId: "t1", status: "enabled", lastUsed: "30m ago" },
    { toolId: "t2", status: "enabled", lastUsed: "45m ago" },
    { toolId: "t3", status: "enabled", lastUsed: "40m ago" },
    { toolId: "t6", status: "disabled" },
    { toolId: "t7", status: "disabled" },
    { toolId: "t12", status: "enabled", lastUsed: "1h ago" },
    { toolId: "t15", status: "enabled", lastUsed: "20m ago" },
  ],
  "a5": [
    { toolId: "t1", status: "enabled", lastUsed: "now" },
    { toolId: "t2", status: "enabled", lastUsed: "now" },
    { toolId: "t3", status: "enabled", lastUsed: "now" },
    { toolId: "t4", status: "enabled", lastUsed: "now" },
    { toolId: "t5", status: "enabled", lastUsed: "5m ago" },
    { toolId: "t6", status: "enabled", lastUsed: "2m ago" },
    { toolId: "t7", status: "enabled", lastUsed: "1m ago" },
    { toolId: "t8", status: "enabled", lastUsed: "now" },
    { toolId: "t9", status: "enabled", lastUsed: "now" },
    { toolId: "t10", status: "enabled", lastUsed: "10m ago" },
    { toolId: "t11", status: "enabled", lastUsed: "8m ago" },
    { toolId: "t12", status: "enabled", lastUsed: "15m ago" },
    { toolId: "t13", status: "enabled", lastUsed: "3m ago" },
    { toolId: "t14", status: "enabled", lastUsed: "20m ago" },
    { toolId: "t15", status: "enabled", lastUsed: "2m ago" },
    { toolId: "t16", status: "enabled", lastUsed: "30m ago" },
    { toolId: "t17", status: "enabled", lastUsed: "1h ago" },
    { toolId: "t18", status: "enabled", lastUsed: "2h ago" },
  ],
  "a6": [
    { toolId: "t1", status: "enabled", lastUsed: "1m ago" },
    { toolId: "t2", status: "enabled", lastUsed: "2m ago" },
    { toolId: "t3", status: "enabled", lastUsed: "1m ago" },
    { toolId: "t4", status: "enabled", lastUsed: "5m ago" },
    { toolId: "t6", status: "enabled", lastUsed: "10m ago" },
    { toolId: "t7", status: "enabled", lastUsed: "8m ago" },
    { toolId: "t8", status: "enabled", lastUsed: "3m ago" },
    { toolId: "t9", status: "enabled", lastUsed: "2m ago" },
    { toolId: "t13", status: "enabled", lastUsed: "6m ago" },
    { toolId: "t15", status: "enabled", lastUsed: "4m ago" },
    { toolId: "t16", status: "degraded", lastUsed: "15m ago", errorCount: 2 },
  ],
  "a7": [
    { toolId: "t1", status: "enabled", lastUsed: "5m ago" },
    { toolId: "t2", status: "enabled", lastUsed: "8m ago" },
    { toolId: "t3", status: "enabled", lastUsed: "6m ago" },
    { toolId: "t4", status: "degraded", lastUsed: "20m ago", errorCount: 7 },
    { toolId: "t6", status: "enabled", lastUsed: "15m ago" },
    { toolId: "t7", status: "enabled", lastUsed: "12m ago" },
    { toolId: "t16", status: "unavailable" },
    { toolId: "t17", status: "unavailable" },
  ],
  "a8": [
    { toolId: "t1", status: "enabled", lastUsed: "now" },
    { toolId: "t2", status: "enabled", lastUsed: "now" },
    { toolId: "t3", status: "enabled", lastUsed: "now" },
    { toolId: "t4", status: "enabled", lastUsed: "1m ago" },
    { toolId: "t5", status: "enabled", lastUsed: "3m ago" },
    { toolId: "t6", status: "enabled", lastUsed: "2m ago" },
    { toolId: "t7", status: "enabled", lastUsed: "1m ago" },
    { toolId: "t8", status: "enabled", lastUsed: "5m ago" },
    { toolId: "t9", status: "enabled", lastUsed: "4m ago" },
    { toolId: "t12", status: "enabled", lastUsed: "10m ago" },
    { toolId: "t13", status: "enabled", lastUsed: "2m ago" },
    { toolId: "t14", status: "enabled", lastUsed: "8m ago" },
    { toolId: "t15", status: "enabled", lastUsed: "6m ago" },
    { toolId: "t16", status: "enabled", lastUsed: "15m ago" },
    { toolId: "t17", status: "enabled", lastUsed: "20m ago" },
    { toolId: "t18", status: "enabled", lastUsed: "30m ago" },
  ],
  "a9": [
    { toolId: "t1", status: "disabled" },
    { toolId: "t2", status: "disabled" },
    { toolId: "t3", status: "disabled" },
    { toolId: "t4", status: "disabled" },
    { toolId: "t6", status: "disabled" },
    { toolId: "t7", status: "disabled" },
  ],
  "a10": [
    { toolId: "t1", status: "enabled", lastUsed: "2m ago" },
    { toolId: "t2", status: "enabled", lastUsed: "5m ago" },
    { toolId: "t3", status: "enabled", lastUsed: "3m ago" },
    { toolId: "t10", status: "enabled", lastUsed: "1m ago" },
    { toolId: "t11", status: "enabled", lastUsed: "30s ago" },
    { toolId: "t12", status: "enabled", lastUsed: "10m ago" },
    { toolId: "t15", status: "enabled", lastUsed: "8m ago" },
    { toolId: "t8", status: "enabled", lastUsed: "2m ago" },
    { toolId: "t9", status: "enabled", lastUsed: "1m ago" },
  ],
};

const AGENT_SKILLS: Record<string, SkillLevel[]> = {
  "a1": ["advanced", "expert", "basic", "advanced", "none", "basic", "none", "none", "basic", "expert", "basic", "none"],
  "a2": ["expert", "expert", "expert", "advanced", "basic", "advanced", "basic", "basic", "advanced", "expert", "advanced", "basic"],
  "a3": ["expert", "expert", "expert", "expert", "expert", "advanced", "advanced", "advanced", "expert", "expert", "advanced", "advanced"],
  "a4": ["expert", "expert", "expert", "advanced", "basic", "none", "none", "basic", "advanced", "expert", "none", "none"],
  "a5": ["expert", "expert", "expert", "expert", "expert", "expert", "advanced", "expert", "expert", "expert", "expert", "advanced"],
  "a6": ["expert", "expert", "expert", "advanced", "advanced", "basic", "none", "basic", "advanced", "expert", "basic", "basic"],
  "a7": ["advanced", "advanced", "basic", "advanced", "expert", "expert", "advanced", "advanced", "advanced", "advanced", "advanced", "basic"],
  "a8": ["expert", "expert", "expert", "expert", "expert", "expert", "expert", "expert", "expert", "expert", "expert", "advanced"],
  "a9": ["basic", "basic", "basic", "basic", "basic", "basic", "basic", "basic", "basic", "basic", "basic", "basic"],
  "a10": ["expert", "advanced", "advanced", "basic", "none", "none", "none", "none", "basic", "basic", "none", "none"],
};

const PERMISSION_GRANTS: PermissionGrant[] = [
  { id: "p1", permission: "Execute Shell", scope: "global", level: "admin", grantedAt: "45d ago", expiresAt: undefined },
  { id: "p2", permission: "Browser Control", scope: "all-tabs", level: "write", grantedAt: "30d ago", expiresAt: "15d" },
  { id: "p3", permission: "Send Messages", scope: "slack", level: "write", grantedAt: "60d ago" },
  { id: "p4", permission: "Read Messages", scope: "slack", level: "read", grantedAt: "60d ago" },
  { id: "p5", permission: "Node Control", scope: "paired-devices", level: "write", grantedAt: "20d ago" },
  { id: "p6", permission: "Secret Access", scope: "vault-secrets", level: "admin", grantedAt: "90d ago" },
  { id: "p7", permission: "SSH Access", scope: "infrastructure", level: "write", grantedAt: "14d ago", expiresAt: "16d" },
  { id: "p8", permission: "Database Query", scope: "analytics-db", level: "read", grantedAt: "7d ago" },
  { id: "p9", permission: "Voice Call", scope: "emergency", level: "write", grantedAt: "45d ago" },
  { id: "p10", permission: "Canvas Control", scope: "all-canvases", level: "write", grantedAt: "25d ago" },
];

const HEALTH_ALERTS: HealthAlert[] = [
  { id: "h1", agentId: "a7", severity: "critical", message: "Agent experiencing frequent tool failures - 7 errors in last hour", toolId: "t4", timestamp: "10m ago" },
  { id: "h2", agentId: "a7", severity: "critical", message: "Database tool unavailable - connection pool exhausted", toolId: "t16", timestamp: "15m ago" },
  { id: "h3", agentId: "a7", severity: "warning", message: "Secret access tool unavailable - permission expired", toolId: "t17", timestamp: "1h ago" },
  { id: "h4", agentId: "a9", severity: "critical", message: "Agent offline - last seen 3 days ago", timestamp: "3d ago" },
  { id: "h5", agentId: "a2", severity: "warning", message: "Browser control showing degraded performance", toolId: "t5", timestamp: "30m ago" },
  { id: "h6", agentId: "a6", severity: "warning", message: "Database query tool experiencing intermittent errors", toolId: "t16", timestamp: "20m ago" },
  { id: "h7", agentId: "a4", severity: "info", message: "Agent idle for 1 hour - no active tasks", timestamp: "1h ago" },
  { id: "h8", agentId: "a1", severity: "info", message: "Secret access tool has been disabled for this agent", toolId: "t17", timestamp: "2d ago" },
];

const statusColor: Record<AgentStatus, string> = {
  active: "text-emerald-400",
  idle: "text-amber-400",
  degraded: "text-rose-400",
  offline: "text-zinc-500",
};

const statusBg: Record<AgentStatus, string> = {
  active: "bg-emerald-400/10 border-emerald-400/30",
  idle: "bg-amber-400/10 border-amber-400/30",
  degraded: "bg-rose-400/10 border-rose-400/30",
  offline: "bg-zinc-700/10 border-zinc-600/30",
};

const toolStatusColor: Record<ToolStatus, string> = {
  enabled: "text-emerald-400",
  disabled: "text-zinc-500",
  degraded: "text-amber-400",
  unavailable: "text-rose-400",
};

const toolStatusBg: Record<ToolStatus, string> = {
  enabled: "bg-emerald-400/10",
  disabled: "bg-zinc-800",
  degraded: "bg-amber-400/10",
  unavailable: "bg-rose-400/10",
};

const permissionLevelColor: Record<PermissionLevel, string> = {
  none: "text-zinc-600",
  read: "text-sky-400",
  write: "text-amber-400",
  admin: "text-rose-400",
};

const permissionLevelBg: Record<PermissionLevel, string> = {
  none: "bg-zinc-800",
  read: "bg-sky-500/10 border-sky-500/30",
  write: "bg-amber-500/10 border-amber-500/30",
  admin: "bg-rose-500/10 border-rose-500/30",
};

const skillLevelColor: Record<SkillLevel, string> = {
  none: "text-zinc-600",
  basic: "text-zinc-400",
  advanced: "text-indigo-400",
  expert: "text-emerald-400",
};

const alertSeverityColor: Record<"critical" | "warning" | "info", string> = {
  critical: "text-rose-400 bg-rose-500/10 border-rose-500/30",
  warning: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  info: "text-sky-400 bg-sky-500/10 border-sky-500/30",
};

const toolCategories = ["all", "filesystem", "execution", "browser", "web", "communication", "audio", "ai", "orchestration", "infrastructure", "ui", "data", "security"];
const permissionLevels = ["all", "none", "read", "write", "admin"];

export default function AgentCapabilityMatrix() {
  const [tab, setTab] = useState<"roster" | "matrix" | "permissions" | "health">("roster");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [permissionFilter, setPermissionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  const filteredAgents = AGENTS.filter(a => {
    if (agentFilter !== "all" && a.id !== agentFilter) return false;
    if (permissionFilter !== "all" && !a.permissions.includes(permissionFilter as PermissionLevel)) return false;
    if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase()) && !a.role.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredTools = TOOLS.filter(t => {
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    return true;
  });

  const getToolCapability = (agentId: string, toolId: string): ToolCapability | undefined => {
    return AGENT_TOOLS[agentId]?.find(tc => tc.toolId === toolId);
  };

  const getSkillLevel = (agentId: string, skillIndex: number): SkillLevel => {
    return AGENT_SKILLS[agentId]?.[skillIndex] || "none";
  };

  const getAgentPermissionGrants = (agentId: string): PermissionGrant[] => {
    const agent = AGENTS.find(a => a.id === agentId);
    if (!agent) return [];
    return PERMISSION_GRANTS.filter(p => {
      if (agent.permissions.includes("admin") && p.level === "admin") return true;
      if (agent.permissions.includes("write") && (p.level === "write" || p.level === "read")) return true;
      if (agent.permissions.includes("read") && p.level === "read") return true;
      return false;
    });
  };

  const getAlertsForAgent = (agentId: string): HealthAlert[] => {
    return HEALTH_ALERTS.filter(a => a.agentId === agentId);
  };

  const totalToolsTracked = TOOLS.length;
  const totalPermissionGrants = PERMISSION_GRANTS.length;
  const totalAlerts = HEALTH_ALERTS.length;
  const criticalAlerts = HEALTH_ALERTS.filter(a => a.severity === "critical").length;

  const tabs: { id: "roster" | "matrix" | "permissions" | "health"; label: string; icon: React.ReactNode }[] = [
    { id: "roster", label: "Agent Roster", icon: <Users className="w-4 h-4" /> },
    { id: "matrix", label: "Capability Matrix", icon: <Layers className="w-4 h-4" /> },
    { id: "permissions", label: "Permission Grants", icon: <ShieldCheck className="w-4 h-4" /> },
    { id: "health", label: "Capability Health", icon: <Activity className="w-4 h-4" /> },
  ];

  const toggleAlert = (alertId: string) => {
    const newExpanded = new Set(expandedAlerts);
    if (newExpanded.has(alertId)) {
      newExpanded.delete(alertId);
    } else {
      newExpanded.add(alertId);
    }
    setExpandedAlerts(newExpanded);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Agent Capability Matrix</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Mission Control — Horizon UI Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/30">
            <Gauge className="w-3 h-3 text-indigo-400" />
            <span className="text-xs text-indigo-400 font-medium">Live</span>
          </div>
          <div className="text-xs text-zinc-500">{AGENTS.length} agents registered</div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-0 border-b border-zinc-800">
        {[
          { label: "Total Agents", value: AGENTS.length.toString(), sub: `${AGENTS.filter(a => a.status === "active").length} active`, icon: <Bot className="w-4 h-4" /> },
          { label: "Tools Tracked", value: totalToolsTracked.toString(), sub: "across 13 categories", icon: <Tool className="w-4 h-4" /> },
          { label: "Skills Loaded", value: SKILLS.length.toString(), sub: "across 8 domains", icon: <Brain className="w-4 h-4" /> },
          { label: "Permission Grants", value: totalPermissionGrants.toString(), sub: "elevated access", icon: <Key className="w-4 h-4" /> },
          { label: "Capability Alerts", value: totalAlerts.toString(), sub: `${criticalAlerts} critical`, icon: <AlertTriangle className="w-4 h-4" />, alert: criticalAlerts > 0 },
        ].map((stat, i) => (
          <div key={i} className={cn("px-6 py-3 border-r border-zinc-800 last:border-r-0", stat.alert && "bg-rose-500/5")}>
            <div className="flex items-center gap-2">
              <span className={cn("text-zinc-400", stat.alert && "text-rose-400")}>{stat.icon}</span>
              <div className={cn("text-xl font-bold", stat.alert ? "text-rose-400" : "text-white")}>{stat.value}</div>
            </div>
            <div className="text-xs font-medium text-zinc-400 mt-0.5">{stat.label}</div>
            <div className="text-xs text-zinc-600 mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-zinc-800 bg-zinc-900/30">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded pl-9 pr-3 py-1.5 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-indigo-500"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-indigo-500"
          >
            <option value="all">All Agents</option>
            {AGENTS.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-indigo-500"
          >
            {toolCategories.map(cat => (
              <option key={cat} value={cat}>{cat === "all" ? "All Categories" : cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
            ))}
          </select>
          
          <select
            value={permissionFilter}
            onChange={e => setPermissionFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-indigo-500"
          >
            {permissionLevels.map(lvl => (
              <option key={lvl} value={lvl}>{lvl === "all" ? "All Permissions" : lvl.toUpperCase()}</option>
            ))}
          </select>
        </div>
        
        <button
          onClick={() => {
            setAgentFilter("all");
            setCategoryFilter("all");
            setPermissionFilter("all");
            setSearchQuery("");
          }}
          className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-400 transition-colors"
        >
          Clear Filters
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 px-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              tab === t.id
                ? "border-indigo-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* ROSTER TAB */}
        {tab === "roster" && (
          <div className="flex h-full">
            {/* Agent List */}
            <div className="w-96 border-r border-zinc-800 flex flex-col">
              <div className="p-3 border-b border-zinc-800">
                <div className="text-xs text-zinc-500 uppercase tracking-wider">
                  Agents ({filteredAgents.length})
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredAgents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-900 transition-colors",
                      selectedAgent?.id === agent.id && "bg-zinc-800"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", statusBg[agent.status])}>
                          <Bot className={cn("w-4 h-4", statusColor[agent.status])} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-zinc-200">{agent.name}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">{agent.role}</div>
                        </div>
                      </div>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded border shrink-0", statusBg[agent.status])}>
                        <span className={statusColor[agent.status]}>{agent.status}</span>
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Tool className="w-3 h-3" /> {agent.toolsEnabled}
                      </span>
                      <span className="flex items-center gap-1">
                        <Brain className="w-3 h-3" /> {agent.skillsLoaded}
                      </span>
                      <span className="flex items-center gap-1">
                        <Cpu className="w-3 h-3" /> {agent.model.split("-").pop()}
                      </span>
                    </div>
                    {agent.healthScore < 70 && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-rose-400">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Health: {agent.healthScore}%</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Agent Detail Panel */}
            <div className="flex-1 overflow-y-auto">
              {selectedAgent ? (
                <div className="p-6 space-y-6">
                  {/* Header */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center", statusBg[selectedAgent.status])}>
                      <Bot className={cn("w-7 h-7", statusColor[selectedAgent.status])} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-white">{selectedAgent.name}</h2>
                        <span className={cn("text-xs px-2 py-0.5 rounded border", statusBg[selectedAgent.status])}>
                          <span className={statusColor[selectedAgent.status]}>{selectedAgent.status}</span>
                        </span>
                      </div>
                      <p className="text-sm text-zinc-500 mt-0.5">{selectedAgent.role}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Activity className="w-3 h-3" /> Last active: {selectedAgent.lastActive}
                        </span>
                        <span className="flex items-center gap-1">
                          <Timer className="w-3 h-3" /> Uptime: {selectedAgent.uptime}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">{selectedAgent.healthScore}%</div>
                      <div className="text-xs text-zinc-500">Health Score</div>
                    </div>
                  </div>

                  {/* Capability Summary */}
                  <div>
                    <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Capability Summary</div>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: "Tools Enabled", value: selectedAgent.toolsEnabled, total: totalToolsTracked, icon: <Tool className="w-4 h-4" /> },
                        { label: "Skills Loaded", value: selectedAgent.skillsLoaded, total: SKILLS.length, icon: <Brain className="w-4 h-4" /> },
                        { label: "Permissions", value: selectedAgent.permissions.length, icon: <Key className="w-4 h-4" /> },
                        { label: "Model", value: selectedAgent.model.split("-").pop() || "N/A", icon: <Cpu className="w-4 h-4" /> },
                      ].map(({ label, value, total, icon }) => (
                        <div key={label} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
                          <div className="flex items-center gap-2 text-zinc-400 mb-2">{icon}</div>
                          <div className="text-xl font-bold text-white">{value}{total ? `/${total}` : ''}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tools */}
                  <div>
                    <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Tools</div>
                    <div className="grid grid-cols-2 gap-2">
                      {TOOLS.map(tool => {
                        const cap = getToolCapability(selectedAgent.id, tool.id);
                        return (
                          <div key={tool.id} className={cn("flex items-center justify-between px-3 py-2 rounded-lg border", cap ? toolStatusBg[cap.status] : "bg-zinc-900 border-zinc-800")}>
                            <div className="flex items-center gap-2">
                              <Tool className={cn("w-4 h-4", cap ? toolStatusColor[cap.status] : "text-zinc-600")} />
                              <span className="text-sm text-zinc-300">{tool.name}</span>
                            </div>
                            {cap ? (
                              <span className={cn("text-xs px-2 py-0.5 rounded", cap.status === "enabled" ? "bg-emerald-500/20 text-emerald-400" : cap.status === "disabled" ? "bg-zinc-700 text-zinc-500" : cap.status === "degraded" ? "bg-amber-500/20 text-amber-400" : "bg-rose-500/20 text-rose-400")}>
                                {cap.status}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-600">unavailable</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Skills */}
                  <div>
                    <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Skills</div>
                    <div className="grid grid-cols-3 gap-2">
                      {SKILLS.map((skill, i) => {
                        const level = getSkillLevel(selectedAgent.id, i);
                        return (
                          <div key={skill.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800">
                            <span className="text-sm text-zinc-300">{skill.name}</span>
                            <span className={cn("text-xs px-2 py-0.5 rounded font-medium", 
                              level === "expert" ? "bg-emerald-500/20 text-emerald-400" :
                              level === "advanced" ? "bg-indigo-500/20 text-indigo-400" :
                              level === "basic" ? "bg-zinc-700 text-zinc-400" :
                              "bg-zinc-800 text-zinc-600"
                            )}>
                              {level}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Permission Grants */}
                  <div>
                    <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Permission Grants</div>
                    <div className="space-y-2">
                      {getAgentPermissionGrants(selectedAgent.id).map(grant => (
                        <div key={grant.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800">
                          <div>
                            <div className="text-sm font-medium text-zinc-200">{grant.permission}</div>
                            <div className="text-xs text-zinc-500 mt-0.5">Scope: {grant.scope}</div>
                          </div>
                          <span className={cn("text-xs px-2 py-1 rounded border", permissionLevelBg[grant.level])}>
                            <span className={permissionLevelColor[grant.level]}>{grant.level}</span>
                          </span>
                        </div>
                      ))}
                      {getAgentPermissionGrants(selectedAgent.id).length === 0 && (
                        <div className="text-sm text-zinc-500 text-center py-4">No elevated permissions</div>
                      )}
                    </div>
                  </div>

                  {/* Health Alerts */}
                  {getAlertsForAgent(selectedAgent.id).length > 0 && (
                    <div>
                      <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Health Alerts</div>
                      <div className="space-y-2">
                        {getAlertsForAgent(selectedAgent.id).map(alert => (
                          <div key={alert.id} className={cn("flex items-start gap-3 px-4 py-3 rounded-lg border", alertSeverityColor[alert.severity])}>
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <div className="text-sm text-zinc-200">{alert.message}</div>
                              <div className="text-xs text-zinc-500 mt-0.5">{alert.timestamp}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                  Select an agent to view details
                </div>
              )}
            </div>
          </div>
        )}

        {/* MATRIX TAB */}
        {tab === "matrix" && (
          <div className="p-6">
            <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">
              Capability Matrix — {filteredAgents.length} agents × {filteredTools.length} tools
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left text-xs text-zinc-500 font-medium px-3 py-2 sticky left-0 bg-zinc-950 z-10">Agent</th>
                    {filteredTools.map(tool => (
                      <th key={tool.id} className="text-center text-xs text-zinc-500 font-medium px-2 py-2 min-w-[60px]" title={tool.name}>
                        <div className="flex flex-col items-center gap-0.5">
                          <Tool className="w-3 h-3" />
                          <span className="text-[10px]">{tool.name.split(" ")[0]}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAgents.map(agent => (
                    <tr key={agent.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
                      <td className="px-3 py-2 sticky left-0 bg-zinc-950 z-10">
                        <div className="flex items-center gap-2">
                          <Bot className={cn("w-4 h-4", statusColor[agent.status])} />
                          <div>
                            <div className="text-sm font-medium text-zinc-200">{agent.name}</div>
                            <div className="text-xs text-zinc-500">{agent.role}</div>
                          </div>
                        </div>
                      </td>
                      {filteredTools.map(tool => {
                        const cap = getToolCapability(agent.id, tool.id);
                        return (
                          <td key={tool.id} className="text-center px-1 py-1">
                            {cap ? (
                              <button
                                title={`${tool.name}: ${cap.status}${cap.lastUsed ? ` (${cap.lastUsed})` : ''}${cap.errorCount ? ` - ${cap.errorCount} errors` : ''}`}
                                className={cn(
                                  "w-6 h-6 rounded flex items-center justify-center text-[10px] font-medium transition-colors",
                                  cap.status === "enabled" ? "bg-emerald-500/20 text-emerald-400" :
                                  cap.status === "disabled" ? "bg-zinc-800 text-zinc-600" :
                                  cap.status === "degraded" ? "bg-amber-500/20 text-amber-400" :
                                  "bg-rose-500/20 text-rose-400"
                                )}
                              >
                                {cap.status === "enabled" ? "✓" : cap.status === "disabled" ? "—" : cap.status === "degraded" ? "!" : "✗"}
                              </button>
                            ) : (
                              <span className="text-zinc-700 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="mt-6 flex items-center gap-6">
              <span className="text-xs text-zinc-500">Legend:</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-emerald-500/20 flex items-center justify-center text-[8px] text-emerald-400">✓</div>
                <span className="text-xs text-zinc-400">Enabled</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-zinc-800 flex items-center justify-center text-[8px] text-zinc-600">—</div>
                <span className="text-xs text-zinc-400">Disabled</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-amber-500/20 flex items-center justify-center text-[8px] text-amber-400">!</div>
                <span className="text-xs text-zinc-400">Degraded</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-rose-500/20 flex items-center justify-center text-[8px] text-rose-400">✗</div>
                <span className="text-xs text-zinc-400">Unavailable</span>
              </div>
            </div>

            {/* Skills Matrix */}
            <div className="mt-8">
              <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Skill Coverage Matrix</div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left text-xs text-zinc-500 font-medium px-3 py-2 sticky left-0 bg-zinc-950 z-10">Agent</th>
                      {SKILLS.map(skill => (
                        <th key={skill.id} className="text-center text-xs text-zinc-500 font-medium px-2 py-2 min-w-[50px]">
                          {skill.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map(agent => (
                      <tr key={agent.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
                        <td className="px-3 py-2 sticky left-0 bg-zinc-950 z-10">
                          <div className="flex items-center gap-2">
                            <Bot className={cn("w-4 h-4", statusColor[agent.status])} />
                            <span className="text-sm font-medium text-zinc-200">{agent.name}</span>
                          </div>
                        </td>
                        {SKILLS.map((skill, i) => {
                          const level = getSkillLevel(agent.id, i);
                          return (
                            <td key={skill.id} className="text-center px-1 py-1">
                              <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded font-medium",
                                level === "expert" ? "bg-emerald-500/20 text-emerald-400" :
                                level === "advanced" ? "bg-indigo-500/20 text-indigo-400" :
                                level === "basic" ? "bg-zinc-700 text-zinc-400" :
                                "bg-zinc-800 text-zinc-600"
                              )}>
                                {level === "none" ? "—" : level.charAt(0).toUpperCase()}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PERMISSIONS TAB */}
        {tab === "permissions" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider">
                Permission Grants — {PERMISSION_GRANTS.length} active grants
              </div>
              <button className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors">
                + New Grant
              </button>
            </div>

            {/* Permission Categories */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { category: "Execution", icon: <Terminal className="w-4 h-4" />, grants: PERMISSION_GRANTS.filter(p => p.permission.includes("Execute")) },
                { category: "Browser", icon: <Globe className="w-4 h-4" />, grants: PERMISSION_GRANTS.filter(p => p.permission.includes("Browser")) },
                { category: "Communication", icon: <MessageSquare className="w-4 h-4" />, grants: PERMISSION_GRANTS.filter(p => p.permission.includes("Message") || p.permission.includes("Voice")) },
                { category: "Infrastructure", icon: <HardDrive className="w-4 h-4" />, grants: PERMISSION_GRANTS.filter(p => p.permission.includes("Node") || p.permission.includes("SSH")) },
                { category: "Security", icon: <Shield className="w-4 h-4" />, grants: PERMISSION_GRANTS.filter(p => p.permission.includes("Secret")) },
                { category: "Data", icon: <Database className="w-4 h-4" />, grants: PERMISSION_GRANTS.filter(p => p.permission.includes("Database")) },
              ].map(({ category, icon, grants }) => (
                <div key={category} className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-zinc-400">{icon}</span>
                    <span className="text-sm font-medium text-zinc-300">{category}</span>
                    <span className="ml-auto text-xs text-zinc-500">{grants.length}</span>
                  </div>
                  <div className="space-y-2">
                    {grants.map(grant => (
                      <div key={grant.id} className="flex items-center justify-between px-3 py-2 bg-zinc-950 rounded border border-zinc-800/50">
                        <div>
                          <div className="text-xs font-medium text-zinc-300">{grant.permission}</div>
                          <div className="text-[10px] text-zinc-500">Scope: {grant.scope}</div>
                        </div>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", permissionLevelBg[grant.level])}>
                          <span className={permissionLevelColor[grant.level]}>{grant.level}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Full Permission Table */}
            <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">All Permission Grants</div>
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Permission</th>
                    <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Scope</th>
                    <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Level</th>
                    <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Granted</th>
                    <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Expires</th>
                    <th className="text-left text-xs text-zinc-500 font-medium px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_GRANTS.map(grant => (
                    <tr key={grant.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-zinc-200">{grant.permission}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-zinc-400 font-mono bg-zinc-950 px-2 py-0.5 rounded">{grant.scope}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-1 rounded border", permissionLevelBg[grant.level])}>
                          <span className={permissionLevelColor[grant.level]}>{grant.level}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-zinc-500">{grant.grantedAt}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs", grant.expiresAt ? "text-amber-400" : "text-zinc-500")}>
                          {grant.expiresAt || "Never"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button className="text-xs text-zinc-500 hover:text-zinc-300">Revoke</button>
                          <button className="text-xs text-zinc-500 hover:text-zinc-300">Edit</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* HEALTH TAB */}
        {tab === "health" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider">
                Capability Health — {HEALTH_ALERTS.length} alerts
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  {HEALTH_ALERTS.filter(a => a.severity === "critical").length} Critical
                </span>
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  {HEALTH_ALERTS.filter(a => a.severity === "warning").length} Warning
                </span>
                <span className="flex items-center gap-1 text-xs text-sky-400">
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                  {HEALTH_ALERTS.filter(a => a.severity === "info").length} Info
                </span>
              </div>
            </div>

            {/* Health by Agent */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {AGENTS.map(agent => {
                const agentAlerts = getAlertsForAgent(agent.id);
                return (
                  <div key={agent.id} className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Bot className={cn("w-5 h-5", statusColor[agent.status])} />
                        <div>
                          <div className="text-sm font-medium text-zinc-200">{agent.name}</div>
                          <div className="text-xs text-zinc-500">{agent.role}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn("text-lg font-bold", agent.healthScore >= 90 ? "text-emerald-400" : agent.healthScore >= 70 ? "text-amber-400" : "text-rose-400")}>
                          {agent.healthScore}%
                        </div>
                        <div className="text-[10px] text-zinc-500">Health Score</div>
                      </div>
                    </div>
                    
                    {agentAlerts.length > 0 && (
                      <div className="space-y-2">
                        {agentAlerts.map(alert => (
                          <div
                            key={alert.id}
                            onClick={() => toggleAlert(alert.id)}
                            className={cn("flex items-start gap-2 px-3 py-2 rounded border cursor-pointer transition-colors", alertSeverityColor[alert.severity])}
                          >
                            {expandedAlerts.has(alert.id) ? (
                              <ChevronDown className="w-4 h-4 shrink-0 mt-0.5" />
                            ) : (
                              <ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <div className="text-xs font-medium text-zinc-200">{alert.message}</div>
                              <div className="text-[10px] text-zinc-500 mt-0.5">{alert.timestamp}</div>
                              {expandedAlerts.has(alert.id) && alert.toolId && (
                                <div className="mt-2 pt-2 border-t border-zinc-700/50">
                                  <span className="text-[10px] text-zinc-400">
                                    Tool ID: {alert.toolId}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {agentAlerts.length === 0 && (
                      <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 rounded px-3 py-2">
                        <CheckCircle2 className="w-3 h-3" />
                        All systems operational
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tool Health Summary */}
            <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Tool Health Summary</div>
            <div className="grid grid-cols-6 gap-2">
              {TOOLS.slice(0, 12).map(tool => {
                const toolAlerts = HEALTH_ALERTS.filter(a => a.toolId === tool.id);
                const hasIssues = toolAlerts.length > 0;
                return (
                  <div key={tool.id} className={cn("px-3 py-2 rounded-lg border", hasIssues ? "bg-amber-500/10 border-amber-500/30" : "bg-zinc-900 border-zinc-800")}>
                    <div className="flex items-center justify-between">
                      <Tool className={cn("w-4 h-4", hasIssues ? "text-amber-400" : "text-zinc-500")} />
                      {hasIssues && (
                        <span className="text-[10px] text-amber-400">{toolAlerts.length}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-1 truncate">{tool.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Database icon helper (lucide-react doesn't have Database, using similar)
function Database({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}
