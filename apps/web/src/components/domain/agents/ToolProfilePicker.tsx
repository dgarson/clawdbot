
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  MessageCircle,
  Code,
  Sparkles,
  Settings2,
  ChevronDown,
  FileText,
  Terminal,
  Globe,
  Monitor,
  Network,
  Send,
  Cpu,
  Image,
  Cog,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ToolConfig {
  profile: "minimal" | "messaging" | "coding" | "full" | "custom";
  tools: Record<string, boolean>;
  execSecurity?: "deny" | "allowlist" | "full";
  execAllowlist?: string[];
}

export interface ToolProfilePickerProps {
  value: ToolConfig;
  onChange: (config: ToolConfig) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

type RiskLevel = "low" | "medium" | "high";

interface ToolDef {
  id: string;
  name: string;
  description: string;
  risk: RiskLevel;
}

interface ToolCategoryDef {
  id: string;
  label: string;
  icon: LucideIcon;
  tools: ToolDef[];
}

const TOOL_CATEGORIES: ToolCategoryDef[] = [
  {
    id: "files",
    label: "Files",
    icon: FileText,
    tools: [
      { id: "read", name: "read", description: "Read file contents", risk: "low" },
      { id: "write", name: "write", description: "Create or overwrite files", risk: "medium" },
      { id: "edit", name: "edit", description: "Make precise edits to files", risk: "medium" },
    ],
  },
  {
    id: "runtime",
    label: "Runtime",
    icon: Terminal,
    tools: [
      { id: "exec", name: "exec", description: "Execute shell commands", risk: "high" },
      { id: "process", name: "process", description: "Manage background processes", risk: "high" },
    ],
  },
  {
    id: "web",
    label: "Web",
    icon: Globe,
    tools: [
      { id: "web_search", name: "web_search", description: "Search the web", risk: "low" },
      { id: "web_fetch", name: "web_fetch", description: "Fetch content from URLs", risk: "low" },
    ],
  },
  {
    id: "browser",
    label: "Browser",
    icon: Monitor,
    tools: [
      { id: "browser", name: "browser", description: "Control a web browser", risk: "medium" },
    ],
  },
  {
    id: "sessions",
    label: "Sessions",
    icon: Network,
    tools: [
      { id: "sessions_list", name: "sessions_list", description: "List active sessions", risk: "low" },
      { id: "sessions_history", name: "sessions_history", description: "View session history", risk: "low" },
      { id: "sessions_spawn", name: "sessions_spawn", description: "Spawn sub-agent sessions", risk: "medium" },
    ],
  },
  {
    id: "messaging",
    label: "Messaging",
    icon: Send,
    tools: [
      { id: "message", name: "message", description: "Send messages via channels", risk: "medium" },
      { id: "tts", name: "tts", description: "Convert text to speech", risk: "low" },
    ],
  },
  {
    id: "nodes",
    label: "Nodes",
    icon: Cpu,
    tools: [
      { id: "nodes", name: "nodes", description: "Control paired devices", risk: "medium" },
    ],
  },
  {
    id: "media",
    label: "Media",
    icon: Image,
    tools: [
      { id: "image", name: "image", description: "Analyze images with AI", risk: "low" },
    ],
  },
  {
    id: "automation",
    label: "Automation",
    icon: Cog,
    tools: [
      { id: "cron", name: "cron", description: "Schedule recurring tasks", risk: "medium" },
      { id: "canvas", name: "canvas", description: "Present UI canvases", risk: "medium" },
    ],
  },
];

/** All tool IDs in one flat list */
const ALL_TOOL_IDS = TOOL_CATEGORIES.flatMap((c) => c.tools.map((t) => t.id));

/** Flat lookup for tool risk */
const TOOL_RISK_MAP: Record<string, RiskLevel> = Object.fromEntries(
  TOOL_CATEGORIES.flatMap((c) => c.tools.map((t) => [t.id, t.risk]))
);

// ─── Profile presets ─────────────────────────────────────────────────────────

interface ProfileDef {
  id: ToolConfig["profile"];
  label: string;
  icon: LucideIcon;
  colorClasses: {
    chip: string;
    chipActive: string;
    iconBg: string;
    iconText: string;
    ring: string;
  };
  description: string;
  enabledTools: string[];
}

const PROFILES: ProfileDef[] = [
  {
    id: "minimal",
    label: "Minimal",
    icon: Shield,
    colorClasses: {
      chip: "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600",
      chipActive: "border-slate-400 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/60",
      iconBg: "bg-slate-100 dark:bg-slate-800",
      iconText: "text-slate-600 dark:text-slate-400",
      ring: "ring-slate-400/30",
    },
    description: "Read & edit files only",
    enabledTools: ["read", "write", "edit"],
  },
  {
    id: "messaging",
    label: "Messaging",
    icon: MessageCircle,
    colorClasses: {
      chip: "border-blue-200 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-700",
      chipActive: "border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/40",
      iconBg: "bg-blue-100 dark:bg-blue-900/40",
      iconText: "text-blue-600 dark:text-blue-400",
      ring: "ring-blue-400/30",
    },
    description: "Files + messaging & web",
    enabledTools: ["read", "write", "edit", "message", "web_search", "web_fetch", "tts"],
  },
  {
    id: "coding",
    label: "Coding",
    icon: Code,
    colorClasses: {
      chip: "border-emerald-200 dark:border-emerald-800 hover:border-emerald-300 dark:hover:border-emerald-700",
      chipActive: "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
      iconText: "text-emerald-600 dark:text-emerald-400",
      ring: "ring-emerald-400/30",
    },
    description: "Files + code execution & web",
    enabledTools: ["read", "write", "edit", "exec", "process", "web_search", "web_fetch", "browser"],
  },
  {
    id: "full",
    label: "Full Access",
    icon: Sparkles,
    colorClasses: {
      chip: "border-amber-200 dark:border-amber-800 hover:border-amber-300 dark:hover:border-amber-700",
      chipActive: "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40",
      iconBg: "bg-amber-100 dark:bg-amber-900/40",
      iconText: "text-amber-600 dark:text-amber-400",
      ring: "ring-amber-400/30",
    },
    description: "Everything enabled",
    enabledTools: ALL_TOOL_IDS,
  },
];

/** Build a tools record from a profile's enabled tool list */
function toolsFromProfile(enabledTools: string[]): Record<string, boolean> {
  const tools: Record<string, boolean> = {};
  for (const id of ALL_TOOL_IDS) {
    tools[id] = enabledTools.includes(id);
  }
  return tools;
}

/** Detect which profile matches the current tool set (or "custom") */
function detectProfile(tools: Record<string, boolean>): ToolConfig["profile"] {
  for (const profile of PROFILES) {
    const expected = toolsFromProfile(profile.enabledTools);
    const matches = ALL_TOOL_IDS.every((id) => !!tools[id] === !!expected[id]);
    if (matches) {return profile.id;}
  }
  return "custom";
}

// ─── Risk badge component ────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskLevel, { label: string; emoji: string; variant: "success" | "warning" | "error" }> = {
  low: { label: "Low", emoji: "🟢", variant: "success" },
  medium: { label: "Medium", emoji: "🟡", variant: "warning" },
  high: { label: "High", emoji: "🔴", variant: "error" },
};

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const config = RISK_CONFIG[risk];
  return (
    <Badge variant={config.variant} className="text-[10px] gap-1 px-1.5 py-0 font-normal">
      <span className="text-[8px]">{config.emoji}</span>
      {config.label}
    </Badge>
  );
}

// ─── Profile Chip ────────────────────────────────────────────────────────────

function ProfileChip({
  profile,
  isActive,
  onClick,
}: {
  profile: ProfileDef;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = profile.icon;

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2",
        profile.colorClasses.ring,
        isActive ? profile.colorClasses.chipActive : profile.colorClasses.chip
      )}
    >
      {isActive && (
        <motion.div
          layoutId="profile-indicator"
          className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary border-2 border-background"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          profile.colorClasses.iconBg,
          profile.colorClasses.iconText
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-center">
        <div className="text-sm font-medium">{profile.label}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {profile.description}
        </div>
      </div>
    </motion.button>
  );
}

// ─── Tool Toggle Row ─────────────────────────────────────────────────────────

function ToolToggleRow({
  tool,
  enabled,
  onToggle,
  index,
}: {
  tool: ToolDef;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        enabled
          ? "border-primary/20 bg-primary/[0.03]"
          : "border-border/40 bg-transparent"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">
          {tool.name}
        </code>
        <span className="text-xs text-muted-foreground truncate hidden sm:inline">
          {tool.description}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <RiskBadge risk={tool.risk} />
        <Switch
          size="sm"
          checked={enabled}
          onCheckedChange={onToggle}
          aria-label={`Toggle ${tool.name}`}
        />
      </div>
    </motion.div>
  );
}

// ─── Category Section ────────────────────────────────────────────────────────

function CategorySection({
  category,
  tools,
  toolStates,
  onToolToggle,
  defaultExpanded,
}: {
  category: ToolCategoryDef;
  tools: ToolDef[];
  toolStates: Record<string, boolean>;
  onToolToggle: (toolId: string, enabled: boolean) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded ?? true);
  const enabledCount = tools.filter((t) => toolStates[t.id]).length;
  const CategoryIcon = category.icon;

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center justify-between px-4 py-3 text-left transition-colors",
          "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <div className="flex items-center gap-2.5">
          <CategoryIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{category.label}</span>
          <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
            {enabledCount}/{tools.length}
          </Badge>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <div className="space-y-1.5 px-4 pb-4">
              {tools.map((tool, i) => (
                <ToolToggleRow
                  key={tool.id}
                  tool={tool}
                  enabled={!!toolStates[tool.id]}
                  onToggle={(enabled) => onToolToggle(tool.id, enabled)}
                  index={i}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Exec Security Panel ─────────────────────────────────────────────────────

function ExecSecurityPanel({
  execSecurity,
  execAllowlist,
  onSecurityChange,
  onAllowlistChange,
}: {
  execSecurity: "deny" | "allowlist" | "full";
  execAllowlist: string[];
  onSecurityChange: (mode: "deny" | "allowlist" | "full") => void;
  onAllowlistChange: (list: string[]) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    >
      <Card className="border-amber-200/50 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>Exec Security Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="exec-security-mode" className="text-xs font-medium text-muted-foreground">
              Security Mode
            </Label>
            <Select value={execSecurity} onValueChange={(v) => onSecurityChange(v as "deny" | "allowlist" | "full")}>
              <SelectTrigger id="exec-security-mode" className="w-full max-w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deny">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]">🚫</span>
                    Deny all commands
                  </div>
                </SelectItem>
                <SelectItem value="allowlist">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]">📋</span>
                    Allowlist only
                  </div>
                </SelectItem>
                <SelectItem value="full">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]">⚡</span>
                    Full access
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {execSecurity === "deny" && "Agent cannot execute any shell commands."}
              {execSecurity === "allowlist" && "Agent can only run commands from the allowlist below."}
              {execSecurity === "full" && "Agent can run any shell command. Use with caution."}
            </p>
          </div>

          <AnimatePresence>
            {execSecurity === "allowlist" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-2"
              >
                <Label htmlFor="exec-allowlist" className="text-xs font-medium text-muted-foreground">
                  Allowed Commands
                </Label>
                <Textarea
                  id="exec-allowlist"
                  placeholder={"git\nnpm\nyarn\nnode\npython"}
                  value={execAllowlist.join("\n")}
                  onChange={(e) => {
                    const lines = e.target.value
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean);
                    onAllowlistChange(lines);
                  }}
                  rows={4}
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  One command per line. Only these command prefixes will be allowed.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ToolProfilePicker({ value, onChange }: ToolProfilePickerProps) {
  const { tools, execSecurity = "deny", execAllowlist = [] } = value;

  const activeProfile = React.useMemo(() => detectProfile(tools), [tools]);
  const execEnabled = !!tools.exec;

  // Count totals
  const enabledCount = ALL_TOOL_IDS.filter((id) => !!tools[id]).length;
  const highRiskEnabled = ALL_TOOL_IDS.filter(
    (id) => !!tools[id] && TOOL_RISK_MAP[id] === "high"
  ).length;

  const handleProfileSelect = React.useCallback(
    (profileId: ToolConfig["profile"]) => {
      const profile = PROFILES.find((p) => p.id === profileId);
      if (!profile) {return;}

      const newTools = toolsFromProfile(profile.enabledTools);
      onChange({
        ...value,
        profile: profileId,
        tools: newTools,
        // Reset exec security when switching away from profiles that include exec
        execSecurity: newTools.exec ? value.execSecurity ?? "deny" : "deny",
      });
    },
    [onChange, value]
  );

  const handleToolToggle = React.useCallback(
    (toolId: string, enabled: boolean) => {
      const newTools = { ...tools, [toolId]: enabled };
      const newProfile = detectProfile(newTools);
      onChange({
        ...value,
        profile: newProfile,
        tools: newTools,
        // If exec was just disabled, reset security to deny
        execSecurity: toolId === "exec" && !enabled ? "deny" : value.execSecurity,
      });
    },
    [tools, onChange, value]
  );

  const handleExecSecurityChange = React.useCallback(
    (mode: "deny" | "allowlist" | "full") => {
      onChange({ ...value, execSecurity: mode });
    },
    [onChange, value]
  );

  const handleAllowlistChange = React.useCallback(
    (list: string[]) => {
      onChange({ ...value, execAllowlist: list });
    },
    [onChange, value]
  );

  return (
    <div className="space-y-6">
      {/* ── Profile Chips ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Permission Profile</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quick presets — or customize individual tools below
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-normal">
              {enabledCount}/{ALL_TOOL_IDS.length} tools
            </Badge>
            {highRiskEnabled > 0 && (
              <Badge variant="error" className="text-xs font-normal gap-1">
                <AlertTriangle className="h-3 w-3" />
                {highRiskEnabled} high risk
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PROFILES.map((profile) => (
            <ProfileChip
              key={profile.id}
              profile={profile}
              isActive={activeProfile === profile.id}
              onClick={() => handleProfileSelect(profile.id)}
            />
          ))}
        </div>

        {activeProfile === "custom" && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-xs text-muted-foreground"
          >
            <Settings2 className="h-3.5 w-3.5 shrink-0" />
            <span>Custom configuration — tools don't match any preset</span>
          </motion.div>
        )}
      </div>

      {/* ── Tool Grid ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Tool Permissions</h3>
        <div className="space-y-2">
          {TOOL_CATEGORIES.map((category) => (
            <CategorySection
              key={category.id}
              category={category}
              tools={category.tools}
              toolStates={tools}
              onToolToggle={handleToolToggle}
              defaultExpanded={category.id === "files" || category.id === "runtime"}
            />
          ))}
        </div>
      </div>

      {/* ── Exec Security (conditional) ───────────────────────────── */}
      <AnimatePresence>
        {execEnabled && (
          <ExecSecurityPanel
            execSecurity={execSecurity}
            execAllowlist={execAllowlist}
            onSecurityChange={handleExecSecurityChange}
            onAllowlistChange={handleAllowlistChange}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default ToolProfilePicker;
