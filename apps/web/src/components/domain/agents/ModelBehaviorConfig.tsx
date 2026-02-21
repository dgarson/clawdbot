"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Thermometer,
  AlignLeft,
  Lightbulb,
  Radio,
  ChevronDown,
  Settings2,
  X,
  GripVertical,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ModelSelector } from "./ModelSelector";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelBehaviorSettings {
  // Simple settings
  model?: string;
  temperature?: number;
  maxTokens?: number;
  thinking?: "off" | "low" | "medium" | "high";
  streaming?: boolean;

  // Advanced settings
  fallbackModels?: string[];
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  systemPrompt?: string;
}

/** Tracks which fields are overridden vs. using system default */
export interface OverrideFlags {
  model: boolean;
  temperature: boolean;
  maxTokens: boolean;
  thinking: boolean;
  streaming: boolean;
  fallbackModels: boolean;
  topP: boolean;
  topK: boolean;
  frequencyPenalty: boolean;
  systemPrompt: boolean;
}

export interface ModelBehaviorConfigProps {
  /** Current settings */
  settings: ModelBehaviorSettings;
  /** Called when any setting changes */
  onChange: (settings: ModelBehaviorSettings) => void;
  /** Which fields are overridden from system default */
  overrides?: Partial<OverrideFlags>;
  /** Called when an override toggle changes */
  onOverrideChange?: (field: keyof OverrideFlags, enabled: boolean) => void;
  /** Is the form in a saving/loading state */
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: Required<ModelBehaviorSettings> = {
  model: "",
  temperature: 0.7,
  maxTokens: 4096,
  thinking: "off",
  streaming: true,
  fallbackModels: [],
  topP: 1.0,
  topK: 0,
  frequencyPenalty: 0,
  systemPrompt: "",
};

const DEFAULT_OVERRIDES: OverrideFlags = {
  model: false,
  temperature: false,
  maxTokens: false,
  thinking: false,
  streaming: false,
  fallbackModels: false,
  topP: false,
  topK: false,
  frequencyPenalty: false,
  systemPrompt: false,
};

// ---------------------------------------------------------------------------
// Creativity helpers
// ---------------------------------------------------------------------------

function getCreativityLabel(temp: number): string {
  if (temp <= 0.1) return "Precise";
  if (temp <= 0.3) return "Focused";
  if (temp <= 0.5) return "Balanced";
  if (temp <= 0.7) return "Expressive";
  if (temp <= 0.9) return "Creative";
  return "Wild";
}

function getCreativityColor(temp: number): string {
  if (temp <= 0.3) return "text-blue-400";
  if (temp <= 0.6) return "text-indigo-400";
  if (temp <= 0.8) return "text-orange-400";
  return "text-red-400";
}

// ---------------------------------------------------------------------------
// Response length helpers
// ---------------------------------------------------------------------------

function getResponseLengthLabel(tokens: number): string {
  if (tokens <= 512) return "Brief";
  if (tokens <= 1024) return "Concise";
  if (tokens <= 2048) return "Moderate";
  if (tokens <= 4096) return "Thorough";
  if (tokens <= 8192) return "Detailed";
  return "Extensive";
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(tokens % 1000 === 0 ? 0 : 1)}K`;
  return `${tokens}`;
}

// ---------------------------------------------------------------------------
// Thinking level helpers
// ---------------------------------------------------------------------------

const THINKING_LEVELS = [
  { value: "off" as const, label: "Off", description: "No reasoning trace" },
  { value: "low" as const, label: "Low", description: "Brief internal reasoning" },
  { value: "medium" as const, label: "Medium", description: "Standard reasoning depth" },
  { value: "high" as const, label: "High", description: "Deep, thorough reasoning" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A setting row with a label, override toggle, and content */
function SettingRow({
  icon,
  label,
  description,
  overrideKey,
  isOverridden,
  onOverrideChange,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  overrideKey: keyof OverrideFlags;
  isOverridden: boolean;
  onOverrideChange?: (field: keyof OverrideFlags, enabled: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      layout
      className="space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="text-muted-foreground shrink-0">{icon}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{label}</span>
              {!isOverridden && (
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 text-muted-foreground border-border"
                >
                  Default
                </Badge>
              )}
            </div>
            {description && (
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">
                  {isOverridden ? "Custom" : "System"}
                </span>
                <Switch
                  size="sm"
                  checked={isOverridden}
                  onCheckedChange={(checked) =>
                    onOverrideChange?.(overrideKey, checked)
                  }
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{isOverridden ? "Using custom value" : "Using system default"}</p>
              <p className="text-muted-foreground">
                Toggle to {isOverridden ? "revert to system default" : "customize for this agent"}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <AnimatePresence>
        {isOverridden && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** The gradient creativity slider */
function CreativitySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const label = getCreativityLabel(value);
  const color = getCreativityColor(value);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium", color)}>{label}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            ({value.toFixed(2)})
          </span>
        </div>
        <div className="flex gap-1 text-[10px] text-muted-foreground">
          <span>Precise</span>
          <span>→</span>
          <span>Creative</span>
        </div>
      </div>

      {/* Gradient track slider */}
      <div className="relative">
        {/* Gradient background behind the slider track */}
        <div
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, #3b82f6, #6366f1, #8b5cf6, #d97706, #ef4444)",
          }}
        />
        <Slider
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={0}
          max={1}
          step={0.05}
          className="relative [&_[data-slot=slider-track]]:bg-transparent [&_[data-slot=slider-range]]:bg-transparent"
        />
      </div>
    </div>
  );
}

/** Response length slider */
function ResponseLengthSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const label = getResponseLengthLabel(value);

  // Use logarithmic-ish scale for better UX
  const STEPS = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768];
  const currentStep = STEPS.reduce(
    (closest, step, i) =>
      Math.abs(step - value) < Math.abs(STEPS[closest] - value) ? i : closest,
    0,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            ({formatTokenCount(value)} tokens)
          </span>
        </div>
        <div className="flex gap-1 text-[10px] text-muted-foreground">
          <span>Brief</span>
          <span>→</span>
          <span>Detailed</span>
        </div>
      </div>

      <Slider
        value={[currentStep]}
        onValueChange={([stepIdx]) => onChange(STEPS[stepIdx])}
        min={0}
        max={STEPS.length - 1}
        step={1}
      />
    </div>
  );
}

/** Thinking level selector */
function ThinkingSelector({
  value,
  onChange,
}: {
  value: "off" | "low" | "medium" | "high";
  onChange: (v: "off" | "low" | "medium" | "high") => void;
}) {
  return (
    <div className="flex gap-1.5">
      {THINKING_LEVELS.map((level) => (
        <Tooltip key={level.value}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onChange(level.value)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                value === level.value
                  ? level.value === "off"
                    ? "bg-muted border-border text-foreground"
                    : "bg-primary/10 border-primary/30 text-primary"
                  : "border-border text-muted-foreground hover:border-border hover:bg-muted/50",
              )}
            >
              {level.label}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{level.description}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

/** Fallback models list */
function FallbackModelsList({
  models,
  onChange,
}: {
  models: string[];
  onChange: (models: string[]) => void;
}) {
  const addModel = (modelId: string) => {
    if (modelId && !models.includes(modelId)) {
      onChange([...models, modelId]);
    }
  };

  const removeModel = (index: number) => {
    onChange(models.filter((_, i) => i !== index));
  };

  const moveModel = (index: number, direction: "up" | "down") => {
    const newModels = [...models];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newModels.length) return;
    [newModels[index], newModels[targetIndex]] = [
      newModels[targetIndex],
      newModels[index],
    ];
    onChange(newModels);
  };

  return (
    <div className="space-y-3">
      {models.length > 0 && (
        <div className="space-y-1.5">
          {models.map((modelId, index) => (
            <motion.div
              key={modelId}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
            >
              <GripVertical className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-mono truncate flex-1">{modelId}</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0">
                #{index + 1}
              </Badge>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-6 p-0"
                  disabled={index === 0}
                  onClick={() => moveModel(index, "up")}
                >
                  <ArrowUp className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-6 p-0"
                  disabled={index === models.length - 1}
                  onClick={() => moveModel(index, "down")}
                >
                  <ArrowDown className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-6 p-0 text-destructive hover:text-destructive"
                  onClick={() => removeModel(index)}
                >
                  <X className="size-3" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="pt-1">
        <ModelSelector
          value=""
          onChange={(id) => addModel(id)}
          showSystemDefault={false}
          placeholder="Add fallback model…"
        />
      </div>

      {models.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          No fallback models configured. If the primary model fails, the request
          will not be retried with a different model.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ModelBehaviorConfig({
  settings,
  onChange,
  overrides: overridesProp,
  onOverrideChange,
  isLoading,
}: ModelBehaviorConfigProps) {
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const overrides: OverrideFlags = { ...DEFAULT_OVERRIDES, ...overridesProp };

  // Merge with defaults for display
  const current: Required<ModelBehaviorSettings> = {
    ...DEFAULT_SETTINGS,
    ...settings,
  };

  // Helper to update a single field
  const updateField = <K extends keyof ModelBehaviorSettings>(
    field: K,
    value: ModelBehaviorSettings[K],
  ) => {
    onChange({ ...settings, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Primary Model Card */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="size-5" />
            Model & Behavior
          </CardTitle>
          <CardDescription>
            Choose the AI model and tune how this agent generates responses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Model Selection */}
          <SettingRow
            icon={<Brain className="size-4" />}
            label="Model"
            description="Which AI model powers this agent"
            overrideKey="model"
            isOverridden={overrides.model}
            onOverrideChange={onOverrideChange}
          >
            <ModelSelector
              value={current.model}
              onChange={(id) => updateField("model", id)}
            />
          </SettingRow>

          <Separator />

          {/* Creativity (Temperature) */}
          <SettingRow
            icon={<Thermometer className="size-4" />}
            label="Creativity"
            description="How much variety and imagination in responses"
            overrideKey="temperature"
            isOverridden={overrides.temperature}
            onOverrideChange={onOverrideChange}
          >
            <CreativitySlider
              value={current.temperature}
              onChange={(v) => updateField("temperature", v)}
            />
          </SettingRow>

          <Separator />

          {/* Response Length (Max Tokens) */}
          <SettingRow
            icon={<AlignLeft className="size-4" />}
            label="Response Length"
            description="How long the agent's responses can be"
            overrideKey="maxTokens"
            isOverridden={overrides.maxTokens}
            onOverrideChange={onOverrideChange}
          >
            <ResponseLengthSlider
              value={current.maxTokens}
              onChange={(v) => updateField("maxTokens", v)}
            />
          </SettingRow>

          <Separator />

          {/* Thinking */}
          <SettingRow
            icon={<Lightbulb className="size-4" />}
            label="Thinking"
            description="Whether the model reasons through problems step-by-step"
            overrideKey="thinking"
            isOverridden={overrides.thinking}
            onOverrideChange={onOverrideChange}
          >
            <ThinkingSelector
              value={current.thinking}
              onChange={(v) => updateField("thinking", v)}
            />
          </SettingRow>

          <Separator />

          {/* Streaming */}
          <SettingRow
            icon={<Radio className="size-4" />}
            label="Streaming"
            description="Show responses word-by-word as they're generated"
            overrideKey="streaming"
            isOverridden={overrides.streaming}
            onOverrideChange={onOverrideChange}
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={current.streaming}
                onCheckedChange={(v) => updateField("streaming", v)}
              />
              <span className="text-sm text-muted-foreground">
                {current.streaming ? "Responses stream in real-time" : "Responses appear all at once"}
              </span>
            </div>
          </SettingRow>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Advanced Settings Accordion */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/30 transition-colors rounded-xl"
        >
          <div className="flex items-center gap-2.5">
            <Settings2 className="size-5 text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold leading-none tracking-tight">
                Advanced Settings
              </h3>
              <p className="text-sm text-muted-foreground mt-1.5">
                Fine-grained model parameters for advanced users
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: advancedOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="size-5 text-muted-foreground" />
          </motion.div>
        </button>

        <AnimatePresence>
          {advancedOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <Separator />
              <CardContent className="pt-6 space-y-6">
                {/* Fallback Models */}
                <SettingRow
                  icon={<RotateCcw className="size-4" />}
                  label="Fallback Models"
                  description="Models to try if the primary model is unavailable (in order)"
                  overrideKey="fallbackModels"
                  isOverridden={overrides.fallbackModels}
                  onOverrideChange={onOverrideChange}
                >
                  <FallbackModelsList
                    models={current.fallbackModels}
                    onChange={(v) => updateField("fallbackModels", v)}
                  />
                </SettingRow>

                <Separator />

                {/* Top-P */}
                <SettingRow
                  icon={<Info className="size-4" />}
                  label="Top-P (Nucleus Sampling)"
                  description="Controls diversity by limiting to the most likely tokens that sum to this probability"
                  overrideKey="topP"
                  isOverridden={overrides.topP}
                  onOverrideChange={onOverrideChange}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium tabular-nums">
                        {current.topP.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        0.0 (narrow) → 1.0 (full)
                      </span>
                    </div>
                    <Slider
                      value={[current.topP]}
                      onValueChange={([v]) => updateField("topP", v)}
                      min={0}
                      max={1}
                      step={0.05}
                    />
                  </div>
                </SettingRow>

                <Separator />

                {/* Top-K */}
                <SettingRow
                  icon={<Info className="size-4" />}
                  label="Top-K"
                  description="Limits sampling to the K most likely next tokens (0 = disabled)"
                  overrideKey="topK"
                  isOverridden={overrides.topK}
                  onOverrideChange={onOverrideChange}
                >
                  <Input
                    type="number"
                    min={0}
                    max={1000}
                    value={current.topK}
                    onChange={(e) =>
                      updateField("topK", Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                    className="w-32 tabular-nums"
                  />
                </SettingRow>

                <Separator />

                {/* Frequency Penalty */}
                <SettingRow
                  icon={<Info className="size-4" />}
                  label="Frequency Penalty"
                  description="Reduces repetition by penalizing tokens that appear frequently"
                  overrideKey="frequencyPenalty"
                  isOverridden={overrides.frequencyPenalty}
                  onOverrideChange={onOverrideChange}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium tabular-nums">
                        {current.frequencyPenalty.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        0.0 (no penalty) → 2.0 (strong penalty)
                      </span>
                    </div>
                    <Slider
                      value={[current.frequencyPenalty]}
                      onValueChange={([v]) => updateField("frequencyPenalty", v)}
                      min={0}
                      max={2}
                      step={0.05}
                    />
                  </div>
                </SettingRow>

                <Separator />

                {/* System Prompt Override */}
                <SettingRow
                  icon={<AlignLeft className="size-4" />}
                  label="System Prompt Override"
                  description="Append to or replace the system prompt generated from agent files"
                  overrideKey="systemPrompt"
                  isOverridden={overrides.systemPrompt}
                  onOverrideChange={onOverrideChange}
                >
                  <Textarea
                    value={current.systemPrompt}
                    onChange={(e) => updateField("systemPrompt", e.target.value)}
                    placeholder="Additional system prompt instructions…"
                    rows={5}
                    className="font-mono text-xs resize-y"
                  />
                  <p className="text-[11px] text-muted-foreground mt-2">
                    This is appended after the auto-generated system prompt from SOUL.md, AGENTS.md, etc.
                  </p>
                </SettingRow>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}
