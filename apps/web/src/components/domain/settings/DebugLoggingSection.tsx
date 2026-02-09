"use client";

import * as React from "react";
import {
  Bug,
  Plus,
  Trash2,
  Info,
  RotateCcw,
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
import { useUIStore } from "@/stores/useUIStore";

// ---------------------------------------------------------------------------
// Types
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
  retentionHours?: number;
}

interface LoggingConfig {
  level?: LogLevel;
  consoleLevel?: LogLevel;
  consoleStyle?: ConsoleStyle;
  redactSensitive?: RedactSensitive;
  suppressSubsystemDebugLogs?: string[];
  enhanced?: EnhancedLogging;
  performanceThresholds?: PerformanceThresholds;
  tokenWarningThresholds?: TokenWarningThresholds;
  journal?: JournalConfig;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const val = source[key];
    if (val !== undefined) {
      (result as Record<string, unknown>)[key as string] = val;
    }
  }
  return result;
}

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

/** Inline form to add a new debug entry */
function AddEntryForm({
  placeholder,
  existingKeys,
  onAdd,
}: {
  placeholder: string;
  existingKeys: string[];
  onAdd: (name: string) => void;
}) {
  const [value, setValue] = React.useState("");

  const handleAdd = () => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return;
    if (existingKeys.includes(trimmed)) {
      toast.error(`"${trimmed}" already exists`);
      return;
    }
    onAdd(trimmed);
    setValue("");
  };

  return (
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
        onClick={handleAdd}
        disabled={!value.trim()}
        className="shrink-0"
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add
      </Button>
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
  const { data: configSnapshot, isLoading } = useConfig();
  const patchConfig = usePatchConfig();

  // ---------------------------------------------------------------------------
  // Local state (mirrors config, submitted on save)
  // ---------------------------------------------------------------------------

  const [logging, setLogging] = React.useState<LoggingConfig>({});
  const [debugging, setDebugging] = React.useState<DebuggingConfig>({});
  const [dirty, setDirty] = React.useState(false);

  // Sync from server config on load
  React.useEffect(() => {
    if (!configSnapshot?.config) return;
    const cfg = configSnapshot.config as Record<string, unknown>;
    setLogging((cfg.logging as LoggingConfig) ?? {});
    setDebugging((cfg.debugging as DebuggingConfig) ?? {});
    setDirty(false);
  }, [configSnapshot]);

  // ---------------------------------------------------------------------------
  // Mutation helpers
  // ---------------------------------------------------------------------------

  const markDirty = () => setDirty(true);

  const updateLogging = (patch: Partial<LoggingConfig>) => {
    setLogging((prev) => deepMerge(prev, patch));
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

  // --- Suppress subsystem list ---

  const [newSuppressEntry, setNewSuppressEntry] = React.useState("");

  const addSuppressEntry = () => {
    const trimmed = newSuppressEntry.trim();
    if (!trimmed) return;
    const current = logging.suppressSubsystemDebugLogs ?? [];
    if (current.includes(trimmed)) {
      toast.error(`"${trimmed}" is already suppressed`);
      return;
    }
    updateLogging({ suppressSubsystemDebugLogs: [...current, trimmed] });
    setNewSuppressEntry("");
  };

  const removeSuppressEntry = (entry: string) => {
    updateLogging({
      suppressSubsystemDebugLogs: (logging.suppressSubsystemDebugLogs ?? []).filter(
        (e) => e !== entry
      ),
    });
  };

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (!configSnapshot?.hash) {
      toast.error("No configuration hash available");
      return;
    }

    // Build the patch with only logging + debugging
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
    if (!configSnapshot?.config) return;
    const cfg = configSnapshot.config as Record<string, unknown>;
    setLogging((cfg.logging as LoggingConfig) ?? {});
    setDebugging((cfg.debugging as DebuggingConfig) ?? {});
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

  const channelEntries = Object.entries(debugging.channels ?? {});
  const featureEntries = Object.entries(debugging.features ?? {});

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
      {/* LOGGING — Log Levels & Style                                      */}
      {/* ================================================================= */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log Levels & Output</CardTitle>
          <CardDescription>
            Control the global log level, console output level, and display style.
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
          {[
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
          ].map(({ key, label, description }) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{label}</Label>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <Switch
                checked={logging.enhanced?.[key] ?? (key === "gatewayHealthSuppressCliConnectDisconnect" ? true : true)}
                onCheckedChange={(v) => updateEnhanced({ [key]: v })}
              />
            </div>
          ))}
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
      <Card>
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
              <span className="text-xs font-mono text-muted-foreground">
                {logging.tokenWarningThresholds?.warning ?? 75}%
              </span>
            </div>
            <Slider
              value={[logging.tokenWarningThresholds?.warning ?? 75]}
              min={50}
              max={95}
              step={5}
              onValueChange={([v]) => updateTokenThresholds({ warning: v })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Critical Level</Label>
              <span className="text-xs font-mono text-muted-foreground">
                {logging.tokenWarningThresholds?.critical ?? 90}%
              </span>
            </div>
            <Slider
              value={[logging.tokenWarningThresholds?.critical ?? 90]}
              min={60}
              max={99}
              step={1}
              onValueChange={([v]) => updateTokenThresholds({ critical: v })}
            />
          </div>
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
              checked={logging.journal?.enabled ?? false}
              onCheckedChange={(v) => updateJournal({ enabled: v })}
            />
          </div>

          {logging.journal?.enabled && (
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
            Subsystem patterns to suppress debug/trace console output for. Supports glob-style
            patterns (e.g. <code className="text-xs">slack/*</code>,{" "}
            <code className="text-xs">diagnostic/lanes</code>). File logs are unaffected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(logging.suppressSubsystemDebugLogs ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(logging.suppressSubsystemDebugLogs ?? []).map((entry) => (
                <Badge
                  key={entry}
                  variant="secondary"
                  className="gap-1 cursor-pointer hover:bg-destructive/20 transition-colors"
                  onClick={() => removeSuppressEntry(entry)}
                >
                  <code className="text-xs">{entry}</code>
                  <Trash2 className="h-3 w-3" />
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="e.g. slack/* or diagnostic/lanes"
              value={newSuppressEntry}
              onChange={(e) => setNewSuppressEntry(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSuppressEntry();
                }
              }}
              className="h-8 text-sm font-mono"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={addSuppressEntry}
              disabled={!newSuppressEntry.trim()}
              className="shrink-0"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
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
            own verbosity level.
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
            placeholder="e.g. slack, telegram, discord"
            existingKeys={channelEntries.map(([k]) => k)}
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
            testing of individual subsystems.
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
            placeholder="e.g. compaction-hooks, memory-recall"
            existingKeys={featureEntries.map(([k]) => k)}
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
                  disabled={patchConfig.isPending}
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
