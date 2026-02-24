import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, X } from "lucide-react";
import { cn } from "../../lib/utils";

export type AlertRuleSeverity = "critical" | "high" | "medium" | "low" | "info";
export type AlertRuleCategory =
  | "availability"
  | "performance"
  | "security"
  | "budget"
  | "agent"
  | "provider"
  | "data"
  | "system";

export type AlertDiagnosticsView = "tracer" | "analytics" | "metrics";

export interface AlertRuleConfig {
  id: string;
  name: string;
  enabled: boolean;
  severity: AlertRuleSeverity;
  category: AlertRuleCategory;
  condition: string;
  threshold: string;
  window: string;
  notifyChannels: string[];
  firedCount: number;
  lastFired?: string;
  diagnosticsView: AlertDiagnosticsView;
  notes?: string;
}

interface AlertRuleConfigDialogProps {
  open: boolean;
  rule: AlertRuleConfig | null;
  onClose: () => void;
  onSave: (rule: AlertRuleConfig) => void;
  onOpenDiagnostics?: (view: AlertDiagnosticsView) => void;
}

type PanelId = "basics" | "trigger" | "delivery" | "advanced";

const COMMON_CHANNELS = ["#cb-alerts", "#cb-activity", "pagerduty", "email", "webhook"];

const SEVERITY_OPTIONS: AlertRuleSeverity[] = ["critical", "high", "medium", "low", "info"];
const CATEGORY_OPTIONS: AlertRuleCategory[] = [
  "availability",
  "performance",
  "security",
  "budget",
  "agent",
  "provider",
  "data",
  "system",
];

const DIAGNOSTICS_OPTIONS: Array<{ value: AlertDiagnosticsView; label: string }> = [
  { value: "tracer", label: "Agent Tracer" },
  { value: "analytics", label: "Alert Analytics" },
  { value: "metrics", label: "Metrics Explorer" },
];

function toLocalDateTimeInput(iso?: string): string {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromLocalDateTimeInput(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function RulePanel({
  title,
  description,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-tok-border bg-surface-1 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full px-4 py-3 flex items-center justify-between text-left",
          "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
        )}
      >
        <div>
          <p className="text-sm font-semibold text-fg-primary">{title}</p>
          <p className="text-xs text-fg-muted mt-0.5">{description}</p>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 text-fg-muted" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-4 text-fg-muted" aria-hidden="true" />
        )}
      </button>
      {expanded && <div className="px-4 pb-4 pt-1 space-y-3">{children}</div>}
    </section>
  );
}

export function AlertRuleConfigDialog({
  open,
  rule,
  onClose,
  onSave,
  onOpenDiagnostics,
}: AlertRuleConfigDialogProps) {
  const [draft, setDraft] = useState<AlertRuleConfig | null>(rule);
  const [channelInput, setChannelInput] = useState("");
  const [expandedPanels, setExpandedPanels] = useState<Record<PanelId, boolean>>({
    basics: true,
    trigger: true,
    delivery: true,
    advanced: false,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !rule) {
      return;
    }

    setDraft(rule);
    setChannelInput("");
    setExpandedPanels({ basics: true, trigger: true, delivery: true, advanced: false });
  }, [open, rule]);

  const canSave = useMemo(() => {
    if (!draft) {
      return false;
    }
    return draft.name.trim().length > 0 && draft.condition.trim().length > 0;
  }, [draft]);

  const togglePanel = (panel: PanelId) => {
    setExpandedPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  };

  const updateDraft = <K extends keyof AlertRuleConfig>(key: K, value: AlertRuleConfig[K]) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return { ...prev, [key]: value };
    });
  };

  const addChannel = (channel: string) => {
    const normalized = channel.trim();
    if (!normalized) {
      return;
    }

    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      if (prev.notifyChannels.includes(normalized)) {
        return prev;
      }
      return { ...prev, notifyChannels: [...prev.notifyChannels, normalized] };
    });

    setChannelInput("");
  };

  const removeChannel = (channel: string) => {
    setDraft((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        notifyChannels: prev.notifyChannels.filter((entry) => entry !== channel),
      };
    });
  };

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draft) {
      return;
    }

    const normalized: AlertRuleConfig = {
      ...draft,
      name: draft.name.trim() || "Untitled rule",
      condition: draft.condition.trim() || "Condition pending",
      threshold: draft.threshold.trim() || "N/A",
      window: draft.window.trim() || "5m",
      notifyChannels: draft.notifyChannels.length ? draft.notifyChannels : ["#cb-alerts"],
    };

    onSave(normalized);
  };

  if (!open || !draft) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close alert rule editor"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <form
        onSubmit={handleSave}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-rule-editor-title"
        className="relative z-10 w-full max-w-3xl max-h-[90vh] rounded-2xl border border-tok-border bg-surface-0 shadow-2xl flex flex-col overflow-hidden"
      >
        <header className="px-5 py-4 border-b border-tok-border flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-fg-muted">Alert configuration</p>
            <h2 id="alert-rule-editor-title" className="text-lg font-semibold text-fg-primary mt-0.5">
              Edit rule: {draft.name}
            </h2>
            <p className="text-xs text-fg-muted mt-1">
              Basic operators stay visible by default; advanced settings are grouped in collapsible panels.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-fg-muted hover:text-fg-primary hover:bg-surface-2 transition-colors"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <RulePanel
            title="Rule Basics"
            description="Core identity, priority, and severity metadata."
            expanded={expandedPanels.basics}
            onToggle={() => togglePanel("basics")}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-fg-secondary space-y-1">
                <span>Rule name</span>
                <input
                  value={draft.name}
                  onChange={(event) => updateDraft("name", event.target.value)}
                  className="w-full rounded-lg border border-tok-border bg-surface-2 px-3 py-2 text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Rule name"
                />
              </label>

              <label className="text-xs text-fg-secondary space-y-1">
                <span>Category</span>
                <select
                  value={draft.category}
                  onChange={(event) => updateDraft("category", event.target.value as AlertRuleCategory)}
                  className="w-full rounded-lg border border-tok-border bg-surface-2 px-3 py-2 text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-fg-secondary space-y-1">
                <span>Severity</span>
                <select
                  value={draft.severity}
                  onChange={(event) => updateDraft("severity", event.target.value as AlertRuleSeverity)}
                  className="w-full rounded-lg border border-tok-border bg-surface-2 px-3 py-2 text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {SEVERITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-fg-secondary space-y-1">
                <span>Status</span>
                <button
                  type="button"
                  onClick={() => updateDraft("enabled", !draft.enabled)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    draft.enabled
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-tok-border bg-surface-2 text-fg-muted"
                  )}
                >
                  {draft.enabled ? "Enabled" : "Disabled"}
                </button>
              </label>
            </div>
          </RulePanel>

          <RulePanel
            title="Trigger Condition"
            description="Condition, threshold, and evaluation window shown on the card."
            expanded={expandedPanels.trigger}
            onToggle={() => togglePanel("trigger")}
          >
            <label className="text-xs text-fg-secondary space-y-1 block">
              <span>Condition</span>
              <textarea
                value={draft.condition}
                onChange={(event) => updateDraft("condition", event.target.value)}
                rows={2}
                className="w-full rounded-lg border border-tok-border bg-surface-2 px-3 py-2 text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-fg-secondary space-y-1">
                <span>Threshold</span>
                <input
                  value={draft.threshold}
                  onChange={(event) => updateDraft("threshold", event.target.value)}
                  className="w-full rounded-lg border border-tok-border bg-surface-2 px-3 py-2 text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="80%"
                />
              </label>

              <label className="text-xs text-fg-secondary space-y-1">
                <span>Window</span>
                <input
                  value={draft.window}
                  onChange={(event) => updateDraft("window", event.target.value)}
                  className="w-full rounded-lg border border-tok-border bg-surface-2 px-3 py-2 text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="5m"
                />
              </label>
            </div>
          </RulePanel>

          <RulePanel
            title="Delivery Targets"
            description="Notification destinations shown as target pills under each rule title."
            expanded={expandedPanels.delivery}
            onToggle={() => togglePanel("delivery")}
          >
            <div className="flex flex-wrap gap-1.5">
              {draft.notifyChannels.map((channel) => (
                <span
                  key={channel}
                  className="inline-flex items-center gap-1 rounded-full border border-tok-border bg-surface-2 px-2 py-1 text-[11px] text-fg-primary font-mono"
                >
                  {channel}
                  <button
                    type="button"
                    onClick={() => removeChannel(channel)}
                    className="text-fg-muted hover:text-fg-primary"
                    aria-label={`Remove ${channel}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {draft.notifyChannels.length === 0 && (
                <span className="text-xs text-fg-muted">No delivery targets configured yet.</span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={channelInput}
                onChange={(event) => setChannelInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addChannel(channelInput);
                  }
                }}
                placeholder="Add target, e.g. #ops-alerts or pagerduty"
                className="flex-1 rounded-lg border border-tok-border bg-surface-2 px-3 py-2 text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => addChannel(channelInput)}
                className="rounded-lg px-3 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-fg-primary transition-colors"
              >
                Add target
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {COMMON_CHANNELS.map((channel) => (
                <button
                  key={channel}
                  type="button"
                  onClick={() => addChannel(channel)}
                  className="rounded-full border border-tok-border bg-surface-2 px-2 py-1 text-[11px] text-fg-secondary hover:text-fg-primary transition-colors"
                >
                  {channel}
                </button>
              ))}
            </div>
          </RulePanel>

          <RulePanel
            title="Advanced"
            description="Card telemetry values and diagnostics routing for power users."
            expanded={expandedPanels.advanced}
            onToggle={() => togglePanel("advanced")}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-fg-secondary space-y-1">
                <span>Fired count</span>
                <input
                  type="number"
                  min={0}
                  value={draft.firedCount}
                  onChange={(event) => updateDraft("firedCount", Number(event.target.value) || 0)}
                  className="w-full rounded-lg border border-tok-border bg-surface-2 px-3 py-2 text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="text-xs text-fg-secondary space-y-1">
                <span>Last fired</span>
                <input
                  type="datetime-local"
                  value={toLocalDateTimeInput(draft.lastFired)}
                  onChange={(event) => updateDraft("lastFired", fromLocalDateTimeInput(event.target.value))}
                  className="w-full rounded-lg border border-tok-border bg-surface-2 px-3 py-2 text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="text-xs text-fg-secondary space-y-1">
                <span>Diagnostics view</span>
                <select
                  value={draft.diagnosticsView}
                  onChange={(event) => updateDraft("diagnosticsView", event.target.value as AlertDiagnosticsView)}
                  className="w-full rounded-lg border border-tok-border bg-surface-2 px-3 py-2 text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {DIAGNOSTICS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="text-xs text-fg-secondary flex items-end">
                <button
                  type="button"
                  onClick={() => onOpenDiagnostics?.(draft.diagnosticsView)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-2 text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  Open diagnostics view
                </button>
              </div>
            </div>

            <label className="text-xs text-fg-secondary space-y-1 block">
              <span>Operator notes</span>
              <textarea
                value={draft.notes ?? ""}
                onChange={(event) => updateDraft("notes", event.target.value)}
                rows={2}
                className="w-full rounded-lg border border-tok-border bg-surface-2 px-3 py-2 text-sm text-fg-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Optional context shown in advanced workflows."
              />
            </label>
          </RulePanel>
        </div>

        <footer className="px-5 py-3 border-t border-tok-border bg-surface-1/60 flex items-center justify-between gap-3">
          <p className="text-xs text-fg-muted">Changes apply to the rule card layout and delivery behavior.</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-tok-border px-3 py-1.5 text-xs text-fg-secondary hover:text-fg-primary hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                canSave
                  ? "bg-indigo-600 hover:bg-indigo-500 text-fg-primary"
                  : "bg-surface-2 text-fg-muted cursor-not-allowed"
              )}
            >
              Save rule
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

export default AlertRuleConfigDialog;
