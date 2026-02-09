"use client";

import * as React from "react";
import {
  Bug,
  Plus,
  Trash2,
  Info,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useConfig } from "@/hooks/queries/useConfig";
import { usePatchConfig } from "@/hooks/mutations/useConfigMutations";
import { useChannelsStatusFast } from "@/hooks/queries/useChannels";
import { useUIStore } from "@/stores/useUIStore";

// ---------------------------------------------------------------------------
// Types — mirrors the full LoggingConfig + DebuggingConfig shape from
// src/config/types.base.ts and src/config/types.debugging.ts so we
// preserve every field on save (no accidental deletion).
// ---------------------------------------------------------------------------

type LogLevel = "silent" | "fatal" | "error" | "warn" | "info" | "debug" | "trace";
type ConsoleStyle = "pretty" | "compact" | "json";
type RedactSensitive = "off" | "tools";

interface DebuggingProps {
  verbose?: boolean;
  debug?: boolean;
  trace?: boolean;
  suppressLogging?: boolean;
  [key: string]: unknown;
}

interface DebuggingConfig {
  channels?: Record<string, DebuggingProps>;
  features?: Record<string, DebuggingProps>;
}

interface EnhancedLogging {
  toolErrors?: boolean;
  performanceOutliers?: boolean;
  tokenWarnings?: boolean;
  gatewayHealth?: boolean;
  gatewayHealthSuppressCliConnectDisconnect?: boolean;
  gatewayHealthSuppressMethods?: string[];
}

interface PerformanceThresholds {
  toolCall?: number;
  agentTurn?: number;
  gatewayRequest?: number;
  databaseOp?: number;
}

interface TokenWarningThresholds {
  warning?: number;
  critical?: number;
}

interface JournalConfig {
  enabled?: boolean;
  file?: string;
  maxResultChars?: number;
  redactSensitive?: boolean;
  toolFilter?: string[];
  retentionHours?: number;
}

interface LoggingConfig {
  level?: LogLevel;
  file?: string;
  consoleLevel?: LogLevel;
  consoleStyle?: ConsoleStyle;
  redactSensitive?: RedactSensitive;
  redactPatterns?: string[];
  suppressSubsystemDebugLogs?: string[];
  enhanced?: EnhancedLogging;
  performanceThresholds?: PerformanceThresholds;
  tokenWarningThresholds?: TokenWarningThresholds;
  journal?: JournalConfig;
  // Preserve unknown keys so we never clobber them on save
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG_LEVELS: { value: LogLevel; label: string; description: string }[] = [
  { value: "silent", label: "Silent", description: "No output" },
  { value: "fatal", label: "Fatal", description: "Fatal errors only" },
  { value: "error", label: "Error", description: "Errors" },
  { value: "warn", label: "Warn", description: "Warnings and above" },
  { value: "info", label: "Info", description: "General information" },
  { value: "debug", label: "Debug", description: "Detailed debug output" },
  { value: "trace", label: "Trace", description: "Very verbose tracing" },
];

const CONSOLE_STYLES: { value: ConsoleStyle; label: string }[] = [
  { value: "pretty", label: "Pretty" },
  { value: "compact", label: "Compact" },
  { value: "json", label: "JSON" },
];

const PERF_THRESHOLD_FIELDS: {
  key: keyof PerformanceThresholds;
  label: string;
  defaultValue: number;
  max: number;
}[] = [
  { key: "toolCall", label: "Tool Call", defaultValue: 5000, max: 30000 },
  { key: "agentTurn", label: "Agent Turn", defaultValue: 30000, max: 120000 },
  { key: "gatewayRequest", label: "Gateway Request", defaultValue: 10000, max: 60000 },
  { key: "databaseOp", label: "Database Op", defaultValue: 2000, max: 15000 },
];

/** Known feature IDs used across the codebase. */
const KNOWN_FEATURE_IDS = [
  "compaction-hooks",
  "memory-recall",
  "memory-recall-fallback",
  "skills",
];

const ENHANCED_DEFAULTS: Record<string, boolean> = {
  toolErrors: true,
  performanceOutliers: true,
  tokenWarnings: true,
  gatewayHealth: true,
  gatewayHealthSuppressCliConnectDisconnect: true,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A row for a single debug entry (channel or feature) with verbosity toggles */
function DebugEntryRow({
  name,
  props,
  onChange,
  onRemove,
}: {
  name: string;
  props: DebuggingProps;
  onChange: (props: DebuggingProps) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
      <code className="text-sm font-mono font-medium min-w-[100px]">{name}</code>

      <div className="flex items-center gap-4 flex-1 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs">
          <Switch
            checked={!!props.verbose}
            onCheckedChange={(v) =>
              onChange({ ...props, verbose: v, ...(v ? { debug: false, trace: false } : {}) })
            }
            className="scale-75"
          />
          <span>Verbose</span>
        </label>

        <label className="flex items-center gap-1.5 text-xs">
          <Switch
            checked={!!props.debug}
            onCheckedChange={(v) =>
              onChange({ ...props, debug: v, ...(v ? { verbose: false } : {}) })
            }
            className="scale-75"
          />
          <span>Debug</span>
        </label>

        <label className="flex items-center gap-1.5 text-xs">
          <Switch
            checked={!!props.trace}
            onCheckedChange={(v) =>
              onChange({ ...props, trace: v, ...(v ? { verbose: false } : {}) })
            }
            className="scale-75"
          />
          <span>Trace</span>
        </label>

        <label className="flex items-center gap-1.5 text-xs">
          <Switch
            checked={!!props.suppressLogging}
            onCheckedChange={(v) => onChange({ ...props, suppressLogging: v })}
            className="scale-75"
          />
          <span className="text-muted-foreground">Suppress</span>
        </label>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/** Add entry form with optional suggestions dropdown */
function AddEntryForm({
  placeholder,
  existingKeys,
  suggestions,
  onAdd,
}: {
  placeholder: string;
  existingKeys: string[];
  suggestions?: { id: string; label?: string }[];
  onAdd: (name: string) => void;
}) {
  const [value, setValue] = React.useState("");

  const handleAdd = (name?: string) => {
    const trimmed = (name ?? value).trim().toLowerCase();
    if (!trimmed) return;
    if (existingKeys.includes(trimmed)) {
      toast.error(`"${trimmed}" already exists`);
      return;
    }
    onAdd(trimmed);
    setValue("");
  };

  // Filter suggestions to exclude already-added entries
  const availableSuggestions = suggestions?.filter(
    (s) => !existingKeys.includes(s.id)
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="h-8 text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAdd()}
          disabled={!value.trim()}
          className="shrink-0"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>
      {availableSuggestions && availableSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground pt-0.5">Quick add:</span>
          {availableSuggestions.map((s) => (
            <Badge
              key={s.id}
              variant="outline"
              className="cursor-pointer hover:bg-primary/10 transition-colors text-xs"
              onClick={() => handleAdd(s.id)}
            >
              <Plus className="h-2.5 w-2.5 mr-0.5" />
              {s.label ?? s.id}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/** Reusable tag list (for arrays of strings like redactPatterns, toolFilter, etc.) */
function TagListEditor({
  items,
  onChange,
  placeholder,
  label,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  label: string;
}) {
  const [newEntry, setNewEntry] = React.useState("");

  const handleAdd = () => {
    const trimmed = newEntry.trim();
    if (!trimmed) return;
    if (items.includes(trimmed)) {
      toast.error(`"${trimmed}" already in ${label}`);
      return;
    }
    onChange([...items, trimmed]);
    setNewEntry("");
  };

  const handleRemove = (entry: string) => {
    onChange(items.filter((e) => e !== entry));
  };

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((entry) => (
            <Badge
              key={entry}
              variant="secondary"
              className="gap-1 cursor-pointer hover:bg-destructive/20 transition-colors"
              onClick={() => handleRemove(entry)}
            >
              <code className="text-xs">{entry}</code>
              <Trash2 className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={newEntry}
          onChange={(e) => setNewEntry(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="h-8 text-sm font-mono"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!newEntry.trim()}
          className="shrink-0"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface DebugLoggingSectionProps {
  className?: string;
}

export function DebugLoggingSection({ className }: DebugLoggingSectionProps) {
  const { powerUserMode } = useUIStore();
  const { data: configSnapshot, isLoading, error } = useConfig();
  const patchConfig = usePatchConfig();
  const { data: channelsStatus } = useChannelsStatusFast();

  // ---------------------------------------------------------------------------
  // Local state — mirrors the FULL logging/debugging objects from the config
  // so we never clobber fields we don't have UI controls for.
  // ---------------------------------------------------------------------------

  const [logging, setLogging] = React.useState<LoggingConfig>({});
  const [debugging, setDebugging] = React.useState<DebuggingConfig>({});
  const [dirty, setDirty] = React.useState(false);

  // Snapshot of the last saved config for diff indicators
  const savedRef = React.useRef<{ logging: LoggingConfig; debugging: DebuggingConfig }>({
    logging: {},
    debugging: {},
  });

  // Sync from server config on load
  React.useEffect(() => {
    if (!configSnapshot?.config) return;
    const cfg = configSnapshot.config as Record<string, unknown>;
    const newLogging = (cfg.logging as LoggingConfig) ?? {};
    const newDebugging = (cfg.debugging as DebuggingConfig) ?? {};
    setLogging(newLogging);
    setDebugging(newDebugging);
    savedRef.current = { logging: newLogging, debugging: newDebugging };
    setDirty(false);
  }, [configSnapshot]);

  // Unsaved changes guard — warn on browser navigation/close
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ---------------------------------------------------------------------------
  // Channel suggestions from gateway
  // ---------------------------------------------------------------------------

  const channelSuggestions = React.useMemo(() => {
    if (!channelsStatus) return [];
    const order = channelsStatus.channelOrder ?? Object.keys(channelsStatus.channels ?? {});
    return order.map((id) => ({
      id,
      label: channelsStatus.channelLabels?.[id] ?? id,
    }));
  }, [channelsStatus]);

  const featureSuggestions = React.useMemo(
    () => KNOWN_FEATURE_IDS.map((id) => ({ id })),
    []
  );

  // ---------------------------------------------------------------------------
  // Mutation helpers
  // ---------------------------------------------------------------------------

  const markDirty = () => setDirty(true);

  const updateLogging = (patch: Partial<LoggingConfig>) => {
    setLogging((prev) => ({ ...prev, ...patch }));
    markDirty();
  };

  const updateEnhanced = (patch: Partial<EnhancedLogging>) => {
    setLogging((prev) => ({
      ...prev,
      enhanced: { ...prev.enhanced, ...patch },
    }));
    markDirty();
  };

  const updatePerfThresholds = (patch: Partial<PerformanceThresholds>) => {
    setLogging((prev) => ({
      ...prev,
      performanceThresholds: { ...prev.performanceThresholds, ...patch },
    }));
    markDirty();
  };

  const updateTokenThresholds = (patch: Partial<TokenWarningThresholds>) => {
    setLogging((prev) => ({
      ...prev,
      tokenWarningThresholds: { ...prev.tokenWarningThresholds, ...patch },
    }));
    markDirty();
  };

  const updateJournal = (patch: Partial<JournalConfig>) => {
    setLogging((prev) => ({
      ...prev,
      journal: { ...prev.journal, ...patch },
    }));
    markDirty();
  };

  // --- Debugging entries ---

  const setChannelProps = (channelId: string, props: DebuggingProps) => {
    setDebugging((prev) => ({
      ...prev,
      channels: { ...prev.channels, [channelId]: props },
    }));
    markDirty();
  };

  const removeChannel = (channelId: string) => {
    setDebugging((prev) => {
      const next = { ...prev.channels };
      delete next[channelId];
      return { ...prev, channels: next };
    });
    markDirty();
  };

  const addChannel = (channelId: string) => {
    setChannelProps(channelId, { debug: true });
  };

  const setFeatureProps = (featureId: string, props: DebuggingProps) => {
    setDebugging((prev) => ({
      ...prev,
      features: { ...prev.features, [featureId]: props },
    }));
    markDirty();
  };

  const removeFeature = (featureId: string) => {
    setDebugging((prev) => {
      const next = { ...prev.features };
      delete next[featureId];
      return { ...prev, features: next };
    });
    markDirty();
  };

  const addFeature = (featureId: string) => {
    setFeatureProps(featureId, { debug: true });
  };

  // ---------------------------------------------------------------------------
  // Save / Reset
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (!configSnapshot?.hash) {
      toast.error("No configuration hash available");
      return;
    }

    // Validate: warning must be less than critical
    const warnPct = logging.tokenWarningThresholds?.warning ?? 75;
    const critPct = logging.tokenWarningThresholds?.critical ?? 90;
    if (warnPct >= critPct) {
      toast.error("Token warning threshold must be lower than the critical threshold");
      return;
    }

    // Build the patch — we send the full objects so all tracked fields are preserved.
    const patch: Record<string, unknown> = {
      logging,
      debugging,
    };

    try {
      await patchConfig.mutateAsync({
        baseHash: configSnapshot.hash,
        raw: JSON.stringify(patch),
        note: "Update debug & logging configuration from UI",
      });
      setDirty(false);
    } catch {
      // Error toast is handled by the mutation hook
    }
  };

  const handleReset = () => {
    setLogging(savedRef.current.logging);
    setDebugging(savedRef.current.debugging);
    setDirty(false);
    toast.info("Reset to saved configuration");
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!powerUserMode) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Debug & Logging
          </CardTitle>
          <CardDescription>
            Enable <strong>Power User Mode</strong> in Advanced settings to access debug and logging configuration.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Debug & Logging
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading configuration...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("border-destructive/50 bg-destructive/10", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Bug className="h-5 w-5" />
            Debug & Logging
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Failed to load configuration: {error instanceof Error ? error.message : "Unknown error"}.
            Make sure the gateway is running.
          </p>
        </CardContent>
      </Card>
    );
  }

  const channelEntries = Object.entries(debugging.channels ?? {});
  const featureEntries = Object.entries(debugging.features ?? {});
  const warnPct = logging.tokenWarningThresholds?.warning ?? 75;
  const critPct = logging.tokenWarningThresholds?.critical ?? 90;
  const thresholdInvalid = warnPct >= critPct;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Info banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-medium">Debug & Logging Configuration</h4>
            <p className="text-sm text-muted-foreground">
              Tune log verbosity, enable per-channel/feature debugging, configure enhanced logging
              features, and set performance thresholds. Changes are written to the{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">openclaw.json</code>{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">logging</code> and{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">debugging</code> sections.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* LOGGING — Log Levels, Style & File Path                           */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log Levels & Output</CardTitle>
          <CardDescription>
            Control the global log level, console output level, display style, and log file path.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* File log level */}
            <div className="space-y-2">
              <Label htmlFor="log-level">File Log Level</Label>
              <Select
                value={logging.level ?? "info"}
                onValueChange={(v) => updateLogging({ level: v as LogLevel })}
              >
                <SelectTrigger id="log-level" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOG_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Minimum level written to the log file.
              </p>
            </div>

            {/* Console log level */}
            <div className="space-y-2">
              <Label htmlFor="console-level">Console Log Level</Label>
              <Select
                value={logging.consoleLevel ?? "info"}
                onValueChange={(v) => updateLogging({ consoleLevel: v as LogLevel })}
              >
                <SelectTrigger id="console-level" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOG_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Minimum level shown in console output.
              </p>
            </div>

            {/* Console style */}
            <div className="space-y-2">
              <Label htmlFor="console-style">Console Style</Label>
              <Select
                value={logging.consoleStyle ?? "pretty"}
                onValueChange={(v) => updateLogging({ consoleStyle: v as ConsoleStyle })}
              >
                <SelectTrigger id="console-style" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONSOLE_STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Format style for console log output.
              </p>
            </div>
          </div>

          {/* Log file path */}
          <div className="space-y-2">
            <Label htmlFor="log-file">Log File Path</Label>
            <Input
              id="log-file"
              placeholder="~/.openclaw/logs/gateway.log"
              value={logging.file ?? ""}
              onChange={(e) => updateLogging({ file: e.target.value || undefined })}
              className="h-8 text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">
              File path for log output. Leave empty for the default location.
            </p>
          </div>

          <Separator />

          {/* Redact sensitive */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Redact Sensitive Values</Label>
              <p className="text-xs text-muted-foreground">
                Redact API keys, tokens, and other sensitive data in log output and tool summaries.
              </p>
            </div>
            <Select
              value={logging.redactSensitive ?? "tools"}
              onValueChange={(v) => updateLogging({ redactSensitive: v as RedactSensitive })}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tools">Tools</SelectItem>
                <SelectItem value="off">Off</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Redact patterns */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Custom Redaction Patterns</Label>
            <p className="text-xs text-muted-foreground">
              Regex patterns used to redact sensitive tokens in logs. Defaults apply when unset.
            </p>
            <TagListEditor
              items={logging.redactPatterns ?? []}
              onChange={(patterns) => updateLogging({ redactPatterns: patterns.length ? patterns : undefined })}
              placeholder="e.g. sk-[a-zA-Z0-9]{32}"
              label="redact patterns"
            />
          </div>
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* LOGGING — Enhanced Logging Toggles                                */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enhanced Logging</CardTitle>
          <CardDescription>
            Toggle specialized logging subsystems for deeper insight into system behavior.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {([
            {
              key: "toolErrors" as const,
              label: "Tool Error Details",
              description: "Log detailed context when tool calls fail",
            },
            {
              key: "performanceOutliers" as const,
              label: "Performance Outliers",
              description: "Log operations that exceed performance thresholds",
            },
            {
              key: "tokenWarnings" as const,
              label: "Token Budget Warnings",
              description: "Log warnings when approaching token limits",
            },
            {
              key: "gatewayHealth" as const,
              label: "Gateway Health Events",
              description: "Log gateway connection state changes",
            },
            {
              key: "gatewayHealthSuppressCliConnectDisconnect" as const,
              label: "Suppress CLI Connect/Disconnect",
              description: "Suppress CLI client connect/disconnect health logs",
            },
          ] as const).map(({ key, label, description }) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{label}</Label>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <Switch
                checked={logging.enhanced?.[key] ?? ENHANCED_DEFAULTS[key] ?? true}
                onCheckedChange={(v) => updateEnhanced({ [key]: v })}
              />
            </div>
          ))}

          <Separator />

          {/* Gateway health suppress methods */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Suppress Health Logs for RPC Methods</Label>
            <p className="text-xs text-muted-foreground">
              Gateway RPC methods that should not emit connect/disconnect health logs.
            </p>
            <TagListEditor
              items={logging.enhanced?.gatewayHealthSuppressMethods ?? []}
              onChange={(methods) =>
                updateEnhanced({ gatewayHealthSuppressMethods: methods.length ? methods : undefined })
              }
              placeholder="e.g. config.get, health"
              label="suppress methods"
            />
          </div>
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* LOGGING — Performance Thresholds                                  */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance Thresholds</CardTitle>
          <CardDescription>
            Set millisecond thresholds for performance outlier detection. Operations exceeding
            these values will be flagged in logs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {PERF_THRESHOLD_FIELDS.map(({ key, label, defaultValue, max }) => {
            const currentValue = logging.performanceThresholds?.[key] ?? defaultValue;
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{label}</Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    {currentValue.toLocaleString()}ms
                  </span>
                </div>
                <Slider
                  value={[currentValue]}
                  min={100}
                  max={max}
                  step={100}
                  onValueChange={([v]) => updatePerfThresholds({ [key]: v })}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>100ms</span>
                  <span className="opacity-50">default: {defaultValue.toLocaleString()}ms</span>
                  <span>{max.toLocaleString()}ms</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* LOGGING — Token Warning Thresholds                                */}
      {/* ================================================================= */}
      <Card className={thresholdInvalid ? "border-destructive/50" : undefined}>
        <CardHeader>
          <CardTitle className="text-base">Token Warning Thresholds</CardTitle>
          <CardDescription>
            Percentage of context window usage that triggers warning and critical alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Warning Level</Label>
              <span className="text-xs font-mono text-muted-foreground">{warnPct}%</span>
            </div>
            <Slider
              value={[warnPct]}
              min={50}
              max={95}
              step={5}
              onValueChange={([v]) => updateTokenThresholds({ warning: v })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Critical Level</Label>
              <span className="text-xs font-mono text-muted-foreground">{critPct}%</span>
            </div>
            <Slider
              value={[critPct]}
              min={60}
              max={99}
              step={1}
              onValueChange={([v]) => updateTokenThresholds({ critical: v })}
            />
          </div>

          {thresholdInvalid && (
            <div className="flex items-center gap-2 text-destructive text-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Warning threshold must be lower than the critical threshold.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* LOGGING — Tool Journal                                            */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tool Journal</CardTitle>
          <CardDescription>
            Forensic logging of tool call inputs and outputs for debugging agent behavior.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Enable Journal</Label>
              <p className="text-xs text-muted-foreground">
                Write tool call details to a separate journal file.
              </p>
            </div>
            <Switch
              checked={logging.journal?.enabled ?? true}
              onCheckedChange={(v) => updateJournal({ enabled: v })}
            />
          </div>

          {(logging.journal?.enabled ?? true) && (
            <>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="journal-file" className="text-sm">Journal File Path</Label>
                  <Input
                    id="journal-file"
                    placeholder="~/.openclaw/logs/tool-journal.jsonl"
                    value={logging.journal?.file ?? ""}
                    onChange={(e) => updateJournal({ file: e.target.value || undefined })}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="journal-max-chars" className="text-sm">Max Result Chars</Label>
                  <Input
                    id="journal-max-chars"
                    type="number"
                    min={100}
                    max={100000}
                    placeholder="2000"
                    value={logging.journal?.maxResultChars ?? ""}
                    onChange={(e) =>
                      updateJournal({
                        maxResultChars: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="journal-retention" className="text-sm">Retention (hours)</Label>
                  <Input
                    id="journal-retention"
                    type="number"
                    min={1}
                    max={720}
                    placeholder="72"
                    value={logging.journal?.retentionHours ?? ""}
                    onChange={(e) =>
                      updateJournal({
                        retentionHours: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-3 pt-5">
                  <Switch
                    id="journal-redact"
                    checked={logging.journal?.redactSensitive ?? false}
                    onCheckedChange={(v) => updateJournal({ redactSensitive: v })}
                  />
                  <Label htmlFor="journal-redact" className="text-sm">
                    Redact sensitive values in journal
                  </Label>
                </div>
              </div>

              {/* Journal tool filter */}
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tool Filter</Label>
                <p className="text-xs text-muted-foreground">
                  Only log journal entries for these tool names. Leave empty to use the default set (exec, process, edit, write, apply_patch).
                </p>
                <TagListEditor
                  items={logging.journal?.toolFilter ?? []}
                  onChange={(filter) =>
                    updateJournal({ toolFilter: filter.length ? filter : undefined })
                  }
                  placeholder="e.g. web_search, read_file"
                  label="tool filter"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* LOGGING — Suppress Subsystem Debug Logs                           */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suppress Subsystem Logs</CardTitle>
          <CardDescription>
            Subsystem patterns to suppress debug/trace console output for. Supports hierarchical
            matching (e.g. <code className="text-xs">slack</code> matches{" "}
            <code className="text-xs">slack/send</code>). File logs are unaffected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TagListEditor
            items={logging.suppressSubsystemDebugLogs ?? []}
            onChange={(entries) =>
              updateLogging({ suppressSubsystemDebugLogs: entries.length ? entries : undefined })
            }
            placeholder="e.g. slack, diagnostic/lanes"
            label="suppress entries"
          />
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* DEBUGGING — Channel Overrides                                     */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Channel Debug Overrides</CardTitle>
          <CardDescription>
            Enable targeted debugging for specific messaging channels. Each channel can have its
            own verbosity level. Supports hierarchical subsystem matching.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {channelEntries.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              No channel overrides configured. Add one below.
            </p>
          )}
          {channelEntries.map(([name, props]) => (
            <DebugEntryRow
              key={name}
              name={name}
              props={props}
              onChange={(newProps) => setChannelProps(name, newProps)}
              onRemove={() => removeChannel(name)}
            />
          ))}
          <AddEntryForm
            placeholder="Channel name..."
            existingKeys={channelEntries.map(([k]) => k)}
            suggestions={channelSuggestions}
            onAdd={addChannel}
          />
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* DEBUGGING — Feature Overrides                                     */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feature Debug Overrides</CardTitle>
          <CardDescription>
            Enable targeted debugging for specific features. Use this for short-term debugging and
            testing of individual subsystems. Supports hierarchical matching.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {featureEntries.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              No feature overrides configured. Add one below.
            </p>
          )}
          {featureEntries.map(([name, props]) => (
            <DebugEntryRow
              key={name}
              name={name}
              props={props}
              onChange={(newProps) => setFeatureProps(name, newProps)}
              onRemove={() => removeFeature(name)}
            />
          ))}
          <AddEntryForm
            placeholder="Feature name..."
            existingKeys={featureEntries.map(([k]) => k)}
            suggestions={featureSuggestions}
            onAdd={addFeature}
          />
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* Save / Reset bar                                                  */}
      {/* ================================================================= */}
      {dirty && (
        <div className="sticky bottom-4 z-10">
          <Card className="border-primary/30 bg-background/95 backdrop-blur shadow-lg">
            <CardContent className="flex items-center justify-between py-3">
              <p className="text-sm text-muted-foreground">
                You have unsaved changes to debug & logging configuration.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={patchConfig.isPending || thresholdInvalid}
                >
                  {patchConfig.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default DebugLoggingSection;
