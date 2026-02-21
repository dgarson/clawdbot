"use client";

import * as React from "react";
import {
  ChevronsUpDown,
  Check,
  Cpu,
  Eye,
  Wrench,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useLiveModels, type ModelEntry } from "@/lib/api/gateway-hooks";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Provider config — colors, labels, icons
// ---------------------------------------------------------------------------

interface ProviderMeta {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const PROVIDER_META: Record<string, ProviderMeta> = {
  anthropic: {
    label: "Anthropic",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
  openai: {
    label: "OpenAI",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
  },
  google: {
    label: "Google",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  openrouter: {
    label: "OpenRouter",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
  },
  mistral: {
    label: "Mistral",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
  },
  meta: {
    label: "Meta",
    color: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/20",
  },
  deepseek: {
    label: "DeepSeek",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
  },
  xai: {
    label: "xAI",
    color: "text-neutral-300",
    bgColor: "bg-neutral-500/10",
    borderColor: "border-neutral-500/20",
  },
};

function getProviderMeta(provider: string): ProviderMeta {
  const key = provider.toLowerCase().replace(/[^a-z]/g, "");
  return (
    PROVIDER_META[key] ?? {
      label: provider,
      color: "text-muted-foreground",
      bgColor: "bg-muted/50",
      borderColor: "border-border",
    }
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatContextWindow(tokens?: number): string {
  if (!tokens) return "";
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return `${tokens}`;
}

function getDisplayName(model: ModelEntry): string {
  if (model.name) return model.name;
  // Extract a readable name from the id
  const parts = model.id.split("/");
  const last = parts[parts.length - 1];
  return last
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function groupByProvider(
  models: ModelEntry[],
): Record<string, ModelEntry[]> {
  const groups: Record<string, ModelEntry[]> = {};
  for (const model of models) {
    const key = model.provider || "other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(model);
  }
  // Sort within each group by name
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) =>
      getDisplayName(a).localeCompare(getDisplayName(b)),
    );
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Provider Badge sub-component
// ---------------------------------------------------------------------------

function ProviderBadge({ provider }: { provider: string }) {
  const meta = getProviderMeta(provider);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none border",
        meta.bgColor,
        meta.borderColor,
        meta.color,
      )}
    >
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ModelSelector Component
// ---------------------------------------------------------------------------

export interface ModelSelectorProps {
  /** Currently selected model id, or empty/undefined for system default */
  value?: string;
  /** Called when a model is selected */
  onChange: (modelId: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether to show the "System Default" option */
  showSystemDefault?: boolean;
  /** Disable the selector */
  disabled?: boolean;
  /** Additional CSS class */
  className?: string;
}

export function ModelSelector({
  value,
  onChange,
  placeholder = "Select a model…",
  showSystemDefault = true,
  disabled = false,
  className,
}: ModelSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const { data: modelsResult, isLoading } = useLiveModels();
  const models = modelsResult?.models ?? [];

  // If no models available and not loading, show fallback text input
  const showFallback = !isLoading && models.length === 0;

  // Find the currently selected model
  const selectedModel = models.find((m) => m.id === value);
  const isSystemDefault = !value || value === "";

  // Group models by provider
  const grouped = React.useMemo(() => groupByProvider(models), [models]);
  const providerOrder = React.useMemo(
    () =>
      Object.keys(grouped).sort((a, b) => {
        const metaA = getProviderMeta(a);
        const metaB = getProviderMeta(b);
        return metaA.label.localeCompare(metaB.label);
      }),
    [grouped],
  );

  // ---------------------------------------------------------------------------
  // Fallback: plain text input
  // ---------------------------------------------------------------------------
  if (showFallback) {
    return (
      <div className={cn("space-y-1.5", className)}>
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter model ID (e.g., anthropic/claude-sonnet-4)"
          disabled={disabled}
          className="font-mono text-xs"
        />
        <p className="text-[11px] text-muted-foreground">
          No models available from gateway. Enter a model ID manually.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Full combobox with search
  // ---------------------------------------------------------------------------
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn(
            "w-full justify-between font-normal h-auto min-h-9 py-2",
            !value && "text-muted-foreground",
            className,
          )}
        >
          {isLoading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Cpu className="size-3.5 animate-pulse" />
              Loading models…
            </span>
          ) : isSystemDefault ? (
            <span className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-primary" />
              System Default
            </span>
          ) : selectedModel ? (
            <span className="flex items-center gap-2 min-w-0">
              <ProviderBadge provider={selectedModel.provider} />
              <span className="truncate text-sm">
                {getDisplayName(selectedModel)}
              </span>
              {selectedModel.contextWindow && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatContextWindow(selectedModel.contextWindow)} ctx
                </span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Cpu className="size-3.5" />
              <span className="truncate font-mono text-xs">{value}</span>
            </span>
          )}
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[360px] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search models…" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>No models found.</CommandEmpty>

            {/* System Default option */}
            {showSystemDefault && (
              <>
                <CommandGroup>
                  <CommandItem
                    value="__system_default__"
                    onSelect={() => {
                      onChange("");
                      setOpen(false);
                    }}
                    className="gap-2"
                  >
                    <Sparkles className="size-3.5 text-primary" />
                    <span className="font-medium">System Default</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      Inherits from gateway config
                    </span>
                    {isSystemDefault && (
                      <Check className="size-3.5 text-primary shrink-0" />
                    )}
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* Grouped models */}
            {providerOrder.map((provider) => {
              const meta = getProviderMeta(provider);
              const providerModels = grouped[provider];

              return (
                <CommandGroup
                  key={provider}
                  heading={
                    <span className={cn("flex items-center gap-1.5", meta.color)}>
                      {meta.label}
                      <span className="text-muted-foreground font-normal">
                        ({providerModels.length})
                      </span>
                    </span>
                  }
                >
                  {providerModels.map((model) => {
                    const isSelected = value === model.id;
                    const name = getDisplayName(model);

                    return (
                      <CommandItem
                        key={model.id}
                        value={`${model.provider} ${name} ${model.id}`}
                        onSelect={() => {
                          onChange(model.id);
                          setOpen(false);
                        }}
                        className="gap-2 py-2"
                      >
                        <div className="flex flex-1 items-center gap-2 min-w-0">
                          <span className="truncate text-sm">{name}</span>

                          {/* Capability badges */}
                          <div className="flex items-center gap-1 shrink-0">
                            {model.supportsVision && (
                              <Eye className="size-3 text-muted-foreground" title="Vision" />
                            )}
                            {model.supportsTools && (
                              <Wrench className="size-3 text-muted-foreground" title="Tool use" />
                            )}
                          </div>
                        </div>

                        {/* Context window */}
                        {model.contextWindow && (
                          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                            {formatContextWindow(model.contextWindow)}
                          </span>
                        )}

                        {isSelected && (
                          <Check className="size-3.5 text-primary shrink-0" />
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
