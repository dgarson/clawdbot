"use client";
import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ComplexityGate } from "@/components/adaptive/complexity-gate";
import { GuidedTooltip } from "@/components/adaptive/guided-tooltip";
import { AdaptiveLabel } from "@/components/adaptive/adaptive-label";
import type {
  AgentsListResult,
  AgentIdentityResult,
  SessionEntry,
} from "@/lib/gateway/types";
import {
  Bot,
  MessageSquare,
  Clock,
  DollarSign,
  Plus,
  Wifi,
  WifiOff,
  ArrowRight,
  Activity,
  Sparkles,
  Zap,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  variant?: "default" | "success" | "warning" | "destructive";
};

function StatCard({ title, value, description, icon: Icon, trend, variant = "default" }: StatCardProps) {
  const borderColors = {
    default: "",
    success: "border-l-4 border-l-success",
    warning: "border-l-4 border-l-warning",
    destructive: "border-l-4 border-l-destructive",
  };

  return (
    <Card className={borderColors[variant]}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="rounded-lg bg-muted p-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        {trend && (
          <p className="mt-2 text-xs text-muted-foreground">{trend}</p>
        )}
      </CardContent>
    </Card>
  );
}

function AgentCard({
  agent,
  identity,
}: {
  agent: { id: string; name?: string };
  identity?: AgentIdentityResult;
}) {
  const emoji = identity?.emoji ?? "🤖";
  const name = identity?.name ?? agent.name ?? agent.id;

  return (
    <Link href={`/agents/${agent.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-lg">
              {emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                {name}
              </p>
              <p className="text-xs text-muted-foreground">{agent.id}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyAgents() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-accent p-4 mb-4">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-semibold text-lg mb-1">No agents yet</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          Create your first AI agent to get started. You can use a template or build one from scratch.
        </p>
        <Button asChild>
          <Link href="/agents/new">
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const connected = useGatewayStore((s) => s.connected);
  const request = useGatewayStore((s) => s.request);
  const snapshot = useGatewayStore((s) => s.snapshot);

  const [agents, setAgents] = React.useState<AgentsListResult | null>(null);
  const [identities, setIdentities] = React.useState<Record<string, AgentIdentityResult>>({});
  const [sessions, setSessions] = React.useState<SessionEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadData = React.useCallback(async () => {
    if (!connected) return;
    try {
      const [agentsList, sessionsList] = await Promise.all([
        request<AgentsListResult>("agents.list", {}),
        request<{ sessions: SessionEntry[] }>("sessions.list", {
          limit: 20,
          includeLastMessage: true,
          includeDerivedTitles: true,
        }),
      ]);
      setAgents(agentsList);
      setSessions(sessionsList.sessions ?? []);

      // Load identities for each agent
      const idMap: Record<string, AgentIdentityResult> = {};
      await Promise.all(
        (agentsList.agents ?? []).map(async (a) => {
          try {
            const id = await request<AgentIdentityResult>("agent.identity.get", {
              agentId: a.id,
            });
            idMap[a.id] = id;
          } catch {
            // ignore
          }
        })
      );
      setIdentities(idMap);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [connected, request]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const agentCount = agents?.agents?.length ?? 0;
  const activeSessions = sessions.filter(
    (s) => s.lastActiveAtMs && Date.now() - s.lastActiveAtMs < 3600_000
  ).length;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            <AdaptiveLabel
              beginner="Here's what's happening with your AI agents"
              standard="Your OpenClaw dashboard overview"
              expert="System overview"
            />
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Agents"
          value={agentCount}
          description={agentCount === 1 ? "agent configured" : "agents configured"}
          icon={Bot}
        />
        <StatCard
          title="Status"
          value={connected ? "Online" : "Offline"}
          description={connected ? "Gateway connected" : "Attempting to connect..."}
          icon={connected ? Wifi : WifiOff}
          variant={connected ? "success" : "destructive"}
        />
        <StatCard
          title="Active Sessions"
          value={activeSessions}
          description="in the last hour"
          icon={MessageSquare}
        />
        <ComplexityGate
          level="standard"
          fallback={
            <StatCard
              title="Quick Start"
              value="→"
              description="Create your first agent"
              icon={Sparkles}
            />
          }
        >
          <StatCard
            title="Uptime"
            value={
              snapshot?.uptimeMs
                ? `${Math.floor(snapshot.uptimeMs / 3_600_000)}h`
                : "—"
            }
            description="Gateway uptime"
            icon={Activity}
          />
        </ComplexityGate>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/agents/new">
              <Plus className="h-4 w-4 mr-2" />
              <AdaptiveLabel
                beginner="Create AI Agent"
                standard="New Agent"
                expert="New Agent"
              />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/chat">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </Link>
          </Button>
          <ComplexityGate level="standard">
            <Button variant="outline" asChild>
              <Link href="/cron">
                <Clock className="h-4 w-4 mr-2" />
                New Automation
              </Link>
            </Button>
          </ComplexityGate>
          <ComplexityGate level="standard">
            <Button variant="outline" asChild>
              <Link href="/skills">
                <Zap className="h-4 w-4 mr-2" />
                Browse Skills
              </Link>
            </Button>
          </ComplexityGate>
        </div>
      </div>

      {/* Agents grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            <AdaptiveLabel
              beginner="Your AI Agents"
              standard="Agents"
              expert="Agents"
            />
          </h2>
          {agentCount > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/agents">View all →</Link>
            </Button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-24 bg-muted rounded" />
                      <div className="h-3 w-16 bg-muted rounded" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : agentCount === 0 ? (
          <EmptyAgents />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents!.agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                identity={identities[agent.id]}
              />
            ))}
            <Link href="/agents/new">
              <Card className="border-dashed hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer h-full">
                <CardContent className="p-4 flex items-center justify-center h-full min-h-[72px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Plus className="h-5 w-5" />
                    <span className="text-sm font-medium">Add Agent</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <ComplexityGate level="standard">
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Sessions</h2>
          {sessions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p className="text-sm">No recent sessions</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {sessions.slice(0, 8).map((session) => (
                <Card key={session.key} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-medium">
                          {session.agentId?.slice(0, 2).toUpperCase() ?? "??"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {session.derivedTitle ?? session.label ?? session.key}
                          </p>
                          {session.lastMessage && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {session.lastMessage}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        {session.agentId && (
                          <Badge variant="secondary" className="text-[10px]">
                            {session.agentId}
                          </Badge>
                        )}
                        {session.lastActiveAtMs && (
                          <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(session.lastActiveAtMs)}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ComplexityGate>
    </div>
  );
}

function formatTimeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
