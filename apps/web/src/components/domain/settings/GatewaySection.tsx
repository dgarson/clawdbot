"use client";

import * as React from "react";
import { Server, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GatewayConfig, type GatewayStatus, type AccessMode } from "@/components/domain/config";

interface GatewaySectionProps {
  className?: string;
}

export function GatewaySection({ className }: GatewaySectionProps) {
  // In production, these would come from the actual gateway status API
  const [gatewayStatus, setGatewayStatus] = React.useState<GatewayStatus>("disconnected");
  const [gatewayConfig, setGatewayConfig] = React.useState({
    port: 18789,
    accessMode: "local" as AccessMode,
    customBind: "",
    authToken: "clawdbrain_abc123xyz789...",
  });

  const handleConfigChange = (config: {
    port: number;
    accessMode: AccessMode;
    customBind?: string;
  }) => {
    setGatewayConfig((prev) => ({
      ...prev,
      ...config,
    }));
    // In production, this would trigger a gateway restart with new config
  };

  const handleReconnect = async () => {
    setGatewayStatus("connecting");
    // Simulate reconnection
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setGatewayStatus("connected");
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-medium">About the Gateway</h4>
            <p className="text-sm text-muted-foreground">
              The Clawdbrain Gateway is a local server that runs on your machine. It handles
              connections between your messaging channels (Telegram, Discord, etc.) and your AI agents.
              The gateway must be running for agents to respond to messages.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Gateway Config Component */}
      <GatewayConfig
        status={gatewayStatus}
        port={gatewayConfig.port}
        accessMode={gatewayConfig.accessMode}
        customBind={gatewayConfig.customBind}
        authToken={gatewayConfig.authToken}
        onConfigChange={handleConfigChange}
        onReconnect={handleReconnect}
      />

      {/* Additional Gateway Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            Gateway Commands
          </CardTitle>
          <CardDescription>
            Useful CLI commands for managing the gateway
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Start Gateway</p>
              <code className="text-sm font-mono">clawdbrain gateway run</code>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Check Status</p>
              <code className="text-sm font-mono">clawdbrain channels status --probe</code>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">View Logs</p>
              <code className="text-sm font-mono">tail -f ~/.clawdbrain/logs/gateway.log</code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default GatewaySection;
