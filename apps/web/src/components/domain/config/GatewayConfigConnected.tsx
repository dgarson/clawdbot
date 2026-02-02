"use client";

import * as React from "react";
import { toast } from "sonner";
import { GatewayConfig, type GatewayStatus, type AccessMode } from "./GatewayConfig";
import { useGatewayConnected } from "@/hooks/queries/useGateway";
import { useConfig } from "@/hooks/queries/useConfig";
import { usePatchConfig } from "@/hooks/mutations/useConfigMutations";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ErrorState, errorMessages } from "@/components/composed/ErrorState";

interface GatewayConfigConnectedProps {
  className?: string;
}

/**
 * Connected version of GatewayConfig that fetches data from the API.
 * Uses the raw GatewayConfig component underneath with real data.
 */
export function GatewayConfigConnected({ className }: GatewayConfigConnectedProps) {
  const {
    isConnected,
    isLoading: isHealthLoading,
    refetch: refetchHealth,
  } = useGatewayConnected();
  const {
    data: configSnapshot,
    isLoading: isConfigLoading,
    error: configError,
    refetch: refetchConfig,
  } = useConfig();
  const patchConfig = usePatchConfig();
  const [isRetrying, setIsRetrying] = React.useState(false);

  // Derive gateway status
  const status: GatewayStatus = React.useMemo(() => {
    if (isHealthLoading) {return "connecting";}
    return isConnected ? "connected" : "disconnected";
  }, [isConnected, isHealthLoading]);

  // Extract gateway config values
  const gatewayConfig = configSnapshot?.config?.gateway;
  const port = gatewayConfig?.port ?? 18789;
  const authToken = gatewayConfig?.token ?? "";

  // Map gateway mode to access mode
  const accessMode: AccessMode = React.useMemo(() => {
    const mode = gatewayConfig?.mode;
    if (mode === "loopback" || mode === "local") {return "local";}
    if (mode === "network") {return "network";}
    if (gatewayConfig?.bind) {return "custom";}
    return "local";
  }, [gatewayConfig?.mode, gatewayConfig?.bind]);

  const customBind = gatewayConfig?.bind ?? "";

  // Handle config changes
	  const handleConfigChange = React.useCallback(
	    async (config: { port: number; accessMode: AccessMode; customBind?: string }) => {
	      if (!configSnapshot?.hash) {return;}

      // Map access mode back to gateway config
      let mode: string | undefined;
      let bind: string | undefined;

      switch (config.accessMode) {
        case "local":
          mode = "loopback";
          break;
        case "network":
          mode = "network";
          break;
        case "custom":
          bind = config.customBind || "0.0.0.0";
          break;
      }

      const patch = {
        gateway: {
          port: config.port,
          ...(mode && { mode }),
          ...(bind && { bind }),
        },
      };

	      await patchConfig.mutateAsync({
	        baseHash: configSnapshot.hash,
	        raw: JSON.stringify(patch),
	        note: "Update gateway configuration",
	      });
	    },
	    [configSnapshot, patchConfig]
	  );

  // Handle reconnect
  const handleReconnect = React.useCallback(() => {
    // The gateway connection is managed by the app-level hook
    // This would trigger a reconnect attempt
    window.location.reload();
  }, []);

  // Retry handler for errors
  const handleRetry = React.useCallback(async () => {
    setIsRetrying(true);
    try {
      await Promise.all([refetchHealth(), refetchConfig()]);
      toast.success("Gateway status refreshed");
    } catch {
      // Error will be shown by ErrorState
    } finally {
      setIsRetrying(false);
    }
  }, [refetchHealth, refetchConfig]);

  // Error state (config error or persistent gateway error)
  if (configError) {
    return (
      <Card className={className}>
        <CardContent className="py-6">
          <ErrorState
            variant="inline"
            title={errorMessages.config.title}
            description={errorMessages.config.description}
            onRetry={handleRetry}
            isRetrying={isRetrying}
          />
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (isConfigLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <GatewayConfig
      status={status}
      port={port}
      accessMode={accessMode}
      customBind={customBind}
      authToken={authToken}
      onConfigChange={handleConfigChange}
      onReconnect={handleReconnect}
      className={className}
    />
  );
}

export default GatewayConfigConnected;
