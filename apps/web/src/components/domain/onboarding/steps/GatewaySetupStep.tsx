"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Server, Check, Wifi, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getConfig, patchConfig, type ConfigSnapshot, type ClawdbrainConfig } from "@/lib/api";

export type GatewayMode = "auto" | "local" | "remote";

interface GatewayConfig {
  mode: GatewayMode;
  endpoint?: string;
}

interface GatewaySetupStepProps {
  config: GatewayConfig;
  onConfigChange: (config: GatewayConfig) => void;
}

const gatewayOptions = [
  {
    id: "auto" as const,
    name: "Automatic",
    description: "Let Clawdbrain handle gateway setup",
    icon: Settings2,
    recommended: true,
  },
  {
    id: "local" as const,
    name: "Local Gateway",
    description: "Run the gateway on your machine",
    icon: Server,
    recommended: false,
  },
  {
    id: "remote" as const,
    name: "Remote Gateway",
    description: "Connect to an existing gateway",
    icon: Wifi,
    recommended: false,
  },
];

function resolveGatewayMode(config: ClawdbrainConfig | undefined): GatewayMode {
  // Check if remote gateway URL is configured
  const gateway = config?.gateway as { remote?: { url?: string }; mode?: string } | undefined;
  if (gateway?.remote?.url) return "remote";

  // Check local binding mode
  const mode = gateway?.mode;
  if (mode === "local" || mode === "loopback") return "local";

  return "auto";
}

function resolveGatewayEndpoint(config: ClawdbrainConfig | undefined): string | undefined {
  const gateway = config?.gateway as { remote?: { url?: string } } | undefined;
  return gateway?.remote?.url;
}

export function GatewaySetupStep({
  config,
  onConfigChange,
}: GatewaySetupStepProps) {
  const [configSnapshot, setConfigSnapshot] = React.useState<ConfigSnapshot | null>(null);
  const [gatewayError, setGatewayError] = React.useState<string | null>(null);
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const lastSavedRef = React.useRef<GatewayConfig | null>(null);
  const hasPrefilledRef = React.useRef(false);
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const configRef = React.useRef(config);

  React.useEffect(() => {
    configRef.current = config;
  }, [config]);

  React.useEffect(() => {
    let active = true;

    async function preloadConfig() {
      try {
        const snapshot = await getConfig();
        if (!active) return;
        setConfigSnapshot(snapshot);
        setGatewayError(null);

        if (!hasPrefilledRef.current) {
          const resolvedMode = resolveGatewayMode(snapshot.config);
          const resolvedEndpoint = resolveGatewayEndpoint(snapshot.config);
          const currentConfig = configRef.current;
          if (
            resolvedMode !== currentConfig.mode ||
            (resolvedMode === "remote" && resolvedEndpoint && resolvedEndpoint !== currentConfig.endpoint)
          ) {
            hasPrefilledRef.current = true;
            lastSavedRef.current = { ...currentConfig, mode: resolvedMode, endpoint: resolvedEndpoint };
            onConfigChange({ ...currentConfig, mode: resolvedMode, endpoint: resolvedEndpoint });
          }
        }
      } catch (error) {
        if (!active) return;
        setGatewayError(error instanceof Error ? error.message : "Failed to load gateway config");
      }
    }

    void preloadConfig();

    return () => {
      active = false;
    };
  }, [onConfigChange]);

  React.useEffect(() => {
    if (!configSnapshot) return;

    const lastSaved = lastSavedRef.current;
    if (
      lastSaved &&
      lastSaved.mode === config.mode &&
      lastSaved.endpoint === config.endpoint
    ) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      void (async () => {
        if (config.mode === "remote" && !config.endpoint) {
          return;
        }

        setSaveState("saving");

        try {
          const latestSnapshot = await getConfig();
          if (!latestSnapshot.hash) {
            throw new Error("Config hash missing");
          }

          const gatewayPatch = {
            ...latestSnapshot.config?.gateway,
            mode: config.mode === "remote" ? "remote" : "local",
          } as Record<string, unknown>;

          if (config.mode === "remote") {
            gatewayPatch.remote = {
              ...(gatewayPatch.remote as Record<string, unknown> | undefined),
              url: config.endpoint,
            };
          }

          await patchConfig({
            baseHash: latestSnapshot.hash,
            raw: JSON.stringify({ gateway: gatewayPatch }),
            note: "Onboarding: configure gateway",
          });

          setConfigSnapshot(latestSnapshot);
          setSaveState("saved");
          setGatewayError(null);
          lastSavedRef.current = { ...config };
        } catch (error) {
          setSaveState("error");
          setGatewayError(error instanceof Error ? error.message : "Failed to save gateway settings");
        }
      })();
    }, 600);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [config, configSnapshot]);

  return (
    <div className="flex flex-col items-center px-4">
      {/* Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="mb-6"
      >
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Server className="h-8 w-8 text-primary" />
        </div>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center space-y-2 mb-8"
      >
        <h2 className="text-2xl font-bold tracking-tight">
          Gateway Configuration
        </h2>
        <p className="text-muted-foreground max-w-md">
          The gateway connects your agents to external services and tools.
        </p>
      </motion.div>

      {/* Gateway Options */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-lg space-y-3"
      >
        {gatewayOptions.map((option, index) => {
          const Icon = option.icon;
          const isSelected = config.mode === option.id;
          return (
            <motion.div
              key={option.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
            >
              <Card
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:border-primary/50",
                  isSelected && "border-primary ring-2 ring-primary/20"
                )}
                onClick={() =>
                  onConfigChange({ ...config, mode: option.id })
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-foreground">
                          {option.name}
                        </h4>
                        {option.recommended && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Remote Endpoint Input */}
      {config.mode === "remote" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-lg mt-6"
        >
          <div className="space-y-2">
            <Label htmlFor="endpoint">Gateway Endpoint URL</Label>
            <Input
              id="endpoint"
              type="url"
              placeholder="https://gateway.example.com"
              value={config.endpoint || ""}
              onChange={(e) =>
                onConfigChange({ ...config, endpoint: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Enter the URL of your remote gateway server.
            </p>
            {saveState !== "idle" && (
              <p
                className={cn(
                  "text-xs",
                  saveState === "saving" && "text-muted-foreground",
                  saveState === "saved" && "text-emerald-600",
                  saveState === "error" && "text-destructive"
                )}
              >
                {saveState === "saving" && "Saving to gateway..."}
                {saveState === "saved" && "Saved to gateway."}
                {saveState === "error" && (gatewayError ?? "Failed to save to gateway.")}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Auto mode info */}
      {config.mode === "auto" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-lg mt-6"
        >
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                Automatic mode will configure the optimal gateway setup based on your system. You can change this in settings later.
              </p>
            </CardContent>
          </Card>
          {saveState !== "idle" && (
            <p
              className={cn(
                "text-xs text-muted-foreground mt-3",
                saveState === "saving" && "text-muted-foreground",
                saveState === "saved" && "text-emerald-600",
                saveState === "error" && "text-destructive"
              )}
            >
              {saveState === "saving" && "Saving to gateway..."}
              {saveState === "saved" && "Saved to gateway."}
              {saveState === "error" && (gatewayError ?? "Failed to save to gateway.")}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default GatewaySetupStep;
