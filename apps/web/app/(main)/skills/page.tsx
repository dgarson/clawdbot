"use client";

import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ComplexityGate } from "@/components/adaptive/complexity-gate";
import { AdaptiveLabel } from "@/components/adaptive/adaptive-label";
import type { SkillEntry, SkillStatusReport } from "@/lib/gateway/types";
import {
  Search,
  RefreshCw,
  Puzzle,
  ToggleLeft,
  ToggleRight,
  Package,
  Sparkles,
  Store,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkillCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="h-3 w-40 rounded bg-muted" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-3/4 rounded bg-muted" />
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="h-5 w-12 rounded bg-muted" />
        <div className="h-8 w-20 rounded bg-muted" />
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          {hasFilter ? (
            <Search className="h-8 w-8 text-muted-foreground" />
          ) : (
            <Puzzle className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <h3 className="text-lg font-semibold mb-1">
          {hasFilter ? "No matching skills" : "No skills installed"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {hasFilter ? (
            "Try a different search term."
          ) : (
            <AdaptiveLabel
              beginner="Skills add new abilities to your agent. Browse the marketplace to get started."
              standard="No skills installed. Add skills to extend your agent's capabilities."
              expert="No skills registered in the current runtime. Install via config or marketplace."
            />
          )}
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skill card
// ---------------------------------------------------------------------------

function SkillCard({
  skill,
  onToggle,
  toggling,
}: {
  skill: SkillEntry;
  onToggle: (key: string, enabled: boolean) => void;
  toggling: boolean;
}) {
  return (
    <Card
      className={cn(
        "transition-colors",
        !skill.enabled && "opacity-70"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              skill.enabled ? "bg-primary/10" : "bg-muted"
            )}
          >
            <Puzzle
              className={cn(
                "h-5 w-5",
                skill.enabled
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{skill.name}</CardTitle>
            {skill.version && (
              <CardDescription className="text-xs">
                v{skill.version}
              </CardDescription>
            )}
          </div>
          <Badge variant={skill.enabled ? "default" : "secondary"}>
            {skill.enabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      </CardHeader>

      {skill.description && (
        <CardContent className="pb-3 pt-0">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {skill.description}
          </p>
        </CardContent>
      )}

      <CardFooter className="flex items-center justify-between pt-0">
        <ComplexityGate level="standard">
          <span className="text-xs text-muted-foreground font-mono">
            {skill.key}
          </span>
        </ComplexityGate>

        <Button
          variant="ghost"
          size="sm"
          disabled={toggling}
          onClick={() => onToggle(skill.key, !skill.enabled)}
          className={cn(
            skill.enabled
              ? "text-emerald-600 hover:text-emerald-700"
              : "text-muted-foreground"
          )}
        >
          {skill.enabled ? (
            <ToggleRight className="mr-1.5 h-4 w-4" />
          ) : (
            <ToggleLeft className="mr-1.5 h-4 w-4" />
          )}
          {skill.enabled ? "Disable" : "Enable"}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Marketplace placeholder
// ---------------------------------------------------------------------------

function MarketplacePlaceholder() {
  return (
    <Card className="border-dashed bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-primary/10 p-4 mb-4">
          <Store className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-1">Skills Marketplace</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          <AdaptiveLabel
            beginner="Browse and install new abilities for your agent."
            standard="Discover community and first-party skills to extend your agent."
            expert="Browse the skill registry. Install, fork, or publish skills."
          />
        </p>
        <Button variant="outline" disabled>
          <Sparkles className="mr-1.5 h-4 w-4" />
          Coming Soon
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SkillsPage() {
  const { connected, request } = useGatewayStore();

  const [skills, setSkills] = React.useState<SkillEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState("");
  const [togglingKeys, setTogglingKeys] = React.useState<Set<string>>(
    new Set()
  );

  // Fetch skills
  const fetchSkills = React.useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setError(null);
    try {
      const result = await request<SkillStatusReport>("skills.status", {});
      setSkills(result.skills ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, [connected, request]);

  React.useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // Toggle skill enabled/disabled
  const handleToggle = React.useCallback(
    async (key: string, enabled: boolean) => {
      setTogglingKeys((prev) => new Set(prev).add(key));
      try {
        await request("skills.update", { key, enabled });
        setSkills((prev) =>
          prev.map((s) => (s.key === key ? { ...s, enabled } : s))
        );
      } catch {
        // revert optimistic: re-fetch
        fetchSkills();
      } finally {
        setTogglingKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [request, fetchSkills]
  );

  // Filtered skills
  const filtered = React.useMemo(() => {
    if (!filter.trim()) return skills;
    const q = filter.toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.key.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
    );
  }, [skills, filter]);

  const enabledCount = skills.filter((s) => s.enabled).length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <AdaptiveLabel
              beginner="Agent Abilities"
              standard="Skills"
              expert="Skill Registry"
            />
          </h1>
          <p className="text-sm text-muted-foreground">
            <AdaptiveLabel
              beginner="Tools and abilities your agent can use."
              standard="Manage installed skills and their configuration."
              expert="View, toggle, and manage registered skill plugins."
            />
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSkills}
          disabled={loading || !connected}
        >
          <RefreshCw
            className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {/* Connection warning */}
      {!connected && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-3">
            <WifiOff className="h-4 w-4 text-warning" />
            <p className="text-sm text-warning">
              Not connected to Gateway. Skill data may be stale.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary bar + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            <Package className="mr-1 h-3 w-3" />
            {skills.length} installed
          </Badge>
          <Badge variant="default">
            {enabledCount} active
          </Badge>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Skills grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkillCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilter={filter.trim().length > 0} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((skill) => (
            <SkillCard
              key={skill.key}
              skill={skill}
              onToggle={handleToggle}
              toggling={togglingKeys.has(skill.key)}
            />
          ))}
        </div>
      )}

      {/* Marketplace placeholder */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          <AdaptiveLabel
            beginner="Get More Abilities"
            standard="Browse Skills"
            expert="Marketplace"
          />
        </h2>
        <MarketplacePlaceholder />
      </div>
    </div>
  );
}
