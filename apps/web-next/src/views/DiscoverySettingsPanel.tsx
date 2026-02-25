import React, { useState, useCallback } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type LogLevel = "debug" | "info" | "warn" | "error";

interface ModelSlot {
  id: string;
  slotName: string;
  model: string;
  fallbackModel: string;
  weightPct: number;
}

interface DiscoverySettings {
  // Wave Config
  waveCount: number;
  agentsPerWave: number;
  waveOverlap: boolean;
  // Model Routing
  modelSlots: ModelSlot[];
  // Cost Controls
  maxCostCap: number | "";
  perAgentCostLimit: number | "";
  autoPauseAt80: boolean;
  // Brave Search
  queriesPerRun: number;
  queriesPerAgent: number;
  dedupThreshold: number;
  // Advanced
  timeoutPerAgent: number;
  retryAttempts: number;
  logLevel: LogLevel;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_MODELS = [
  "claude-sonnet-4-6",
  "claude-opus-4",
  "claude-haiku-3-5",
  "gpt-4o",
  "gpt-4o-mini",
  "o3-mini",
  "gemini-2.0-flash",
  "gemini-pro",
];

const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

const DEFAULT_SETTINGS: DiscoverySettings = {
  waveCount: 3,
  agentsPerWave: 5,
  waveOverlap: false,
  modelSlots: [
    {
      id: "slot-1",
      slotName: "Primary",
      model: "claude-sonnet-4-6",
      fallbackModel: "claude-haiku-3-5",
      weightPct: 70,
    },
    {
      id: "slot-2",
      slotName: "Secondary",
      model: "gpt-4o-mini",
      fallbackModel: "gemini-2.0-flash",
      weightPct: 30,
    },
  ],
  maxCostCap: 10,
  perAgentCostLimit: 2,
  autoPauseAt80: true,
  queriesPerRun: 50,
  queriesPerAgent: 10,
  dedupThreshold: 80,
  timeoutPerAgent: 120,
  retryAttempts: 2,
  logLevel: "info",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return `slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function settingsEqual(a: DiscoverySettings, b: DiscoverySettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] p-5 space-y-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FieldRow({
  label,
  hint,
  children,
  error,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-[var(--color-text-primary)] font-medium">{label}</label>
      {hint && <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-800",
        checked ? "bg-primary" : "bg-[var(--color-surface-3)]"
      )}
      aria-pressed={checked}
      aria-label={label}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
  className,
}: {
  value: number | "";
  onChange: (v: number | "") => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") {
          onChange("");
        } else {
          const n = parseFloat(raw);
          if (!isNaN(n)) {onChange(n);}
        }
      }}
      className={cn(
        "w-full rounded-md bg-[var(--color-surface-3)] border border-[var(--color-surface-3)] text-[var(--color-text-primary)] px-3 py-1.5 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
        "placeholder:text-[var(--color-text-muted)]",
        className
      )}
    />
  );
}

function SliderInput({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-indigo-500 cursor-pointer"
      />
      <span className="w-8 text-right text-sm font-mono text-[var(--color-text-primary)]">
        {value}
      </span>
    </div>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: T[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(
        "rounded-md bg-[var(--color-surface-3)] border border-[var(--color-surface-3)] text-[var(--color-text-primary)] px-3 py-1.5 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
        className
      )}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

// ─── Model Routing Table ──────────────────────────────────────────────────────

function ModelRoutingTable({
  slots,
  onChange,
}: {
  slots: ModelSlot[];
  onChange: (slots: ModelSlot[]) => void;
}) {
  const update = useCallback(
    (id: string, patch: Partial<ModelSlot>) => {
      onChange(slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    },
    [slots, onChange]
  );

  const addRow = () => {
    onChange([
      ...slots,
      {
        id: uid(),
        slotName: `Slot ${slots.length + 1}`,
        model: AVAILABLE_MODELS[0],
        fallbackModel: AVAILABLE_MODELS[1],
        weightPct: 0,
      },
    ]);
  };

  const removeRow = (id: string) => {
    onChange(slots.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
        <table className="w-full text-sm text-[var(--color-text-primary)] min-w-[540px]">
          <thead className="bg-[var(--color-surface-3)]/60">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-[var(--color-text-secondary)] text-xs uppercase">
                Slot Name
              </th>
              <th className="px-3 py-2 text-left font-medium text-[var(--color-text-secondary)] text-xs uppercase">
                Model
              </th>
              <th className="px-3 py-2 text-left font-medium text-[var(--color-text-secondary)] text-xs uppercase">
                Fallback
              </th>
              <th className="px-3 py-2 text-left font-medium text-[var(--color-text-secondary)] text-xs uppercase">
                Weight %
              </th>
              <th className="px-3 py-2 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {slots.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-4 text-center text-[var(--color-text-muted)] text-xs"
                >
                  No model slots configured. Add one below.
                </td>
              </tr>
            )}
            {slots.map((slot) => (
              <tr key={slot.id} className="hover:bg-[var(--color-surface-3)]/30 transition-colors">
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={slot.slotName}
                    onChange={(e) =>
                      update(slot.id, { slotName: e.target.value })
                    }
                    className="w-full bg-transparent border-b border-[var(--color-surface-3)] focus:border-primary text-[var(--color-text-primary)] text-sm px-1 py-0.5 outline-none"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Select
                    value={slot.model}
                    onChange={(v) => update(slot.id, { model: v })}
                    options={AVAILABLE_MODELS}
                    className="w-full"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Select
                    value={slot.fallbackModel}
                    onChange={(v) => update(slot.id, { fallbackModel: v })}
                    options={AVAILABLE_MODELS}
                    className="w-full"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <NumberInput
                    value={slot.weightPct}
                    onChange={(v) =>
                      update(slot.id, { weightPct: v === "" ? 0 : v })
                    }
                    min={0}
                    max={100}
                    className="w-20"
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(slot.id)}
                    className="text-[var(--color-text-muted)] hover:text-red-400 transition-colors text-xs px-1"
                    aria-label="Remove row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="text-xs text-primary hover:text-indigo-300 transition-colors flex items-center gap-1"
      >
        <span className="text-base leading-none">+</span> Add model slot
      </button>
    </div>
  );
}

// ─── Validation ───────────────────────────────────────────────────────────────

interface ValidationErrors {
  maxCostCap?: string;
  waveCount?: string;
}

function validate(s: DiscoverySettings): ValidationErrors {
  const errors: ValidationErrors = {};
  if (s.maxCostCap === "" || Number(s.maxCostCap) <= 0) {
    errors.maxCostCap = "Max cost cap must be greater than $0.";
  }
  if (!s.waveCount || s.waveCount < 1) {
    errors.waveCount = "Wave count is required (1–5).";
  }
  return errors;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DiscoverySettingsPanel() {
  const [saved, setSaved] = useState<DiscoverySettings>(DEFAULT_SETTINGS);
  const [form, setForm] = useState<DiscoverySettings>(DEFAULT_SETTINGS);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const isDirty = !settingsEqual(form, saved);

  const patch = useCallback(
    <K extends keyof DiscoverySettings>(key: K, value: DiscoverySettings[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSave = () => {
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {return;}
    setSaved(form);
    setErrors({});
  };

  const handleReset = () => {
    setForm(saved);
    setErrors({});
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-1)] text-[var(--color-text-primary)] p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
              Discovery Settings
            </h1>
            {isDirty && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={!isDirty}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium border transition-colors",
                isDirty
                  ? "border-[var(--color-surface-3)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed"
              )}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-md text-sm font-medium bg-primary hover:bg-primary text-[var(--color-text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
            >
              Save
            </button>
          </div>
        </div>

        {/* ── 1. Wave Config ── */}
        <SectionCard title="Wave Config">
          <FieldRow
            label={`Wave Count — ${form.waveCount}`}
            hint="Number of sequential agent waves to run."
            error={errors.waveCount}
          >
            <SliderInput
              value={form.waveCount}
              onChange={(v) => patch("waveCount", v)}
              min={1}
              max={5}
              label="Wave count"
            />
          </FieldRow>
          <FieldRow
            label={`Agents per Wave — ${form.agentsPerWave}`}
            hint="How many agents are spawned in each wave."
          >
            <SliderInput
              value={form.agentsPerWave}
              onChange={(v) => patch("agentsPerWave", v)}
              min={1}
              max={20}
              label="Agents per wave"
            />
          </FieldRow>
          <FieldRow
            label="Wave Overlap"
            hint="Allow the next wave to start before the current one finishes."
          >
            <div className="flex items-center gap-3">
              <Toggle
                checked={form.waveOverlap}
                onChange={(v) => patch("waveOverlap", v)}
                label="Wave overlap"
              />
              <span className="text-xs text-[var(--color-text-secondary)]">
                {form.waveOverlap ? "Enabled" : "Disabled"}
              </span>
            </div>
          </FieldRow>
        </SectionCard>

        {/* ── 2. Model Routing ── */}
        <SectionCard title="Model Routing">
          <p className="text-xs text-[var(--color-text-muted)]">
            Define model slots with weights. Weights are advisory — total need not
            sum to 100%.
          </p>
          <ModelRoutingTable
            slots={form.modelSlots}
            onChange={(slots) => patch("modelSlots", slots)}
          />
        </SectionCard>

        {/* ── 3. Cost Controls ── */}
        <SectionCard title="Cost Controls">
          <div className="grid grid-cols-2 gap-4">
            <FieldRow
              label="Max Cost Cap ($)"
              hint="Hard ceiling for the entire run."
              error={errors.maxCostCap}
            >
              <NumberInput
                value={form.maxCostCap}
                onChange={(v) => patch("maxCostCap", v)}
                min={0.01}
                step={0.5}
                placeholder="e.g. 10.00"
              />
            </FieldRow>
            <FieldRow
              label="Per-Agent Cost Limit ($)"
              hint="Each agent is killed if it exceeds this."
            >
              <NumberInput
                value={form.perAgentCostLimit}
                onChange={(v) => patch("perAgentCostLimit", v)}
                min={0.01}
                step={0.1}
                placeholder="e.g. 2.00"
              />
            </FieldRow>
          </div>
          <FieldRow
            label="Auto-pause at 80% of cap"
            hint="Pause the run and notify when spend reaches 80% of the cost cap."
          >
            <div className="flex items-center gap-3">
              <Toggle
                checked={form.autoPauseAt80}
                onChange={(v) => patch("autoPauseAt80", v)}
                label="Auto-pause at 80%"
              />
              <span className="text-xs text-[var(--color-text-secondary)]">
                {form.autoPauseAt80 ? "Enabled" : "Disabled"}
              </span>
            </div>
          </FieldRow>
        </SectionCard>

        {/* ── 4. Brave Search ── */}
        <SectionCard title="Brave Search">
          <div className="grid grid-cols-2 gap-4">
            <FieldRow
              label="Queries per Run"
              hint="Max total Brave queries across all agents."
            >
              <NumberInput
                value={form.queriesPerRun}
                onChange={(v) => patch("queriesPerRun", v === "" ? 0 : v)}
                min={1}
                placeholder="e.g. 50"
              />
            </FieldRow>
            <FieldRow
              label="Queries per Agent"
              hint="Max queries a single agent may make."
            >
              <NumberInput
                value={form.queriesPerAgent}
                onChange={(v) => patch("queriesPerAgent", v === "" ? 0 : v)}
                min={1}
                placeholder="e.g. 10"
              />
            </FieldRow>
          </div>
          <FieldRow
            label={`Dedup Threshold — ${form.dedupThreshold}%`}
            hint="Results with similarity above this threshold are treated as duplicates."
          >
            <SliderInput
              value={form.dedupThreshold}
              onChange={(v) => patch("dedupThreshold", v)}
              min={0}
              max={100}
              label="Dedup threshold"
            />
          </FieldRow>
        </SectionCard>

        {/* ── 5. Advanced ── */}
        <SectionCard title="Advanced">
          <div className="grid grid-cols-2 gap-4">
            <FieldRow
              label="Timeout per Agent (s)"
              hint="Hard wall-clock timeout per agent."
            >
              <NumberInput
                value={form.timeoutPerAgent}
                onChange={(v) => patch("timeoutPerAgent", v === "" ? 0 : v)}
                min={10}
                step={10}
                placeholder="e.g. 120"
              />
            </FieldRow>
            <FieldRow
              label={`Retry Attempts — ${form.retryAttempts}`}
              hint="How many times to retry a failed agent (0–3)."
            >
              <SliderInput
                value={form.retryAttempts}
                onChange={(v) => patch("retryAttempts", v)}
                min={0}
                max={3}
                label="Retry attempts"
              />
            </FieldRow>
          </div>
          <FieldRow label="Log Level" hint="Verbosity of agent run logs.">
            <Select<LogLevel>
              value={form.logLevel}
              onChange={(v) => patch("logLevel", v)}
              options={LOG_LEVELS}
              className="w-40"
            />
          </FieldRow>
        </SectionCard>

        {/* ── Footer save strip ── */}
        {isDirty && (
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-indigo-950/40 px-5 py-3">
            <p className="text-sm text-indigo-300">
              You have unsaved changes.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-1.5 rounded-md text-xs font-medium bg-primary hover:bg-primary text-[var(--color-text-primary)] transition-colors"
              >
                Save changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
