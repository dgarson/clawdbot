"use client";

import * as React from "react";
import { Plus, Sparkles, Check, Trash2, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ModelProviderConfig } from "@/components/domain/config";
import { useConfig } from "@/hooks/queries/useConfig";
import { useRemoveProviderApiKey, type ModelProviderId } from "@/hooks/mutations/useConfigMutations";

// Provider definitions matching ModelProviderConfig
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

type ProviderId = (typeof MODEL_PROVIDERS)[number]["id"];

interface ConfiguredProvider {
  id: ProviderId;
  configuredAt: string;
}

interface AIProviderSectionProps {
  className?: string;
}

export function AIProviderSection({ className }: AIProviderSectionProps) {
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const [selectedProvider, setSelectedProvider] = React.useState<ProviderId | undefined>();
  const [removingProvider, setRemovingProvider] = React.useState<ProviderId | null>(null);

  // Get real config data
  const { data: config, isLoading } = useConfig();
  const removeApiKey = useRemoveProviderApiKey();

  // Derive configured providers from real config
  const configuredProviders = React.useMemo(() => {
    const cfg = config?.config;
    if (!cfg) {return [];}

    const providers: ConfiguredProvider[] = [];
    const auth = cfg.auth ?? {};

    // Check each provider for API key presence
    const providerChecks: { id: ProviderId; hasKey: boolean }[] = [
      { id: "anthropic", hasKey: !!auth.anthropic?.apiKey },
      { id: "openai", hasKey: !!auth.openai?.apiKey },
      { id: "google", hasKey: !!auth.google?.apiKey },
      { id: "zai", hasKey: !!auth.xai?.apiKey },
      { id: "openrouter", hasKey: !!auth.openrouter?.apiKey },
    ];

    for (const check of providerChecks) {
      if (check.hasKey) {
        providers.push({ id: check.id, configuredAt: "configured" });
      }
    }

    return providers;
  }, [config]);

  const openConfigForProvider = (providerId?: ProviderId) => {
    setSelectedProvider(providerId);
    setIsConfigOpen(true);
  };

  const handleConfigClose = (open: boolean) => {
    setIsConfigOpen(open);
    if (!open) {
      setSelectedProvider(undefined);
    }
  };

  const handleProviderConfigured = () => {
    // Config will be refetched automatically by React Query
    // No need to manually update state
  };

  const handleRemoveProvider = async (providerId: ProviderId) => {
    if (!config) {return;}

    setRemovingProvider(providerId);
    try {
      await removeApiKey.mutateAsync({
        provider: providerId as ModelProviderId,
        currentConfig: config,
      });
    } finally {
      setRemovingProvider(null);
    }
  };

  const getProviderInfo = (providerId: ProviderId) => {
    return MODEL_PROVIDERS.find((p) => p.id === providerId);
  };

  const unconfiguredProviders = MODEL_PROVIDERS.filter(
    (p) => !configuredProviders.some((cp) => cp.id === p.id)
  );

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-9 w-28" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={cn("", className)}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Providers
              </CardTitle>
              <CardDescription>
                Connect AI model providers to power your agents. You can configure multiple providers.
              </CardDescription>
            </div>
            <Button onClick={() => openConfigForProvider()} size="sm">
              <Plus className="h-4 w-4" />
              Add Provider
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Configured Providers */}
          {configuredProviders.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Connected</h4>
              <div className="space-y-2">
                {configuredProviders.map((configured) => {
                  const provider = getProviderInfo(configured.id);
                  if (!provider) {return null;}
                  return (
                    <div
                      key={configured.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
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
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{provider.name}</span>
                            <Badge variant="success" className="gap-1 text-xs">
                              <Check className="h-3 w-3" />
                              Connected
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Configured {configured.configuredAt}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveProvider(configured.id)}
                        disabled={removingProvider === configured.id}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        {removingProvider === configured.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
                <Sparkles className="h-6 w-6 text-muted-foreground" />
              </div>
              <h4 className="font-medium">No providers connected</h4>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Connect an AI provider to start using agents. We recommend starting with Anthropic.
              </p>
              <Button onClick={() => openConfigForProvider()} className="mt-4">
                <Plus className="h-4 w-4" />
                Connect Provider
              </Button>
            </div>
          )}

          {/* Available Providers (if some are configured) */}
          {configuredProviders.length > 0 && unconfiguredProviders.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="text-sm font-medium text-muted-foreground">Available Providers</h4>
              <div className="flex flex-wrap gap-2">
                {unconfiguredProviders.map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => openConfigForProvider(provider.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border",
                      "text-sm text-muted-foreground hover:text-foreground",
                      "hover:border-primary/50 hover:bg-accent/50 transition-colors"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded",
                        provider.bgColor
                      )}
                    >
                      <span className={cn("font-semibold text-xs", provider.color)}>
                        {provider.name.charAt(0)}
                      </span>
                    </div>
                    {provider.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Provider Config Sheet */}
      <ModelProviderConfig
        open={isConfigOpen}
        onOpenChange={handleConfigClose}
        onConfigured={handleProviderConfigured}
        detectedProviders={configuredProviders.map((p) => p.id)}
        initialProvider={selectedProvider}
      />
    </>
  );
}

export default AIProviderSection;
