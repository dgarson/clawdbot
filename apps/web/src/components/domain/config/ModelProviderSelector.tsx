"use client";

import * as React from "react";
import { AlertCircle, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { showWarning } from "@/lib/toast";
import type { ModelEntry } from "@/lib/api";

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google Gemini",
  zai: "Z.AI",
  openrouter: "OpenRouter",
};

const PROVIDER_ORDER = ["anthropic", "openai", "google", "zai", "openrouter"];

export interface ModelProviderSelectorProps {
  label?: string;
  helper?: string;
  models: ModelEntry[];
  providerId?: string;
  modelIds?: string[];
  multiple?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  /** List of provider IDs that have API keys configured */
  configuredProviders?: string[];
  /** If true, only show configured providers. If false, show all but indicate unconfigured ones */
  restrictToConfigured?: boolean;
  onChange?: (next: { providerId?: string; modelIds: string[] }) => void;
  className?: string;
}

function toUniqueStringList(values: (string | undefined)[]): string[] {
  const filtered = values.filter((value): value is string => !!value && value.trim().length > 0);
  return Array.from(new Set(filtered));
}

function getProviderLabel(providerId?: string): string {
  if (!providerId) {return "Select provider";}
  return PROVIDER_LABELS[providerId] ?? providerId;
}

export function ModelProviderSelector({
  label = "Model / Provider",
  helper,
  models,
  providerId,
  modelIds = [],
  multiple = false,
  disabled = false,
  emptyLabel = "No models selected",
  configuredProviders = [],
  restrictToConfigured = false,
  onChange,
  className,
}: ModelProviderSelectorProps) {
  const canEdit = !disabled && !!onChange;
  const configuredSet = React.useMemo(() => new Set(configuredProviders), [configuredProviders]);
  const isProviderConfigured = React.useCallback(
    (provider: string) => configuredSet.size === 0 || configuredSet.has(provider),
    [configuredSet]
  );
  const modelIdIndex = React.useMemo(() => {
    const map = new Map<string, ModelEntry>();
    models.forEach((model) => {
      if (!map.has(model.id)) {
        map.set(model.id, model);
      }
    });
    return map;
  }, [models]);
  const modelRefIndex = React.useMemo(() => {
    const map = new Map<string, ModelEntry>();
    models.forEach((model) => {
      map.set(`${model.provider}/${model.id}`, model);
    });
    return map;
  }, [models]);
  const derivedProvider = React.useMemo(() => {
    if (providerId) {return providerId;}
    const firstModel = modelIds[0];
    if (!firstModel) {return undefined;}
    return modelIdIndex.get(firstModel)?.provider;
  }, [modelIds, modelIdIndex, providerId]);

  const activeProvider = providerId ?? derivedProvider;

  const providersWithModels = React.useMemo(() => {
    const ids = new Set<string>();
    models.forEach((model) => {
      if (model.provider) {ids.add(model.provider);}
    });
    return ids;
  }, [models]);

  const providerOptions = React.useMemo(() => {
    const ordered = PROVIDER_ORDER.filter((id) => providersWithModels.has(id));
    const unknown = Array.from(providersWithModels).filter((id) => !PROVIDER_ORDER.includes(id));
    let combined = [...ordered, ...unknown];

    // If restrictToConfigured, only show providers that are configured
    if (restrictToConfigured && configuredSet.size > 0) {
      combined = combined.filter((id) => configuredSet.has(id));
    }

    return combined.length > 0 ? combined : (restrictToConfigured ? [] : PROVIDER_ORDER);
  }, [providersWithModels, restrictToConfigured, configuredSet]);

  const modelsByProvider = React.useMemo(() => {
    const grouped = new Map<string, ModelEntry[]>();
    models.forEach((model) => {
      const provider = model.provider ?? "unknown";
      if (!grouped.has(provider)) {grouped.set(provider, []);}
      grouped.get(provider)!.push(model);
    });
    return grouped;
  }, [models]);

  const availableModels = React.useMemo(() => {
    if (!activeProvider) {return [];}
    return modelsByProvider.get(activeProvider) ?? [];
  }, [activeProvider, modelsByProvider]);

  const selectedModels = toUniqueStringList(modelIds);
  const selectedModelIds = multiple ? selectedModels : selectedModels.slice(0, 1);
  const addableModels = availableModels.filter(
    (model) => !selectedModelIds.includes(model.id)
  );

  const [pendingModelId, setPendingModelId] = React.useState("");

  const isModelInProvider = React.useCallback(
    (modelId: string, provider: string) =>
      models.some((model) => model.id === modelId && model.provider === provider),
    [models]
  );

  const getModelLabel = React.useCallback(
    (modelId: string) => {
      if (activeProvider) {
        return (
          modelRefIndex.get(`${activeProvider}/${modelId}`)?.name ??
          modelIdIndex.get(modelId)?.name ??
          modelId
        );
      }
      return modelIdIndex.get(modelId)?.name ?? modelId;
    },
    [activeProvider, modelIdIndex, modelRefIndex]
  );

  const handleProviderChange = (nextProvider: string) => {
    if (!canEdit) {return;}

    // Warn if selecting an unconfigured provider
    if (!isProviderConfigured(nextProvider)) {
      showWarning("Provider not configured", {
        description: `Add an API key for ${getProviderLabel(nextProvider)} in the Providers section to use this model.`,
        duration: 5000,
      });
    }

    const filtered = selectedModelIds.filter(
      (modelId) => isModelInProvider(modelId, nextProvider)
    );
    onChange?.({ providerId: nextProvider, modelIds: filtered });
  };

  const handleSingleModelChange = (nextModelId: string) => {
    if (!canEdit) {return;}
    const provider =
      (activeProvider && isModelInProvider(nextModelId, activeProvider)
        ? activeProvider
        : modelIdIndex.get(nextModelId)?.provider) ?? activeProvider;
    onChange?.({ providerId: provider, modelIds: [nextModelId] });
  };

  const handleAddModel = (nextModelId: string) => {
    if (!canEdit) {return;}
    const provider =
      (activeProvider && isModelInProvider(nextModelId, activeProvider)
        ? activeProvider
        : modelIdIndex.get(nextModelId)?.provider) ?? activeProvider;
    const nextModels = toUniqueStringList([...selectedModelIds, nextModelId]);
    onChange?.({ providerId: provider, modelIds: nextModels });
    setPendingModelId("");
  };

  const handleRemoveModel = (modelId: string) => {
    if (!canEdit) {return;}
    const nextModels = selectedModelIds.filter((id) => id !== modelId);
    onChange?.({ providerId: activeProvider, modelIds: nextModels });
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1">
        <Label className="text-sm font-medium">{label}</Label>
        {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Provider</Label>
          <Select
            value={activeProvider ?? ""}
            onValueChange={handleProviderChange}
            disabled={!canEdit}
          >
            <SelectTrigger className={cn(
              activeProvider && !isProviderConfigured(activeProvider) && "border-amber-500/50"
            )}>
              <SelectValue placeholder={providerOptions.length === 0 ? "No providers configured" : "Select provider"} />
            </SelectTrigger>
            <SelectContent>
              {providerOptions.length === 0 ? (
                <div className="py-2 px-2 text-sm text-muted-foreground">
                  Configure a provider first
                </div>
              ) : (
                providerOptions.map((provider) => {
                  const configured = isProviderConfigured(provider);
                  return (
                    <SelectItem
                      key={provider}
                      value={provider}
                      className={cn(!configured && "text-muted-foreground")}
                    >
                      <span className="flex items-center gap-2">
                        {getProviderLabel(provider)}
                        {!configured && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="h-3 w-3 text-amber-500" />
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              <p>API key not configured</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                    </SelectItem>
                  );
                })
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {multiple ? "Add model" : "Model"}
          </Label>
          {multiple ? (
            <Select
              value={pendingModelId}
              onValueChange={handleAddModel}
              disabled={!canEdit || !activeProvider}
            >
              <SelectTrigger>
                <SelectValue placeholder={activeProvider ? "Select model" : "Select provider first"} />
              </SelectTrigger>
              <SelectContent>
                {addableModels.length === 0 ? (
                  <div className="py-2 px-2 text-sm text-muted-foreground">
                    No models available
                  </div>
                ) : (
                  addableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={selectedModelIds[0] ?? ""}
              onValueChange={handleSingleModelChange}
              disabled={!canEdit || !activeProvider}
            >
              <SelectTrigger>
                <SelectValue placeholder={activeProvider ? "Select model" : "Select provider first"} />
              </SelectTrigger>
              <SelectContent>
                {availableModels.length === 0 ? (
                  <div className="py-2 px-2 text-sm text-muted-foreground">
                    No models available
                  </div>
                ) : (
                  availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {multiple && (
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Selected models</p>
          {selectedModelIds.length === 0 ? (
            <p className="text-xs text-muted-foreground">{emptyLabel}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedModelIds.map((modelId) => (
                <Badge key={modelId} variant="outline" className="gap-1">
                  {getModelLabel(modelId)}
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveModel(modelId)}
                      className="h-4 w-4 rounded-full"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ModelProviderSelector;
