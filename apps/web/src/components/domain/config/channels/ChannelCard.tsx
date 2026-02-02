"use client";

import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  Settings2,
  Shield,
  Monitor,
  AlertCircle,
  Check,
  Loader2,
  Download,
  AlertTriangle,
  XCircle,
  Activity,
  Trash2,
  ChevronDown,
} from "lucide-react";
import * as Collapsible from "@radix-ui/react-collapsible";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { channelIconMap, channelColorMap } from "./icons";
import type { ChannelConfig, ChannelStatus, PlatformType, ChannelActivityItem } from "./types";

interface ChannelCardProps {
  channel: ChannelConfig;
  currentPlatform?: PlatformType;
  onConfigure: () => void;
  onUninstall?: () => void;
  className?: string;
}

const statusConfig: Record<
  ChannelStatus,
  { label: string; variant: "success" | "secondary" | "error" | "warning"; icon: React.ReactNode; dotClass: string }
> = {
  connected: {
    label: "Connected",
    variant: "success",
    icon: <Check className="h-3 w-3" />,
    dotClass: "bg-green-500 shadow-[0_0_8px_2px] shadow-green-500/50",
  },
  not_configured: {
    label: "Not configured",
    variant: "secondary",
    icon: null,
    dotClass: "bg-red-500/70 shadow-[0_0_8px_2px] shadow-red-500/40",
  },
  error: {
    label: "Error",
    variant: "error",
    icon: <AlertCircle className="h-3 w-3" />,
    dotClass: "bg-red-500 shadow-[0_0_8px_2px] shadow-red-500/50",
  },
  connecting: {
    label: "Connecting",
    variant: "warning",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    dotClass: "bg-yellow-500 shadow-[0_0_8px_2px] shadow-yellow-500/40",
  },
  unsupported: {
    label: "Unsupported",
    variant: "secondary",
    icon: <XCircle className="h-3 w-3" />,
    dotClass: "bg-muted-foreground/40",
  },
};

function isPlatformSupported(supported: PlatformType[], current: PlatformType): boolean {
  return supported.includes("any") || supported.includes(current);
}

export function ChannelCard({
  channel,
  currentPlatform = "any",
  onConfigure,
  onUninstall,
  className,
}: ChannelCardProps) {
  const IconComponent = channelIconMap[channel.id];
  const channelColor = channelColorMap[channel.id];
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  // Determine if the channel is supported on current platform
  const isSupported = channel.platform
    ? isPlatformSupported(channel.platform.supported, currentPlatform)
    : true;

  // Override status if unsupported
  const effectiveStatus = isSupported ? channel.status : "unsupported";
  const status = statusConfig[effectiveStatus];

  // Check if installation is required
  const requiresInstallation = channel.platform?.requiresInstallation;
  const requiresMacServer = channel.platform?.requiresMacServer;
  const hasRelayProviders = channel.platform?.relayProviders && channel.platform.relayProviders.length > 0;
  const activities = channel.activity ?? [];
  const isInstalled = Boolean(channel.platform?.installed);
  const showActivity =
    activities.length > 0 &&
    effectiveStatus !== "not_configured" &&
    effectiveStatus !== "unsupported";
  const showDetails =
    showActivity ||
    Boolean(channel.platform) ||
    Boolean(channel.lastConnected) ||
    Boolean(channel.statusMessage) ||
    effectiveStatus === "unsupported";
  const showStatusMessageInline = effectiveStatus === "error";

  const statusTooltip = (
    <div className="space-y-0.5">
      <div className="font-medium">{status.label}</div>
      {channel.statusMessage && <div className="text-muted">{channel.statusMessage}</div>}
    </div>
  );

  const buildActivityHref = (activity: ChannelActivityItem) => {
    const params = new URLSearchParams({
      tab: "activity",
      activityId: activity.id,
    });
    if (activity.sessionId) {params.set("sessionId", activity.sessionId);}
    return `/agents/${encodeURIComponent(activity.agentId)}?${params.toString()}`;
  };

  return (
    <TooltipProvider>
      <Card
        className={cn(
          "group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/30",
          effectiveStatus === "connected" && "border-success/30",
          effectiveStatus === "error" && "border-error/30",
          effectiveStatus === "unsupported" && "border-muted opacity-75",
          className
        )}
      >
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            {/* Header: Icon + Name + Status */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
                    effectiveStatus === "unsupported" && "opacity-50"
                  )}
                  style={{ backgroundColor: `${channelColor}20` }}
                >
                  <IconComponent className="h-5 w-5" style={{ color: channelColor }} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground truncate">{channel.name}</h3>
                    {channel.isAdvanced && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Advanced setup required</TooltipContent>
                      </Tooltip>
                    )}
                    {channel.localOnly && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Local machine only</TooltipContent>
                      </Tooltip>
                    )}
                    {requiresMacServer && currentPlatform !== "macos" && (
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        </TooltipTrigger>
                        <TooltipContent>Requires Mac server</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
                </div>
              </div>
              {requiresInstallation && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted/50 text-muted-foreground">
                      <Download className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    Requires installation: {channel.platform?.installationApp}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Footer: Status + Configure Button */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="relative flex h-5 w-5 items-center justify-center">
                      {effectiveStatus === "connecting" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                      ) : (
                        <>
                          <span className={cn("h-3 w-3 rounded-full", status.dotClass)} />
                          {(effectiveStatus === "connected" || effectiveStatus === "error") && (
                            <span
                              className={cn(
                                "absolute h-3 w-3 rounded-full opacity-40 animate-ping",
                                status.dotClass.replace(/shadow\\[[^\\]]+\\]/g, "")
                              )}
                            />
                          )}
                        </>
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{statusTooltip}</TooltipContent>
                </Tooltip>
                <Badge variant={status.variant} className="gap-1">
                  {status.icon}
                  {status.label}
                </Badge>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onConfigure}
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Settings2 className="h-4 w-4" />
                  {effectiveStatus === "connected"
                    ? "Settings"
                    : effectiveStatus === "unsupported"
                      ? hasRelayProviders
                        ? "Options"
                        : "Info"
                      : "Configure"}
                </Button>
                {requiresInstallation && isInstalled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUninstall?.()}
                    disabled={!onUninstall || channel.status === "connecting"}
                    className="gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                    Uninstall
                  </Button>
                )}
              </div>
            </div>

            {/* Status message (error or info) */}
            {channel.statusMessage && showStatusMessageInline && (
              <p
                className={cn(
                  "text-xs",
                  effectiveStatus === "error" ? "text-error" : "text-muted-foreground"
                )}
              >
                {channel.statusMessage}
              </p>
            )}

            {showDetails && (
              <Collapsible.Root open={detailsOpen} onOpenChange={setDetailsOpen}>
                <Collapsible.Trigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      {detailsOpen ? "Hide details" : "View details"}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        detailsOpen && "rotate-180"
                      )}
                    />
                  </Button>
                </Collapsible.Trigger>
                <Collapsible.Content className="pt-3">
                  <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
                    {channel.platform && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Platform</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {channel.platform.supported.map((platform) => (
                            <Badge
                              key={platform}
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                platform === currentPlatform && "border-primary/50 bg-primary/5"
                              )}
                            >
                              {platform === "any" ? "All Platforms" : platform}
                            </Badge>
                          ))}
                          {requiresInstallation && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-warning/50 text-warning"
                            >
                              Install Required
                            </Badge>
                          )}
                          {isInstalled && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-success/50 text-success"
                            >
                              Installed
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {showActivity && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Channel Activity</p>
                        {activities.map((activity) => (
                          <Link
                            key={activity.id}
                            to={buildActivityHref(activity)}
                            className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm transition hover:border-primary/40"
                          >
                            <div className="flex items-center gap-3">
                              <span className="relative flex h-4 w-4 items-center justify-center">
                                <span
                                  className={cn(
                                    "h-2.5 w-2.5 rounded-full",
                                    activity.status === "active" && "bg-green-500 shadow-[0_0_8px_2px] shadow-green-500/50",
                                    activity.status === "error" && "bg-red-500 shadow-[0_0_8px_2px] shadow-red-500/50",
                                    activity.status === "idle" && "bg-muted-foreground/60"
                                  )}
                                />
                                {activity.status === "active" && (
                                  <span className="absolute h-2.5 w-2.5 rounded-full bg-green-500/40 animate-ping" />
                                )}
                              </span>
                              <div>
                                <p className="text-sm font-medium">{activity.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {activity.agentName} • {activity.timestamp}
                                </p>
                                {activity.summary && (
                                  <p className="text-xs text-muted-foreground">{activity.summary}</p>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">View session</span>
                          </Link>
                        ))}
                      </div>
                    )}

                    {channel.statusMessage && !showStatusMessageInline && (
                      <p className="text-xs text-muted-foreground">{channel.statusMessage}</p>
                    )}

                    {effectiveStatus === "connected" && channel.lastConnected && (
                      <p className="text-xs text-muted-foreground">
                        Connected {channel.lastConnected}
                      </p>
                    )}

                    {effectiveStatus === "unsupported" && (
                      <p className="text-xs text-muted-foreground">
                        {hasRelayProviders
                          ? "Not available on this platform. Alternative options available."
                          : `Only available on: ${channel.platform?.supported.join(", ")}`}
                      </p>
                    )}
                  </div>
                </Collapsible.Content>
              </Collapsible.Root>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
