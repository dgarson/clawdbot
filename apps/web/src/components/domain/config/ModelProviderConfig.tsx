
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { showSuccess, showError } from "@/lib/toast";
import { getApiKeySchemaForProvider } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useConfig } from "@/hooks/queries/useConfig";
import { useFieldValidation } from "@/hooks/useFieldValidation";
import {
  useVerifyProviderApiKey,
  useSaveProviderApiKey,
  type ModelProviderId,
} from "@/hooks/mutations/useConfigMutations";

// Provider definitions with brand colors
const MODEL_PROVIDERS = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models - powerful reasoning and analysis",
    envVar: "ANTHROPIC_API_KEY",
    color: "text-[#D97757]",
    bgColor: "bg-[#D97757]/10",
    borderColor: "border-[#D97757]/30",
    recommended: true,
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT models - versatile and widely supported",
    envVar: "OPENAI_API_KEY",
    color: "text-[#10A37F]",
    bgColor: "bg-[#10A37F]/10",
    borderColor: "border-[#10A37F]/30",
    recommended: false,
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "google",
    name: "Google Gemini",
    description: "Gemini models - multimodal capabilities",
    envVar: "GOOGLE_API_KEY",
    color: "text-[#4285F4]",
    bgColor: "bg-[#4285F4]/10",
    borderColor: "border-[#4285F4]/30",
    recommended: false,
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "zai",
    name: "Z.AI",
    description: "Grok models - real-time knowledge",
    envVar: "XAI_API_KEY",
    color: "text-[#1DA1F2]",
    bgColor: "bg-[#1DA1F2]/10",
    borderColor: "border-[#1DA1F2]/30",
    recommended: false,
    docsUrl: "https://x.ai/api",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access multiple providers through one API",
    envVar: "OPENROUTER_API_KEY",
    color: "text-[#9333EA]",
    bgColor: "bg-[#9333EA]/10",
    borderColor: "border-[#9333EA]/30",
    recommended: false,
    docsUrl: "https://openrouter.ai/keys",
  },
] as const;

type ProviderId = (typeof MODEL_PROVIDERS)[number]["id"];

// Provider icons as simple SVG components
function AnthropicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.304 3.541h-3.672l6.696 16.918h3.672l-6.696-16.918zm-10.608 0L0 20.459h3.744l1.38-3.636h6.54l1.38 3.636h3.744L10.092 3.541h-3.396zm.612 10.776l2.28-6.012 2.28 6.012h-4.56z" />
    </svg>
  );
}

function OpenAIIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.677l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function ZAIIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function OpenRouterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

function getProviderIcon(providerId: ProviderId, className?: string) {
  switch (providerId) {
    case "anthropic":
      return <AnthropicIcon className={className} />;
    case "openai":
      return <OpenAIIcon className={className} />;
    case "google":
      return <GoogleIcon className={className} />;
    case "zai":
      return <ZAIIcon className={className} />;
    case "openrouter":
      return <OpenRouterIcon className={className} />;
  }
}

interface ConfigState {
  step: 1 | 2;
  selectedProvider: (typeof MODEL_PROVIDERS)[number] | null;
  apiKey: string;
  showApiKey: boolean;
  connectionStatus: "idle" | "testing" | "success" | "error";
  errorMessage: string | null;
  hasInteracted: boolean;
}

interface ModelProviderConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigured?: (providerId: ProviderId, apiKey: string) => void;
  detectedProviders?: ProviderId[];
  /** Pre-select a provider and skip to step 2 */
  initialProvider?: ProviderId;
}

export function ModelProviderConfig({
  open,
  onOpenChange,
  onConfigured,
  detectedProviders = [],
  initialProvider,
}: ModelProviderConfigProps) {
  // Find the initial provider object if specified
  const initialProviderObj = initialProvider
    ? MODEL_PROVIDERS.find((p) => p.id === initialProvider) ?? null
    : null;

  const [state, setState] = React.useState<ConfigState>({
    step: initialProviderObj ? 2 : 1,
    selectedProvider: initialProviderObj,
    apiKey: "",
    showApiKey: false,
    connectionStatus: "idle",
    errorMessage: null,
    hasInteracted: false,
  });

  // Get the appropriate validation schema for the selected provider
  const apiKeySchema = React.useMemo(
    () => state.selectedProvider ? getApiKeySchemaForProvider(state.selectedProvider.id) : null,
    [state.selectedProvider]
  );

  // Validate API key with debouncing
  const apiKeyValidation = useFieldValidation(
    apiKeySchema ?? getApiKeySchemaForProvider("generic"),
    state.apiKey,
    { debounceMs: 300, skipEmpty: true }
  );

  // Only show validation errors after user has interacted
  const showValidationError = state.hasInteracted && !apiKeyValidation.isValid && apiKeyValidation.error;

  // Update state when initialProvider changes (e.g., when opening with different provider)
  React.useEffect(() => {
    if (open && initialProvider) {
      const provider = MODEL_PROVIDERS.find((p) => p.id === initialProvider);
      if (provider) {
        setState({
          step: 2,
          selectedProvider: provider,
          apiKey: "",
          showApiKey: false,
          connectionStatus: "idle",
          errorMessage: null,
          hasInteracted: false,
        });
      }
    }
  }, [open, initialProvider]);

  // API hooks
  const { data: configSnapshot } = useConfig();
  const verifyApiKey = useVerifyProviderApiKey();
  const saveApiKey = useSaveProviderApiKey();

  const resetState = React.useCallback(() => {
    setState({
      step: 1,
      selectedProvider: null,
      apiKey: "",
      showApiKey: false,
      connectionStatus: "idle",
      errorMessage: null,
      hasInteracted: false,
    });
  }, []);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        resetState();
      }
      onOpenChange(open);
    },
    [onOpenChange, resetState]
  );

  const handleProviderSelect = (
    provider: (typeof MODEL_PROVIDERS)[number]
  ) => {
    setState((prev) => ({
      ...prev,
      selectedProvider: provider,
      step: 2,
      apiKey: "",
      connectionStatus: "idle",
      errorMessage: null,
      hasInteracted: false,
    }));
  };

  const handleBack = () => {
    setState((prev) => ({
      ...prev,
      step: 1,
      apiKey: "",
      showApiKey: false,
      connectionStatus: "idle",
      errorMessage: null,
      hasInteracted: false,
    }));
  };

  const handleTestConnection = async () => {
    if (!state.selectedProvider || !state.apiKey.trim()) {return;}

    setState((prev) => ({
      ...prev,
      connectionStatus: "testing",
      errorMessage: null,
    }));

    try {
      const result = await verifyApiKey.mutateAsync({
        provider: state.selectedProvider.id as ModelProviderId,
        apiKey: state.apiKey,
      });

      if (result.ok) {
        setState((prev) => ({ ...prev, connectionStatus: "success" }));
        showSuccess(
          `Connected to ${state.selectedProvider?.name} successfully`
        );
      } else {
        setState((prev) => ({
          ...prev,
          connectionStatus: "error",
          errorMessage: result.error || "Invalid API key. Please check your key.",
        }));
        showError("Connection failed. Please verify your API key.");
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        connectionStatus: "error",
        errorMessage: error instanceof Error ? error.message : "Connection test failed",
      }));
      showError("Connection failed. Please verify your API key.");
    }
  };

  const handleSave = async () => {
    if (
      !state.selectedProvider ||
      !state.apiKey.trim() ||
      state.connectionStatus !== "success" ||
      !configSnapshot
    )
      {return;}

    try {
      await saveApiKey.mutateAsync({
        provider: state.selectedProvider.id as ModelProviderId,
        apiKey: state.apiKey,
        currentConfig: configSnapshot,
      });

      onConfigured?.(state.selectedProvider.id, state.apiKey);
      handleOpenChange(false);
    } catch (error) {
      showError(
        `Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Connect Model Provider
          </SheetTitle>
          <SheetDescription>
            {state.step === 1
              ? "Choose your AI provider to power your agents"
              : `Configure ${state.selectedProvider?.name}`}
          </SheetDescription>
        </SheetHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2].map((step) => (
            <div
              key={step}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                step === state.step
                  ? "w-8 bg-primary"
                  : step < state.step
                    ? "w-2 bg-primary/60"
                    : "w-2 bg-muted"
              )}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Step 1: Provider Selection */}
              {state.step === 1 && (
                <div className="space-y-3">
                  {MODEL_PROVIDERS.map((provider) => {
                    const isDetected = detectedProviders.includes(provider.id);
                    return (
                      <Card
                        key={provider.id}
                        className={cn(
                          "cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-md",
                          state.selectedProvider?.id === provider.id &&
                            "border-primary ring-2 ring-primary/20"
                        )}
                        onClick={() => handleProviderSelect(provider)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <div
                              className={cn(
                                "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
                                provider.bgColor
                              )}
                            >
                              {getProviderIcon(
                                provider.id,
                                cn("h-6 w-6", provider.color)
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-medium text-foreground">
                                  {provider.name}
                                </h4>
                                {provider.recommended && (
                                  <Badge
                                    variant="default"
                                    className="gap-1 text-xs"
                                  >
                                    <Sparkles className="h-3 w-3" />
                                    Recommended
                                  </Badge>
                                )}
                                {isDetected && (
                                  <Badge
                                    variant="success"
                                    className="gap-1 text-xs"
                                  >
                                    <Check className="h-3 w-3" />
                                    Detected
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {provider.description}
                              </p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Step 2: API Key Configuration */}
              {state.step === 2 && state.selectedProvider && (
                <div className="space-y-6">
                  {/* Provider header */}
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border">
                    <div
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
                        state.selectedProvider.bgColor
                      )}
                    >
                      {getProviderIcon(
                        state.selectedProvider.id,
                        cn("h-6 w-6", state.selectedProvider.color)
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium">
                        {state.selectedProvider.name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {state.selectedProvider.description}
                      </p>
                    </div>
                  </div>

                  {/* API Key input */}
                  <div className="space-y-3">
                    <Label htmlFor="api-key">API Key</Label>
                    <div className="relative">
                      <Input
                        id="api-key"
                        type={state.showApiKey ? "text" : "password"}
                        value={state.apiKey}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            apiKey: e.target.value,
                            connectionStatus: "idle",
                            errorMessage: null,
                            hasInteracted: true,
                          }))
                        }
                        placeholder={`Enter your ${state.selectedProvider.name} API key`}
                        className={cn(
                          "pr-10",
                          showValidationError && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                        )}
                        aria-invalid={!!showValidationError}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            showApiKey: !prev.showApiKey,
                          }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {state.showApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {/* Validation error message */}
                    {showValidationError && (
                      <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                        {apiKeyValidation.error}
                      </p>
                    )}
                    {/* Help text (only show if no validation error) */}
                    {!showValidationError && (
                      <p className="text-xs text-muted-foreground">
                        Get your API key from{" "}
                        <a
                          href={state.selectedProvider.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {state.selectedProvider.name} console
                        </a>
                      </p>
                    )}
                  </div>

                  {/* Connection status */}
                  {state.connectionStatus !== "idle" && (
                    <div
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-lg border",
                        state.connectionStatus === "testing" &&
                          "bg-muted/30 border-muted",
                        state.connectionStatus === "success" &&
                          "bg-success/10 border-success/30",
                        state.connectionStatus === "error" &&
                          "bg-destructive/10 border-destructive/30"
                      )}
                    >
                      {state.connectionStatus === "testing" && (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Testing connection...
                          </span>
                        </>
                      )}
                      {state.connectionStatus === "success" && (
                        <>
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/20">
                            <Check className="h-4 w-4 text-success" />
                          </div>
                          <span className="text-sm text-success">
                            Connection successful
                          </span>
                        </>
                      )}
                      {state.connectionStatus === "error" && (
                        <>
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/20">
                            <X className="h-4 w-4 text-destructive" />
                          </div>
                          <span className="text-sm text-destructive">
                            {state.errorMessage || "Connection failed"}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Test connection button */}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleTestConnection}
                    disabled={
                      !state.apiKey.trim() ||
                      !apiKeyValidation.isValid ||
                      state.connectionStatus === "testing"
                    }
                  >
                    {state.connectionStatus === "testing" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      "Test Connection"
                    )}
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <SheetFooter className="gap-2 border-t pt-4">
          {state.step === 2 && (
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          {state.step === 2 && (
            <Button
              onClick={handleSave}
              disabled={
                !state.apiKey.trim() ||
                state.connectionStatus !== "success" ||
                saveApiKey.isPending
              }
              className="flex-1"
            >
              {saveApiKey.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default ModelProviderConfig;
