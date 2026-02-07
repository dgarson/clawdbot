"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CardSkeleton } from "@/components/composed";
import { useChannelsStatus } from "@/hooks/queries/useChannels";
import { useConfig } from "@/hooks/queries/useConfig";
import type { ChannelAccountSnapshot } from "@/lib/api";

const CHANNEL_EXTRA_FIELDS = ["groupPolicy", "streamMode", "dmPolicy"] as const;

function resolveChannelConfigValue(
  config: Record<string, unknown> | undefined,
  channelId: string
): Record<string, unknown> | null {
  if (!config) {
    return null;
  }
  const channels = (config.channels ?? {}) as Record<string, unknown>;
  const fromChannels = channels[channelId];
  if (fromChannels && typeof fromChannels === "object") {
    return fromChannels as Record<string, unknown>;
  }
  const fallback = config[channelId];
  if (fallback && typeof fallback === "object") {
    return fallback as Record<string, unknown>;
  }
  return null;
}

function formatChannelExtraValue(raw: unknown): string {
  if (raw == null) {
    return "n/a";
  }
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    return String(raw);
  }
  try {
    return JSON.stringify(raw);
  } catch {
    return "n/a";
  }
}

function resolveChannelExtras(
  config: Record<string, unknown> | undefined,
  channelId: string
): Array<{ label: string; value: string }> {
  const value = resolveChannelConfigValue(config, channelId);
  if (!value) {
    return [];
  }
  return CHANNEL_EXTRA_FIELDS.flatMap((field) => {
    if (!(field in value)) {
      return [];
    }
    return [{ label: field, value: formatChannelExtraValue(value[field]) }];
  });
}

function summarizeChannelAccounts(accounts: ChannelAccountSnapshot[]) {
  let connected = 0;
  let configured = 0;
  let enabled = 0;
  for (const account of accounts) {
    if (account.connected) {
      connected += 1;
    }
    if (account.configured) {
      configured += 1;
    }
    if (account.enabled) {
      enabled += 1;
    }
  }
  return { connected, configured, enabled, total: accounts.length };
}

function formatTimestamp(ts?: number) {
  if (!ts) {
    return "never";
  }
  return new Date(ts).toLocaleString();
}

export function AgentChannelsTab() {
  const { data, isLoading, error, refetch, isFetching } = useChannelsStatus({ probe: false });
  const { data: configSnapshot } = useConfig();

  const entries = React.useMemo(() => {
    if (!data) {
      return [];
    }
    const order = data.channelOrder?.length
      ? data.channelOrder
      : Object.keys(data.channels ?? {});
    return order.map((id) => ({
      id,
      label: data.channelLabels?.[id] ?? id,
      accounts: data.channelAccounts?.[id] ?? [],
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="p-6 text-center">
          <p className="text-destructive">Failed to load channels</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Channels</h3>
              <p className="text-sm text-muted-foreground">
                Gateway-wide channel status snapshot.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Last refresh: {formatTimestamp(data?.ts)}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          </div>

          {!data && (
            <Alert>
              <AlertDescription>Load channels to see live status.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {entries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-medium">No channels found</h3>
            <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
              Connect a messaging channel to see its status here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const summary = summarizeChannelAccounts(entry.accounts);
            const extras = resolveChannelExtras(
              configSnapshot?.config as Record<string, unknown> | undefined,
              entry.id
            );
            return (
              <Card key={entry.id} className="border-border/50">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-base font-semibold">{entry.label}</div>
                      <div className="text-xs text-muted-foreground">{entry.id}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">
                        {summary.total ? `${summary.connected}/${summary.total} connected` : "no accounts"}
                      </Badge>
                      <Badge variant="secondary">
                        {summary.total ? `${summary.configured} configured` : "not configured"}
                      </Badge>
                      <Badge variant="secondary">
                        {summary.total ? `${summary.enabled} enabled` : "disabled"}
                      </Badge>
                    </div>
                  </div>

                  {extras.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {extras.map((extra) => (
                        <Badge key={extra.label} variant="outline">
                          {extra.label}: {extra.value}
                        </Badge>
                      ))}
                    </div>
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

export default AgentChannelsTab;
