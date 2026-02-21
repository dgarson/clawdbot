"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Check, Key, ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export type ModelProvider = "openai" | "anthropic" | "google" | "openrouter" | "local";

interface ModelProviderConfig {
  provider: ModelProvider;
  apiKey: string;
  baseUrl?: string; // For local/Ollama models
}

interface ModelProviderStepProps {
  config: ModelProviderConfig;
  onConfigChange: (config: ModelProviderConfig) => void;
}

const providers = [
  {
    id: "openai" as const,
    name: "OpenAI",
    description: "GPT-5.2, GPT-4o",
    icon: "O",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    docsUrl: "https://platform.openai.com/api-keys",
    keyGuidance: "Sign in to your OpenAI account, navigate to API Keys, and create a new secret key.",
  },
  {
    id: "anthropic" as const,
    name: "Anthropic",
    description: "Opus 4.5, Sonnet 4.5, Haiku 4.5",
    icon: "A",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    docsUrl: "https://console.anthropic.com/settings/keys",
    keyGuidance: "Log in to the Anthropic Console, go to Settings > API Keys, and generate a new key.",
  },
  {
    id: "google" as const,
    name: "Google Gemini",
    description: "Gemini 3 Flash, Gemini 3 Pro",
    icon: "G",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    docsUrl: "https://aistudio.google.com/app/apikey",
    keyGuidance: "Visit Google AI Studio, sign in with your Google account, and create an API key.",
  },
  {
    id: "openrouter" as const,
    name: "OpenRouter",
    description: "Access multiple providers",
    icon: "R",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    docsUrl: "https://openrouter.ai/keys",
    keyGuidance: "Create an OpenRouter account, navigate to Keys, and generate a new API key.",
  },
  {
    id: "local" as const,
    name: "Local Models",
    description: "Ollama, LM Studio, etc.",
    icon: "L",
    color: "text-slate-500",
    bgColor: "bg-slate-500/10",
    docsUrl: "",
    keyGuidance: "",
  },
];

export function ModelProviderStep({
  config,
  onConfigChange,
}: ModelProviderStepProps) {
  const selectedProvider = providers.find((p) => p.id === config.provider);
  const [isGuidanceOpen, setIsGuidanceOpen] = React.useState(false);

  // Set default Ollama URL when local is selected
  React.useEffect(() => {
    if (config.provider === "local" && !config.baseUrl) {
      onConfigChange({ ...config, baseUrl: "http://localhost:11434" });
    }
  }, [config.provider]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center">
      {/* Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="mb-4 lg:mb-6"
      >
        <div className="h-14 w-14 lg:h-16 lg:w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Bot className="h-7 w-7 lg:h-8 lg:w-8 text-primary" />
        </div>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center space-y-1.5 lg:space-y-2 mb-4 lg:mb-6"
      >
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight">
          Choose Your AI Provider
        </h2>
        <p className="text-sm lg:text-base text-muted-foreground max-w-md lg:max-w-xl">
          Select the AI model provider you want to use. You can change this later.
        </p>
      </motion.div>

      {/* Provider Selection */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-lg lg:max-w-2xl mb-4 lg:mb-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3">
          {providers.map((provider, index) => {
            const isSelected = config.provider === provider.id;
            return (
              <motion.div
                key={provider.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.05 }}
              >
                <Card
                  className={cn(
                    "cursor-pointer transition-all duration-200 hover:border-primary/50",
                    isSelected && "border-primary ring-2 ring-primary/20"
                  )}
                  onClick={() =>
                    onConfigChange({ ...config, provider: provider.id })
                  }
                >
                  <CardContent className="p-3 lg:p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 lg:h-10 lg:w-10 shrink-0 items-center justify-center rounded-lg font-bold text-base lg:text-lg",
                          provider.bgColor,
                          provider.color
                        )}
                      >
                        {provider.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm lg:text-base text-foreground">
                            {provider.name}
                          </h4>
                          {isSelected && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <p className="text-xs lg:text-sm text-muted-foreground mt-0.5">
                          {provider.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* API Key Input */}
      {config.provider !== "local" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-lg lg:max-w-2xl"
        >
          <div className="space-y-2 lg:space-y-3">
            <Label htmlFor="api-key" className="flex items-center gap-2 text-sm lg:text-base">
              <Key className="h-4 w-4" />
              {selectedProvider?.name} API Key
            </Label>
            <Input
              id="api-key"
              type="password"
              placeholder={`Enter your ${selectedProvider?.name} API key...`}
              value={config.apiKey}
              onChange={(e) =>
                onConfigChange({ ...config, apiKey: e.target.value })
              }
              className="text-sm lg:text-base"
            />

            <p className="text-xs lg:text-sm text-muted-foreground">
              Your API key is stored securely and never shared.
            </p>

            {/* Expandable API Key Guidance - below disclaimer */}
            {selectedProvider && (
              <div>
                <button
                  type="button"
                  onClick={() => setIsGuidanceOpen(!isGuidanceOpen)}
                  className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isGuidanceOpen && "rotate-180"
                    )}
                  />
                  How to get an API key
                </button>
                <AnimatePresence>
                  {isGuidanceOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3"
                    >
                      <Card className="bg-muted/30 border-muted">
                        <CardContent className="p-4 lg:p-5 space-y-3">
                          <p className="text-xs lg:text-sm text-muted-foreground leading-relaxed">
                            {selectedProvider.keyGuidance}
                          </p>
                          <a
                            href={selectedProvider.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs lg:text-sm text-primary hover:underline"
                          >
                            Visit {selectedProvider.name} Console
                            <ExternalLink className="h-3 w-3 lg:h-4 lg:w-4" />
                          </a>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {config.provider === "local" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-lg lg:max-w-2xl space-y-4 lg:space-y-6"
        >
          {/* Info Card */}
          <Card className="bg-muted/30 border-muted">
            <CardContent className="p-4 lg:p-6">
              <p className="text-sm lg:text-base text-muted-foreground leading-relaxed">
                Local models run on your own hardware. Make sure you have Ollama or LM Studio installed and running.
              </p>
            </CardContent>
          </Card>

          {/* Base URL Input */}
          <div className="space-y-3 lg:space-y-4">
            <Label htmlFor="base-url" className="flex items-center gap-2 text-sm lg:text-base">
              <Key className="h-4 w-4 lg:h-5 lg:w-5" />
              Ollama Base URL
            </Label>
            <Input
              id="base-url"
              type="text"
              placeholder="http://localhost:11434"
              value={config.baseUrl || ""}
              onChange={(e) =>
                onConfigChange({ ...config, baseUrl: e.target.value })
              }
              className="text-sm lg:text-base h-10 lg:h-11"
            />
            <p className="text-xs lg:text-sm text-muted-foreground">
              Default is localhost. Change this if Ollama is running on another machine.
            </p>
          </div>

          {/* Optional API Key for Local */}
          <div className="space-y-3 lg:space-y-4">
            <Label htmlFor="local-api-key" className="flex items-center gap-2 text-sm lg:text-base">
              <Key className="h-4 w-4 lg:h-5 lg:w-5" />
              API Key (Optional)
            </Label>
            <Input
              id="local-api-key"
              type="password"
              placeholder="Leave blank if not required"
              value={config.apiKey}
              onChange={(e) =>
                onConfigChange({ ...config, apiKey: e.target.value })
              }
              className="text-sm lg:text-base h-10 lg:h-11"
            />
            <p className="text-xs lg:text-sm text-muted-foreground">
              Some Ollama setups require authentication. Leave blank if not needed.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default ModelProviderStep;
