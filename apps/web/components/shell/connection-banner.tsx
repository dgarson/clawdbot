"use client";
import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";
import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw, X, Loader2 } from "lucide-react";

export function ConnectionBanner() {
  const connected = useGatewayStore((s) => s.connected);
  const connecting = useGatewayStore((s) => s.connecting);
  const error = useGatewayStore((s) => s.error);
  const connect = useGatewayStore((s) => s.connect);
  const [dismissed, setDismissed] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);

  // Reset dismissed state when connection changes
  React.useEffect(() => {
    if (connected) {
      setDismissed(false);
      setRetrying(false);
    }
  }, [connected]);

  // Don't show if connected, connecting, or dismissed
  if (connected || connecting || dismissed) return null;

  const handleRetry = () => {
    setRetrying(true);
    // Attempt to reconnect to default gateway
    const url = typeof window !== "undefined"
      ? `ws://${window.location.hostname}:18789`
      : "ws://localhost:18789";
    connect(url);
    setTimeout(() => setRetrying(false), 5000);
  };

  return (
    <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2.5">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WifiOff className="h-4 w-4 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">Gateway Disconnected</p>
            {error && (
              <p className="text-xs text-destructive/80 mt-0.5">{error}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-destructive/20 text-destructive hover:bg-destructive/10"
            onClick={handleRetry}
            disabled={retrying}
          >
            {retrying ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Retry
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded text-destructive/60 hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
