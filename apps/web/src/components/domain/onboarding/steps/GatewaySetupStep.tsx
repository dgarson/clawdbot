"use client";

import { motion } from "framer-motion";
import { Server, Check, Wifi, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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

export function GatewaySetupStep({
  config,
  onConfigChange,
}: GatewaySetupStepProps) {
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
        </motion.div>
      )}
    </div>
  );
}

export default GatewaySetupStep;
