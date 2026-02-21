
import * as React from "react";
import { Brain, ChevronDown, FlaskConical, Settings, Sparkles } from "lucide-react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ModelProviderConfig, ModelProviderSelector } from "@/components/domain/config";
import { useConfig } from "@/hooks/queries/useConfig";
import { useModelsByProvider } from "@/hooks/queries/useModels";
import { usePatchConfig } from "@/hooks/mutations/useConfigMutations";
import { useUIStore } from "@/stores/useUIStore";
import type { AuthConfig, ModelEntry, ModelProviderId } from "@/lib/api";

const MODEL_PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models",
    color: "text-[#D97757]",
    bgColor: "bg-[#D97757]/10",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT models",
    color: "text-[#10A37F]",
    bgColor: "bg-[#10A37F]/10",
  },
  {
    id: "google",
    name: "Google Gemini",
    description: "Gemini models",
    color: "text-[#4285F4]",
    bgColor: "bg-[#4285F4]/10",
  },
  {
    id: "zai",
    name: "Z.AI",
    description: "Grok models",
    color: "text-[#1DA1F2]",
    bgColor: "bg-[#1DA1F2]/10",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Multi-provider access",
    color: "text-[#9333EA]",
    bgColor: "bg-[#9333EA]/10",
  },
] as const;

type ProviderMeta = (typeof MODEL_PROVIDERS)[number];
type RuntimeValue = "pi" | "claude";

interface AgentsDefaultsConfig {
  runtime?: "pi" | "claude";
  mainRuntime?: "pi" | "claude";
  model?: {
    primary?: string;
    fallbacks?: string[];
  };
  imageModel?: {
    primary?: string;
    fallbacks?: string[];
  };
  models?: Record<
    string,
    {
      alias?: string;
      params?: Record<string, unknown>;
      [key: string]: unknown;
    }
  >;
  blockStreamingDefault?: "off" | "on";
  heartbeat?: {
    every?: string;
    activeHours?: {
      start?: string;
      end?: string;
      timezone?: string;
      [key: string]: unknown;
    };
    model?: string;
    target?: string;
    [key: string]: unknown;
  };
  mainCcsdkProvider?: string;
  ccsdkProvider?: string;
  [key: string]: unknown;
}

interface AgentsMainConfig {
  runtime?: string;
  sdk?: {
    model?: string;
    thinkingBudget?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface AgentsConfigExtended {
  defaults?: AgentsDefaultsConfig;
  main?: AgentsMainConfig;
  [key: string]: unknown;
}

interface ModelProviderSectionProps {
  className?: string;
}

const runtimeOptions: { value: RuntimeValue; label: string; helper: string }[] = [
  {
    value: "pi",
    label: "Pi (recommended)",
    helper: "Keeps conversation memory",
  },
  {
    value: "claude",
    label: "Claude Code SDK (advanced)",
    helper: "Stateless but fast",
  },
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function toNumberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {return undefined;}
  const values = value.filter((item): item is string => typeof item === "string");
  return values.length > 0 ? values : undefined;
}

function splitModelRef(value?: string): { provider?: string; modelId?: string } {
  if (!value) {return {};}
  const trimmed = value.trim();
  if (!trimmed) {return {};}
  const parts = trimmed.split("/");
  if (parts.length <= 1) {
    return { modelId: trimmed };
  }
  return { provider: parts[0], modelId: parts.slice(1).join("/") };
}

function buildModelRef(provider?: string, modelId?: string): string | undefined {
  if (!modelId) {return undefined;}
  if (!provider) {return modelId;}
  return `${provider}/${modelId}`;
}

function normalizeRuntime(value?: string): RuntimeValue | undefined {
  if (!value) {return undefined;}
  const lowered = value.toLowerCase();
  if (lowered.includes("pi")) {return "pi";}
  if (lowered.includes("sdk")) {return "claude";}
  return undefined;
}

function formatScheduleLabel(schedule: unknown): string {
  if (!schedule) {return "Not configured";}
  if (typeof schedule === "string") {
    return schedule.startsWith("Every ") ? schedule : `Every ${schedule}`;
  }
  if (typeof schedule === "number") {return `Every ${schedule} minutes`;}
  if (isPlainObject(schedule)) {
    const every = toStringValue(schedule.every) ?? toStringValue(schedule.interval) ?? toStringValue(schedule.cron);
    const everyNumber = toNumberValue(schedule.every) ?? toNumberValue(schedule.interval);
    if (every) {return every.startsWith("Every ") ? every : `Every ${every}`;}
    if (everyNumber !== undefined) {return `Every ${everyNumber} minutes`;}
    return "Custom schedule";
  }
  return "Custom schedule";
}

function formatActiveHoursLabel(activeHours: unknown): string {
  if (!activeHours) {return "Not set";}
  if (typeof activeHours === "string") {return activeHours;}
  if (isPlainObject(activeHours)) {
    const start = toStringValue(activeHours.start) ?? toStringValue(activeHours.from);
    const end = toStringValue(activeHours.end) ?? toStringValue(activeHours.to);
    const timezone = toStringValue(activeHours.timezone) ?? toStringValue(activeHours.tz);
    if (start && end) {
      return `${start}-${end}${timezone ? ` ${timezone}` : ""}`;
    }
    if (start || end) {
      return `${start ?? "?"}-${end ?? "?"}${timezone ? ` ${timezone}` : ""}`;
    }
  }
  return "Custom hours";
}

function getProviderLabel(providerId?: string): string | undefined {
  if (!providerId) {return undefined;}
  return MODEL_PROVIDERS.find((provider) => provider.id === providerId)?.name ?? providerId;
}

function getModelLabel(
  modelRef: string | undefined,
  modelRefIndex: Map<string, ModelEntry>,
  modelIdIndex: Map<string, ModelEntry>
): string {
  if (!modelRef) {return "Not set";}
  const { provider, modelId } = splitModelRef(modelRef);
  if (provider && modelId) {
    return modelRefIndex.get(`${provider}/${modelId}`)?.name ?? modelId;
  }
  if (modelId) {
    return modelIdIndex.get(modelId)?.name ?? modelId;
  }
  return modelRef;
}

function getModelProvider(
  modelRef: string | undefined,
  modelRefIndex: Map<string, ModelEntry>,
  modelIdIndex: Map<string, ModelEntry>
): string | undefined {
  if (!modelRef) {return undefined;}
  const { provider, modelId } = splitModelRef(modelRef);
  if (provider && modelId) {
    return modelRefIndex.get(`${provider}/${modelId}`)?.provider ?? provider;
  }
  if (modelId) {
    return modelIdIndex.get(modelId)?.provider;
  }
  return provider;
}

function hasProviderKey(auth: AuthConfig | undefined, providerId: ModelProviderId): boolean {
  if (!auth) {return false;}
  const keyMap: Record<ModelProviderId, keyof AuthConfig> = {
    anthropic: "anthropic",
    openai: "openai",
    google: "google",
    zai: "xai",
    openrouter: "openrouter",
  };
  const authEntry = auth[keyMap[providerId]];
  return typeof authEntry?.apiKey === "string" && authEntry.apiKey.length > 0;
}

function InheritsBadge({ label = "Inherits from System Brain" }: { label?: string }) {
  return (
    <Badge variant="secondary" className="text-xs">
      {label}
    </Badge>
  );
}

function ValueRow({
  label,
  helper,
  value,
  badge,
  loading,
}: {
  label: string;
  helper?: string;
  value: React.ReactNode;
  badge?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">{label}</Label>
        {badge}
      </div>
      {loading ? <Skeleton className="h-4 w-32" /> : value}
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

function RuntimeChoice({
  option,
  selected,
  disabled = false,
  onSelect,
}: {
  option: { value: RuntimeValue; label: string; helper: string };
  selected: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        disabled && "cursor-not-allowed opacity-70 hover:border-border"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="font-medium">{option.label}</p>
          <p className="text-xs text-muted-foreground">{option.helper}</p>
        </div>
        {selected && (
          <Badge variant="success" className="text-xs">
            Selected
          </Badge>
        )}
      </div>
    </button>
  );
}

function ProviderCard({
  provider,
  connected,
  models,
  loading,
  onConnect,
  onTest,
}: {
  provider: ProviderMeta;
  connected: boolean;
  models: ModelEntry[];
  loading?: boolean;
  onConnect: () => void;
  onTest: () => void;
}) {
  const [modelsExpanded, setModelsExpanded] = React.useState(false);
  const modelsCount = models.length;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                provider.bgColor
              )}
            >
              <span className={cn("font-semibold text-sm", provider.color)}>
                {provider.name.charAt(0)}
              </span>
            </div>
            <div>
              <CardTitle className="text-base">{provider.name}</CardTitle>
              <CardDescription className="text-xs">{provider.description}</CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {loading ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <Badge variant={connected ? "success" : "warning"} className="text-xs">
                {connected ? "Connected" : "Missing key"}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onTest}
              disabled={!connected}
              className="h-7 text-xs"
            >
              Test
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Models available - expandable */}
        <Collapsible.Root open={modelsExpanded} onOpenChange={setModelsExpanded}>
          <Collapsible.Trigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
            >
              <span className="text-muted-foreground">Models available</span>
              <div className="flex items-center gap-2">
                {loading ? (
                  <Skeleton className="h-5 w-8" />
                ) : (
                  <span className={cn(
                    "rounded-md px-2 py-0.5 font-medium",
                    modelsCount > 0 ? provider.bgColor : "bg-muted",
                    modelsCount > 0 ? provider.color : "text-muted-foreground"
                  )}>
                    {modelsCount}
                  </span>
                )}
                <motion.div
                  animate={{ rotate: modelsExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </motion.div>
              </div>
            </button>
          </Collapsible.Trigger>
          <Collapsible.Content forceMount>
            <AnimatePresence initial={false}>
              {modelsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-2">
                    {models.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-1">
                        {connected ? "No models loaded yet" : "Connect to see available models"}
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {models.slice(0, 20).map((model) => (
                          <Badge key={model.id} variant="outline" className="text-xs font-normal">
                            {model.name || model.id}
                          </Badge>
                        ))}
                        {models.length > 20 && (
                          <Badge variant="secondary" className="text-xs">
                            +{models.length - 20} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Collapsible.Content>
        </Collapsible.Root>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onConnect}>
            {connected ? "Edit Key" : "Connect"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onConnect}
            disabled={!connected}
          >
            <Settings className="h-4 w-4 mr-1" />
            Configure
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ModelProviderSection({ className }: ModelProviderSectionProps) {
  const [configOpen, setConfigOpen] = React.useState(false);
  const [selectedProvider, setSelectedProvider] = React.useState<ModelProviderId | undefined>();
  const [experimentalOpen, setExperimentalOpen] = React.useState(false);
  const [fallbacksOpen, setFallbacksOpen] = React.useState(false);
  const [globalBehaviorOpen, setGlobalBehaviorOpen] = React.useState(false);
  const [heartbeatOpen, setHeartbeatOpen] = React.useState(false);

  const { data: configSnapshot, isLoading: configLoading } = useConfig();
  const { data: modelsData, isLoading: modelsLoading, modelsByProvider } = useModelsByProvider();
  const patchConfig = usePatchConfig();
  const powerUserMode = useUIStore((state) => state.powerUserMode);
  const useLiveGateway = useUIStore((state) => state.useLiveGateway);
  const setUseLiveGateway = useUIStore((state) => state.setUseLiveGateway);
  const showDevControls = import.meta.env?.DEV ?? false;

  const config = configSnapshot?.config;
  const auth = config?.auth;
  const agents = config?.agents as AgentsConfigExtended | undefined;
  const defaults = agents?.defaults;
  const main = agents?.main;

  const modelIdIndex = React.useMemo(() => {
    const entries = modelsData?.models ?? [];
    const map = new Map<string, ModelEntry>();
    entries.forEach((model) => {
      if (!map.has(model.id)) {map.set(model.id, model);}
    });
    return map;
  }, [modelsData?.models]);
  const modelRefIndex = React.useMemo(() => {
    const entries = modelsData?.models ?? [];
    return new Map(entries.map((model) => [`${model.provider}/${model.id}`, model]));
  }, [modelsData?.models]);

  const defaultRuntime = normalizeRuntime(toStringValue(defaults?.runtime));
  const systemBrainRuntime = normalizeRuntime(
    toStringValue(main?.runtime) ??
      toStringValue(defaults?.mainRuntime) ??
      toStringValue(defaults?.runtime)
  );

  const defaultTextModel = toStringValue(defaults?.model?.primary);
  const defaultTextModelRef = splitModelRef(defaultTextModel);
  const defaultTextProviderId =
    defaultTextModelRef.provider ??
    getModelProvider(defaultTextModel, modelRefIndex, modelIdIndex);
  const defaultTextModelId = defaultTextModelRef.modelId;
  const defaultTextFallbacks = toStringArray(defaults?.model?.fallbacks) ?? [];
  const defaultImageModel = toStringValue(defaults?.imageModel?.primary);
  const defaultImageModelRef = splitModelRef(defaultImageModel);
  const defaultImageProviderId =
    defaultImageModelRef.provider ??
    getModelProvider(defaultImageModel, modelRefIndex, modelIdIndex);
  const defaultImageModelId = defaultImageModelRef.modelId;
  const defaultImageFallbacks = toStringArray(defaults?.imageModel?.fallbacks) ?? [];

  const modelCatalog = isPlainObject(defaults?.models) ? defaults?.models : undefined;
  const modelEntry =
    modelCatalog && defaultTextModel ? modelCatalog[defaultTextModel] : undefined;
  const modelParams = isPlainObject(modelEntry?.params) ? modelEntry?.params : undefined;
  const creativityValueRaw = toNumberValue(modelParams?.temperature);
  const responseLengthValueRaw = toNumberValue(modelParams?.maxTokens);
  const creativityValue = creativityValueRaw !== undefined ? Math.max(0, creativityValueRaw) : undefined;
  const responseLengthValue = responseLengthValueRaw !== undefined ? Math.max(0, responseLengthValueRaw) : undefined;
  const creativityDisplay = creativityValue ?? 0.5;
  const responseLengthDisplay = responseLengthValue ?? 1024;
  const creativityMax = Math.max(1, creativityDisplay);
  const responseLengthMax = Math.max(1024, responseLengthDisplay);
  const blockStreamingDefault = defaults?.blockStreamingDefault;
  const streamingEnabled =
    blockStreamingDefault === "off"
      ? true
      : blockStreamingDefault === "on"
        ? false
        : undefined;

  const [creativityDraft, setCreativityDraft] = React.useState(creativityDisplay);
  const [responseLengthDraft, setResponseLengthDraft] = React.useState(responseLengthDisplay);

  React.useEffect(() => {
    setCreativityDraft(creativityDisplay);
  }, [creativityDisplay]);

  React.useEffect(() => {
    setResponseLengthDraft(responseLengthDisplay);
  }, [responseLengthDisplay]);

  React.useEffect(() => {
    if (!powerUserMode && globalBehaviorOpen) {
      setGlobalBehaviorOpen(false);
    }
  }, [powerUserMode, globalBehaviorOpen]);

  const systemBrainModel = toStringValue(main?.sdk?.model) ?? defaultTextModel;
  const systemBrainModelRef = splitModelRef(systemBrainModel);
  const systemBrainModelId = systemBrainModelRef.modelId;
  const systemBrainProvider = getModelProvider(systemBrainModel, modelRefIndex, modelIdIndex);
  const systemBrainCcsdkProvider =
    toStringValue(defaults?.mainCcsdkProvider) ?? toStringValue(defaults?.ccsdkProvider);
  const systemBrainThinkingBudget = toStringValue(main?.sdk?.thinkingBudget);

  const heartbeat = defaults?.heartbeat;
  const heartbeatSchedule = formatScheduleLabel(heartbeat?.every);
  const heartbeatActiveHours = formatActiveHoursLabel(heartbeat?.activeHours);
  const heartbeatModel = toStringValue(heartbeat?.model) ?? systemBrainModel;
  const heartbeatProvider =
    getModelProvider(heartbeatModel, modelRefIndex, modelIdIndex) ??
    systemBrainProvider;
  const heartbeatModelInherited = !toStringValue(heartbeat?.model);
  const heartbeatProviderInherited = !toStringValue(heartbeat?.model);

  const configuredProviders = React.useMemo(
    () => MODEL_PROVIDERS.filter((provider) => hasProviderKey(auth, provider.id)),
    [auth]
  );

  const configuredProviderIds = React.useMemo(
    () => configuredProviders.map((p) => p.id),
    [configuredProviders]
  );

  const openConfigForProvider = (providerId: ModelProviderId) => {
    setSelectedProvider(providerId);
    setConfigOpen(true);
  };

  const handleConfigOpenChange = (open: boolean) => {
    setConfigOpen(open);
    if (!open) {
      setSelectedProvider(undefined);
    }
  };

  const isLoading = configLoading || modelsLoading;
  const isSaving = patchConfig.isPending;

  const patchDefaults = async (nextDefaults: Partial<AgentsDefaultsConfig>, note: string) => {
    if (!configSnapshot?.hash) {return;}
    const currentAgents = isPlainObject(config?.agents) ? (config?.agents as Record<string, unknown>) : {};
    const currentDefaults = isPlainObject(currentAgents.defaults)
      ? (currentAgents.defaults as Record<string, unknown>)
      : {};
    const patch = {
      agents: {
        ...currentAgents,
        defaults: {
          ...currentDefaults,
          ...nextDefaults,
        },
      },
    };

    await patchConfig.mutateAsync({
      baseHash: configSnapshot.hash,
      raw: JSON.stringify(patch),
      note,
    });
  };

  const patchMain = async (nextMain: Partial<AgentsMainConfig>, note: string) => {
    if (!configSnapshot?.hash) {return;}
    const currentAgents = isPlainObject(config?.agents) ? (config?.agents as Record<string, unknown>) : {};
    const currentMain = isPlainObject(currentAgents.main)
      ? (currentAgents.main as Record<string, unknown>)
      : {};
    const currentSdk = isPlainObject(currentMain.sdk)
      ? (currentMain.sdk as Record<string, unknown>)
      : {};
    const nextSdk = isPlainObject(nextMain.sdk)
      ? { ...currentSdk, ...nextMain.sdk }
      : currentSdk;
    const patch = {
      agents: {
        ...currentAgents,
        main: {
          ...currentMain,
          ...nextMain,
          ...(nextMain.sdk ? { sdk: nextSdk } : {}),
        },
      },
    };

    await patchConfig.mutateAsync({
      baseHash: configSnapshot.hash,
      raw: JSON.stringify(patch),
      note,
    });
  };

  const handleDefaultRuntimeChange = async (nextRuntime: RuntimeValue) => {
    if (nextRuntime === defaultRuntime) {return;}
    await patchDefaults({ runtime: nextRuntime }, "Update default agent runtime");
  };

  const handleSystemBrainRuntimeChange = async (nextRuntime: RuntimeValue) => {
    if (nextRuntime === systemBrainRuntime) {return;}
    await patchMain({ runtime: nextRuntime }, "Update System Brain runtime");
  };

  const handleDefaultTextModelChange = async (next: { providerId?: string; modelIds: string[] }) => {
    const nextModelId = next.modelIds[0];
    const nextModelRef = buildModelRef(next.providerId, nextModelId);
    if (!nextModelRef || nextModelRef === defaultTextModel) {return;}
    await patchDefaults(
      {
        model: {
          ...defaults?.model,
          primary: nextModelRef,
        },
      },
      "Update default text model"
    );
  };

  const handleDefaultImageModelChange = async (next: { providerId?: string; modelIds: string[] }) => {
    const nextModelId = next.modelIds[0];
    const nextModelRef = buildModelRef(next.providerId, nextModelId);
    if (!nextModelRef || nextModelRef === defaultImageModel) {return;}
    await patchDefaults(
      {
        imageModel: {
          ...defaults?.imageModel,
          primary: nextModelRef,
        },
      },
      "Update default image model"
    );
  };

  const handleSystemBrainModelChange = async (next: { providerId?: string; modelIds: string[] }) => {
    const nextModelId = next.modelIds[0];
    const nextModelRef = buildModelRef(next.providerId, nextModelId);
    if (!nextModelRef || nextModelRef === systemBrainModel) {return;}
    await patchMain(
      {
        sdk: {
          model: nextModelRef,
        },
      },
      "Update System Brain model"
    );
  };

  const handleSystemBrainThinkingBudgetChange = async (nextValue: string) => {
    if (!nextValue || nextValue === systemBrainThinkingBudget) {return;}
    await patchMain(
      {
        sdk: {
          thinkingBudget: nextValue,
        },
      },
      "Update System Brain thinking budget"
    );
  };

  const handleSystemBrainCcsdkProviderChange = async (nextValue: string) => {
    if (!nextValue || nextValue === systemBrainCcsdkProvider) {return;}
    await patchDefaults({ mainCcsdkProvider: nextValue }, "Update System Brain CCSDK provider");
  };

  const patchDefaultModelParams = async (
    updates: { temperature?: number; maxTokens?: number },
    note: string
  ) => {
    if (!defaultTextModel) {return;}
    const currentDefaults = isPlainObject(defaults) ? defaults : undefined;
    const currentModels = isPlainObject(currentDefaults?.models)
      ? (currentDefaults?.models as Record<string, unknown>)
      : {};
    const existingEntry = isPlainObject(currentModels[defaultTextModel])
      ? (currentModels[defaultTextModel] as Record<string, unknown>)
      : {};
    const existingParams = isPlainObject(existingEntry.params)
      ? (existingEntry.params as Record<string, unknown>)
      : {};
    const nextParams = {
      ...existingParams,
      ...(updates.temperature !== undefined ? { temperature: updates.temperature } : {}),
      ...(updates.maxTokens !== undefined ? { maxTokens: updates.maxTokens } : {}),
    };
    const nextEntry = {
      ...existingEntry,
      params: nextParams,
    };
    const nextModels = {
      ...currentModels,
      [defaultTextModel]: nextEntry,
    } as AgentsDefaultsConfig["models"];
    await patchDefaults({ models: nextModels }, note);
  };

  const handleStreamingToggle = async (checked: boolean) => {
    const nextValue: "off" | "on" = checked ? "off" : "on";
    if (nextValue === blockStreamingDefault) {return;}
    await patchDefaults({ blockStreamingDefault: nextValue }, "Update streaming default");
  };

  const handleCreativityCommit = async (value: number) => {
    if (!defaultTextModel) {return;}
    if (creativityValue !== undefined && Math.abs(creativityValue - value) < 0.001) {return;}
    await patchDefaultModelParams(
      { temperature: Number(value.toFixed(2)) },
      "Update default creativity"
    );
  };

  const handleResponseLengthCommit = async (value: number) => {
    if (!defaultTextModel) {return;}
    if (responseLengthValue !== undefined && Math.abs(responseLengthValue - value) < 0.5) {return;}
    await patchDefaultModelParams(
      { maxTokens: Math.round(value) },
      "Update default response length"
    );
  };

  const behaviorEditable = powerUserMode && !isLoading && !isSaving;
  const modelBehaviorEditable = behaviorEditable && !!defaultTextModel;
  const canResetBehavior =
    modelBehaviorEditable &&
    (creativityValue !== undefined || responseLengthValue !== undefined);

  const handleResetBehavior = async () => {
    if (!defaultTextModel) {return;}
    const currentDefaults = isPlainObject(defaults) ? defaults : undefined;
    const currentModels = isPlainObject(currentDefaults?.models)
      ? (currentDefaults?.models as Record<string, unknown>)
      : {};
    const existingEntry = isPlainObject(currentModels[defaultTextModel])
      ? (currentModels[defaultTextModel] as Record<string, unknown>)
      : {};
    const existingParams = isPlainObject(existingEntry.params)
      ? (existingEntry.params as Record<string, unknown>)
      : {};
    const nextParams = { ...existingParams };
    delete nextParams.temperature;
    delete nextParams.maxTokens;
    const nextEntry = { ...existingEntry };
    if (Object.keys(nextParams).length === 0) {
      delete nextEntry.params;
    } else {
      nextEntry.params = nextParams;
    }
    const nextModels = {
      ...currentModels,
      [defaultTextModel]: nextEntry,
    } as AgentsDefaultsConfig["models"];
    await patchDefaults({ models: nextModels }, "Reset default model params");
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Model & Provider</h2>
        <p className="text-sm text-muted-foreground">
          Set the default runtime and model providers for all agents.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Providers & Auth
          </CardTitle>
          <CardDescription>
            Connect providers once. Agents can use them immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {configuredProviders.length === 0 && !isLoading && (
            <div className="rounded-lg border border-dashed p-4 text-sm">
              <p className="font-medium">Connect a model provider</p>
              <p className="text-xs text-muted-foreground mt-1">
                You need at least one provider before agents can respond.
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {/* Sort providers: configured first, then unconfigured */}
            {[...MODEL_PROVIDERS]
              .toSorted((a, b) => {
                const aConfigured = hasProviderKey(auth, a.id);
                const bConfigured = hasProviderKey(auth, b.id);
                if (aConfigured && !bConfigured) {return -1;}
                if (!aConfigured && bConfigured) {return 1;}
                return 0;
              })
              .map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  connected={hasProviderKey(auth, provider.id)}
                  models={modelsByProvider?.[provider.id] ?? []}
                  loading={isLoading}
                  onConnect={() => openConfigForProvider(provider.id)}
                  onTest={() => openConfigForProvider(provider.id)}
                />
              ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Models</CardTitle>
          <CardDescription>
            Used in order if the default model is unavailable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <ModelProviderSelector
              label="Default text model"
              helper="Used for standard agent replies."
              models={modelsData?.models ?? []}
              providerId={defaultTextProviderId}
              modelIds={defaultTextModelId ? [defaultTextModelId] : []}
              configuredProviders={configuredProviderIds}
              restrictToConfigured={true}
              disabled={isLoading || isSaving}
              onChange={handleDefaultTextModelChange}
            />
            <ModelProviderSelector
              label="Default image model"
              helper="Used for image generation tasks."
              models={modelsData?.models ?? []}
              providerId={defaultImageProviderId}
              modelIds={defaultImageModelId ? [defaultImageModelId] : []}
              configuredProviders={configuredProviderIds}
              restrictToConfigured={false}
              disabled={isLoading || isSaving}
              onChange={handleDefaultImageModelChange}
            />
          </div>

          <Collapsible.Root open={fallbacksOpen} onOpenChange={setFallbacksOpen}>
            <Collapsible.Trigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-muted-foreground hover:text-foreground -mx-2 px-2"
              >
                <span className="flex items-center gap-2">
                  Fallbacks
                  <Badge variant="secondary" className="text-xs">
                    {defaultTextFallbacks.length + defaultImageFallbacks.length}
                  </Badge>
                </span>
                <motion.div
                  animate={{ rotate: fallbacksOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </Button>
            </Collapsible.Trigger>
            <Collapsible.Content forceMount>
              <AnimatePresence initial={false}>
                {fallbacksOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 pt-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Text model fallbacks</p>
                        <div className="flex flex-wrap gap-2">
                          {isLoading ? (
                            <Skeleton className="h-5 w-32" />
                          ) : defaultTextFallbacks.length > 0 ? (
                            defaultTextFallbacks.map((fallback) => (
                              <Badge key={fallback} variant="outline" className="text-xs">
                                {getModelLabel(fallback, modelRefIndex, modelIdIndex)}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">None configured</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">Image model fallbacks</p>
                        <div className="flex flex-wrap gap-2">
                          {isLoading ? (
                            <Skeleton className="h-5 w-32" />
                          ) : defaultImageFallbacks.length > 0 ? (
                            defaultImageFallbacks.map((fallback) => (
                              <Badge key={fallback} variant="outline" className="text-xs">
                                {getModelLabel(fallback, modelRefIndex, modelIdIndex)}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">None configured</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Collapsible.Content>
          </Collapsible.Root>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Default Agent Runtime
          </CardTitle>
          <CardDescription>
            Pi keeps conversation memory. Claude Code SDK is stateless but fast.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {runtimeOptions.map((option) => (
              <RuntimeChoice
                key={option.value}
                option={option}
                selected={defaultRuntime === option.value}
                disabled={isLoading || isSaving}
                onSelect={() => handleDefaultRuntimeChange(option.value)}
              />
            ))}
          </div>
          {!defaultRuntime && !isLoading && (
            <p className="text-xs text-muted-foreground">No runtime override set.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>System Brain</span>
            <Badge variant="secondary" className="text-xs">
              Advanced
            </Badge>
          </CardTitle>
          <CardDescription>
            Used for always-on replies and system tasks when no specific agent is chosen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Runtime</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {runtimeOptions.map((option) => (
                <RuntimeChoice
                  key={option.value}
                  option={option}
                  selected={systemBrainRuntime === option.value}
                  disabled={isLoading || isSaving}
                  onSelect={() => handleSystemBrainRuntimeChange(option.value)}
                />
              ))}
            </div>
            {!systemBrainRuntime && !isLoading && (
              <p className="text-xs text-muted-foreground">Uses the default agent runtime.</p>
            )}
          </div>

          <Separator />

          <ModelProviderSelector
            label="Model / Provider"
            helper="Overrides the default model for System Brain."
            models={modelsData?.models ?? []}
            providerId={systemBrainProvider}
            modelIds={systemBrainModelId ? [systemBrainModelId] : []}
            configuredProviders={configuredProviderIds}
            restrictToConfigured={true}
            disabled={isLoading || isSaving}
            onChange={handleSystemBrainModelChange}
          />

          <ValueRow
            label="Thinking budget"
            loading={isLoading}
            value={
              <Select
                value={systemBrainThinkingBudget ?? ""}
                onValueChange={handleSystemBrainThinkingBudgetChange}
                disabled={isLoading || isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Use default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            }
            helper="Controls how much reasoning budget the System Brain can use."
          />

          {systemBrainRuntime === "claude" && (
            <ValueRow
              label="CCSDK provider"
              loading={isLoading}
              value={
                <Select
                  value={systemBrainCcsdkProvider ?? ""}
                  onValueChange={handleSystemBrainCcsdkProviderChange}
                  disabled={isLoading || isSaving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="zai">Z.AI</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                  </SelectContent>
                </Select>
              }
            />
          )}
        </CardContent>
      </Card>

      <Collapsible.Root open={globalBehaviorOpen} onOpenChange={setGlobalBehaviorOpen}>
        <Card>
          <Collapsible.Trigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle>Global Behavior</CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    Advanced
                  </Badge>
                </div>
                <motion.div
                  animate={{ rotate: globalBehaviorOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </motion.div>
              </div>
            </CardHeader>
          </Collapsible.Trigger>
          <Collapsible.Content forceMount>
            <AnimatePresence initial={false}>
              {globalBehaviorOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <CardContent className="space-y-6 pt-0">
                    {!powerUserMode && (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Enable Power User Mode to adjust advanced behavior settings.
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Streaming replies</Label>
                        <p className="text-xs text-muted-foreground">
                          {blockStreamingDefault === undefined
                            ? "Uses provider defaults."
                            : streamingEnabled
                              ? "Streaming is enabled by default."
                              : "Streaming is disabled by default."}
                        </p>
                      </div>
                      <Switch
                        checked={streamingEnabled ?? true}
                        disabled={!behaviorEditable}
                        onCheckedChange={handleStreamingToggle}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Creativity</Label>
                        <span className="text-xs text-muted-foreground">
                          {creativityValue !== undefined ? creativityValue.toFixed(2) : "Uses model defaults"}
                        </span>
                      </div>
                      <Slider
                        disabled={!modelBehaviorEditable}
                        min={0}
                        max={creativityMax}
                        step={0.05}
                        value={[creativityDraft]}
                        onValueChange={(value) => setCreativityDraft(value[0] ?? creativityDraft)}
                        onValueCommit={(value) => handleCreativityCommit(value[0] ?? creativityDraft)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Lower is more precise. Higher is more creative.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Response length</Label>
                        <span className="text-xs text-muted-foreground">
                          {responseLengthValue !== undefined
                            ? `${responseLengthValue} tokens`
                            : "Uses model defaults"}
                        </span>
                      </div>
                      <Slider
                        disabled={!modelBehaviorEditable}
                        min={0}
                        max={responseLengthMax}
                        step={64}
                        value={[responseLengthDraft]}
                        onValueChange={(value) => setResponseLengthDraft(value[0] ?? responseLengthDraft)}
                        onValueCommit={(value) => handleResponseLengthCommit(value[0] ?? responseLengthDraft)}
                      />
                      <p className="text-xs text-muted-foreground">Higher allows longer replies.</p>
                      {!defaultTextModel && (
                        <p className="text-xs text-muted-foreground">
                          Set a default text model to edit behavior settings.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Reset to model defaults</p>
                        <p className="text-xs text-muted-foreground">
                          Clears custom creativity and response length values for the default text model.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canResetBehavior}
                        onClick={handleResetBehavior}
                      >
                        Reset
                      </Button>
                    </div>

                    {showDevControls && (
                      <div className="rounded-lg border border-dashed p-3 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-1">
                            <Label className="text-sm font-medium">
                              Live gateway mode (dev only)
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Opt in to live gateway-backed agents instead of mocks.
                            </p>
                          </div>
                          <Switch
                            checked={useLiveGateway}
                            onCheckedChange={setUseLiveGateway}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Uses the live gateway when available. Falls back to mocks if unreachable.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Collapsible.Content>
        </Card>
      </Collapsible.Root>

      <Collapsible.Root open={heartbeatOpen} onOpenChange={setHeartbeatOpen}>
        <Card>
          <Collapsible.Trigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Heartbeat</CardTitle>
                  <CardDescription>
                    Scheduled check-ins that keep an eye on ongoing work.
                  </CardDescription>
                </div>
                <motion.div
                  animate={{ rotate: heartbeatOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                </motion.div>
              </div>
            </CardHeader>
          </Collapsible.Trigger>
          <Collapsible.Content forceMount>
            <AnimatePresence initial={false}>
              {heartbeatOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <CardContent className="space-y-6 pt-0">
          <div className="grid gap-6 md:grid-cols-2">
            <ValueRow
              label="Schedule"
              loading={isLoading}
              value={<p className="text-sm font-medium">{heartbeatSchedule}</p>}
            />
            <ValueRow
              label="Active hours"
              loading={isLoading}
              value={<p className="text-sm font-medium">{heartbeatActiveHours}</p>}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            If no heartbeat overrides are set, System Brain settings are used.
          </p>

          <ValueRow
            label="Heartbeat model"
            loading={isLoading}
            badge={heartbeatModelInherited ? <InheritsBadge /> : undefined}
            value={
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {getModelLabel(heartbeatModel, modelRefIndex, modelIdIndex)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {getProviderLabel(heartbeatProvider) ?? "Provider not set"}
                </p>
              </div>
            }
          />

          <ValueRow
            label="Model provider"
            loading={isLoading}
            badge={heartbeatProviderInherited ? <InheritsBadge /> : undefined}
            value={<p className="text-sm font-medium">{getProviderLabel(heartbeatProvider) ?? "Not set"}</p>}
          />

          <Collapsible.Root open={experimentalOpen} onOpenChange={setExperimentalOpen}>
            <Collapsible.Trigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between text-muted-foreground hover:text-foreground -mx-2 px-2"
              >
                <span className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" />
                  Experimental
                  <Badge variant="warning" className="text-xs">
                    Coming soon
                  </Badge>
                </span>
                <motion.div
                  animate={{ rotate: experimentalOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </Button>
            </Collapsible.Trigger>
            <Collapsible.Content forceMount>
              <AnimatePresence initial={false}>
                {experimentalOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 pt-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">
                            Escalate low-confidence items to System Brain
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Future behavior. Enable when escalation is supported.
                          </p>
                        </div>
                        <Switch disabled checked={false} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Collapsible.Content>
          </Collapsible.Root>
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Collapsible.Content>
        </Card>
      </Collapsible.Root>

      <ModelProviderConfig
        open={configOpen}
        onOpenChange={handleConfigOpenChange}
        detectedProviders={configuredProviders.map((provider) => provider.id)}
        initialProvider={selectedProvider}
      />
    </div>
  );
}

export default ModelProviderSection;
