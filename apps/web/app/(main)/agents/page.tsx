"use client";
import * as React from "react";
import Link from "next/link";
import { useGatewayStore } from "@/lib/stores/gateway";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ComplexityGate } from "@/components/adaptive/complexity-gate";
import { AdaptiveLabel } from "@/components/adaptive/adaptive-label";
import { GuidedTooltip } from "@/components/adaptive/guided-tooltip";
import type { AgentsListResult, AgentIdentityResult } from "@/lib/gateway/types";
import {
  Bot,
  Plus,
  Search,
  Grid3X3,
  List,
  MoreVertical,
  Settings2,
  MessageSquare,
  Trash2,
  FileText,
} from "lucide-react";

type ViewMode = "grid" | "list";

export default function AgentsPage() {
  const connected = useGatewayStore((s) => s.connected);
  const request = useGatewayStore((s) => s.request);

  const [agents, setAgents] = React.useState<AgentsListResult | null>(null);
  const [identities, setIdentities] = React.useState<Record<string, AgentIdentityResult>>({});
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");

  React.useEffect(() => {
    if (!connected) {return;}
    (async () => {
      try {
        const result = await request<AgentsListResult>("agents.list", {});
        setAgents(result);
        // Load identities
        const idMap: Record<string, AgentIdentityResult> = {};
        await Promise.all(
          (result.agents ?? []).map(async (a) => {
            try {
              const id = await request<AgentIdentityResult>("agent.identity.get", { agentId: a.id });
              idMap[a.id] = id;
            } catch { /* skip */ }
          })
        );
        setIdentities(idMap);
      } catch (err) {
        console.error("Failed to load agents:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [connected, request]);

  const filteredAgents = React.useMemo(() => {
    if (!agents?.agents) {return [];}
    if (!searchQuery.trim()) {return agents.agents;}
    const q = searchQuery.toLowerCase();
    return agents.agents.filter((a) => {
      const name = identities[a.id]?.name ?? a.name ?? a.id;
      return name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q);
    });
  }, [agents, identities, searchQuery]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <AdaptiveLabel beginner="Your AI Agents" standard="Agents" expert="Agents" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <AdaptiveLabel
              beginner="Create and manage your AI assistants"
              standard="Manage agent configurations and workspaces"
              expert="Agent registry and workspace management"
            />
          </p>
        </div>
        <Button asChild>
          <Link href="/agents/new">
            <Plus className="h-4 w-4 mr-2" />
            <AdaptiveLabel beginner="Create Agent" standard="New Agent" expert="New" />
          </Link>
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <ComplexityGate level="standard">
          <div className="flex items-center border rounded-lg">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("list")}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </ComplexityGate>
      </div>

      {/* Agent grid/list */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-muted" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-20 bg-muted rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-accent p-4 mb-4">
              <Bot className="h-10 w-10 text-primary" />
            </div>
            <h3 className="font-semibold text-xl mb-2">
              {searchQuery ? "No agents found" : "No agents yet"}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              {searchQuery
                ? `No agents matching "${searchQuery}". Try a different search.`
                : "Create your first AI agent to get started. Choose a template or build from scratch."}
            </p>
            {!searchQuery && (
              <Button size="lg" asChild>
                <Link href="/agents/new">
                  <Plus className="h-5 w-5 mr-2" />
                  Create Your First Agent
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => {
            const identity = identities[agent.id];
            const emoji = identity?.emoji ?? "🤖";
            const name = identity?.name ?? agent.name ?? agent.id;
            const isDefault = agent.id === agents?.defaultId;

            return (
              <Link key={agent.id} href={`/agents/${agent.id}`}>
                <Card className="hover:shadow-md transition-all cursor-pointer group h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-2xl">
                        {emoji}
                      </div>
                      {isDefault && (
                        <Badge variant="secondary" className="text-[10px]">Default</Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                      {name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{agent.id}</p>
                    <div className="flex items-center gap-2 mt-4">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" asChild onClick={(e) => e.stopPropagation()}>
                        <Link href={`/chat?agent=${agent.id}`}>
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Chat
                        </Link>
                      </Button>
                      <ComplexityGate level="standard">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild onClick={(e) => e.stopPropagation()}>
                          <Link href={`/agents/${agent.id}`}>
                            <FileText className="h-3 w-3 mr-1" />
                            Files
                          </Link>
                        </Button>
                      </ComplexityGate>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {/* Add agent card */}
          <Link href="/agents/new">
            <Card className="border-dashed hover:border-primary/50 transition-all cursor-pointer h-full min-h-[180px]">
              <CardContent className="flex flex-col items-center justify-center h-full p-6">
                <div className="rounded-full bg-accent p-3 mb-3">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Add Agent</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      ) : (
        /* List view */
        <div className="space-y-2">
          {filteredAgents.map((agent) => {
            const identity = identities[agent.id];
            const emoji = identity?.emoji ?? "🤖";
            const name = identity?.name ?? agent.name ?? agent.id;
            const isDefault = agent.id === agents?.defaultId;

            return (
              <Link key={agent.id} href={`/agents/${agent.id}`}>
                <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-lg">
                          {emoji}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{name}</p>
                            {isDefault && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{agent.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" asChild onClick={(e) => e.stopPropagation()}>
                          <Link href={`/chat?agent=${agent.id}`}>
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Chat
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
