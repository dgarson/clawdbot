"use client";

import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";
import { useProficiency } from "@/lib/stores/proficiency";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ComplexityGate } from "@/components/adaptive/complexity-gate";
import { AdaptiveLabel } from "@/components/adaptive/adaptive-label";
import type { ChannelsStatusResult, ChannelAccount } from "@/lib/gateway/types";
import {
  Radio,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  MessageCircle,
  Plug,
  RefreshCw,
  Unplug,
  Clock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Channel icon & color mapping
// ---------------------------------------------------------------------------

const CHANNEL_ICONS: Record<string, string> = {
  discord: "🎮",
  whatsapp: "📱",
  telegram: "✈️",
  slack: "💼",
  signal: "🔒",
  webchat: "🌐",
  sms: "💬",
  email: "📧",
  irc: "📺",
};

function channelIcon(pluginKey: string): string {
  const lower = pluginKey.toLowerCase();
  for (const [key, icon] of Object.entries(CHANNEL_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "📡";
}

function statusBadge(status: ChannelAccount["status"]) {
  switch (status) {
    case "connected":
      return { variant: "success" as const, icon: CheckCircle2, label: "Connected" };
    case "disconnected":
      return { variant: "secondary" as const, icon: XCircle, label: "Disconnected" };
    case "error":
      return { variant: "destructive" as const, icon: AlertCircle, label: "Error" };
    case "starting":
      return { variant: "warning" as const, icon: Loader2, label: "Starting" };
    default:
      return { variant: "outline" as const, icon: Radio, label: status ?? "Unknown" };
  }
}

function relativeTime(ms: number | undefined): string {
  if (!ms) return "never";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChannelsPage() {
  const connected = useGatewayStore((s) => s.connected);
  const request = useGatewayStore((s) => s.request);
  const { isAtLeast } = useProficiency();

  const [channelData, setChannelData] = React.useState<ChannelsStatusResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadChannels = React.useCallback(async () => {
    if (!connected) return;
    try {
      const result = await request<ChannelsStatusResult>("channels.status", {});
      setChannelData(result);
    } catch (err) {
      console.error("Failed to load channel status:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [connected, request]);

  React.useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadChannels();
  };

  // Derive ordered channel list
  const channelKeys = React.useMemo(() => {
    if (!channelData) return [];
    // Use channelOrder if available, fall back to keys of channelAccounts
    if (channelData.channelOrder?.length) return channelData.channelOrder;
    return Object.keys(channelData.channelAccounts ?? {});
  }, [channelData]);

  // Count total connected
  const connectedCount = React.useMemo(() => {
    if (!channelData?.channelAccounts) return 0;
    return Object.values(channelData.channelAccounts)
      .flat()
      .filter((a) => a.status === "connected").length;
  }, [channelData]);

  const totalAccounts = React.useMemo(() => {
    if (!channelData?.channelAccounts) return 0;
    return Object.values(channelData.channelAccounts).flat().length;
  }, [channelData]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <AdaptiveLabel beginner="Messaging" standard="Channels" expert="Channels" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <AdaptiveLabel
              beginner="See which messaging apps are connected to your agents"
              standard="Connection status for all messaging channels"
              expert="Channel plugin status and account details"
            />
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && channelData && (
            <Badge variant="outline" className="text-xs">
              {connectedCount}/{totalAccounts} connected
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={handleRefresh}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Separator />

      {/* Loading skeletons */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted" />
                  <div>
                    <div className="h-5 w-28 bg-muted rounded" />
                    <div className="h-3 w-20 bg-muted rounded mt-2" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-3 w-full bg-muted rounded" />
                <div className="h-3 w-2/3 bg-muted rounded mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : channelKeys.length === 0 ? (
        /* Empty state */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-accent p-4 mb-4">
              <Unplug className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              <AdaptiveLabel
                beginner="No messaging apps connected"
                standard="No channels configured"
                expert="No channel plugins active"
              />
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              <AdaptiveLabel
                beginner="Connect a messaging app like Discord, WhatsApp, or Telegram to start chatting with your agents."
                standard="Configure channel plugins in your openclaw.yaml to connect messaging platforms."
                expert="No channel plugins registered. Add channel configuration to openclaw.yaml."
              />
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Channel cards */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {channelKeys.map((channelKey) => {
            const label = channelData!.channelLabels?.[channelKey] ?? channelKey;
            const accounts = channelData!.channelAccounts?.[channelKey] ?? [];
            const icon = channelIcon(channelKey);

            // Overall status for the channel
            const hasConnected = accounts.some((a) => a.status === "connected");
            const hasError = accounts.some((a) => a.status === "error");
            const allDisconnected = accounts.every((a) => a.status === "disconnected");

            return (
              <Card key={channelKey}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-accent text-xl">
                        {icon}
                      </div>
                      <div>
                        <CardTitle className="text-base">{label}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {accounts.length} account{accounts.length !== 1 ? "s" : ""}
                        </CardDescription>
                      </div>
                    </div>
                    {hasConnected ? (
                      <Badge variant="success">
                        <AdaptiveLabel beginner="Online" standard="Connected" expert="Connected" />
                      </Badge>
                    ) : hasError ? (
                      <Badge variant="destructive">Error</Badge>
                    ) : allDisconnected ? (
                      <Badge variant="secondary">
                        <AdaptiveLabel beginner="Offline" standard="Disconnected" expert="Disconnected" />
                      </Badge>
                    ) : (
                      <Badge variant="warning">Starting</Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pb-3 space-y-3">
                  {accounts.map((account, idx) => {
                    const st = statusBadge(account.status);
                    const StatusIcon = st.icon;

                    return (
                      <div key={account.accountId ?? idx}>
                        {idx > 0 && <Separator className="mb-3" />}
                        <div className="space-y-2">
                          {/* Status line */}
                          <div className="flex items-center gap-2">
                            <StatusIcon
                              className={`h-3.5 w-3.5 shrink-0 ${
                                account.status === "connected"
                                  ? "text-success"
                                  : account.status === "error"
                                    ? "text-destructive"
                                    : account.status === "starting"
                                      ? "text-warning animate-spin"
                                      : "text-muted-foreground"
                              }`}
                            />
                            <span className="text-sm">
                              <AdaptiveLabel
                                beginner={st.label}
                                standard={`${st.label}${account.label ? ` — ${account.label}` : ""}`}
                                expert={`${st.label} · ${account.accountId}`}
                              />
                            </span>
                          </div>

                          {/* Last activity */}
                          {account.lastActivityAtMs && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span>
                                <AdaptiveLabel
                                  beginner={`Active ${relativeTime(account.lastActivityAtMs)}`}
                                  standard={`Last activity: ${relativeTime(account.lastActivityAtMs)}`}
                                  expert={`Last activity: ${new Date(account.lastActivityAtMs).toISOString()}`}
                                />
                              </span>
                            </div>
                          )}

                          {/* Error message */}
                          {account.error && (
                            <div className="text-xs text-destructive bg-destructive/10 rounded p-2">
                              {account.error}
                            </div>
                          )}

                          {/* Expert: full account details */}
                          <ComplexityGate level="expert">
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1.5">
                                <Badge variant="outline" className="text-xs font-mono">
                                  plugin:{account.plugin}
                                </Badge>
                                <Badge variant="outline" className="text-xs font-mono">
                                  id:{account.accountId}
                                </Badge>
                              </div>
                              {account.meta && Object.keys(account.meta).length > 0 && (
                                <details className="text-xs">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                                    Metadata ({Object.keys(account.meta).length} fields)
                                  </summary>
                                  <pre className="mt-1 p-2 bg-muted rounded text-[11px] font-mono overflow-x-auto max-h-32">
                                    {JSON.stringify(account.meta, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          </ComplexityGate>
                        </div>
                      </div>
                    );
                  })}

                  {accounts.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">
                      No accounts configured for this channel.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
