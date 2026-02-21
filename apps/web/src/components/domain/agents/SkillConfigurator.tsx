"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Search,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Package,
  Loader2,
  Download,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useLiveSkills, useUpdateSkill, type SkillStatusEntry } from "@/lib/api/gateway-hooks";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillConfiguratorProps {
  agentId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SkillConfigurator({ agentId: _agentId }: SkillConfiguratorProps) {
  const { data: skillReport, isLoading, error } = useLiveSkills();
  const updateSkill = useUpdateSkill();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showCategory, setShowCategory] = React.useState<"all" | "enabled" | "available" | "missing">("all");

  const skills = skillReport?.skills ?? [];

  const filteredSkills = React.useMemo(() => {
    let result = [...skills];

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.skillKey.toLowerCase().includes(q),
      );
    }

    // Filter by category
    switch (showCategory) {
      case "enabled":
        result = result.filter((s) => s.eligible && !s.disabled);
        break;
      case "available":
        result = result.filter((s) => s.eligible && s.disabled);
        break;
      case "missing":
        result = result.filter((s) => !s.eligible);
        break;
    }

    // Sort: enabled first, then available, then missing
    result.sort((a, b) => {
      const aScore = a.eligible && !a.disabled ? 0 : a.eligible ? 1 : 2;
      const bScore = b.eligible && !b.disabled ? 0 : b.eligible ? 1 : 2;
      if (aScore !== bScore) {return aScore - bScore;}
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [skills, searchQuery, showCategory]);

  const stats = React.useMemo(() => {
    const enabled = skills.filter((s) => s.eligible && !s.disabled).length;
    const available = skills.filter((s) => s.eligible && s.disabled).length;
    const missing = skills.filter((s) => !s.eligible).length;
    return { total: skills.length, enabled, available, missing };
  }, [skills]);

  const handleToggleSkill = (skill: SkillStatusEntry) => {
    updateSkill.mutate({
      skillKey: skill.skillKey,
      enabled: skill.disabled, // Toggle: if disabled → enable, if enabled → disable
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="size-6 mx-auto animate-spin text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Loading skills…</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="size-6 mx-auto text-destructive mb-2" />
          <p className="text-sm text-destructive">Failed to load skills</p>
          <p className="text-xs text-muted-foreground mt-1">
            Make sure you're connected to the gateway.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="size-5" />
          Skills
        </CardTitle>
        <CardDescription>
          Enable skills to extend your agent's capabilities with external services and tools.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="flex gap-2">
          <FilterChip
            label={`All (${stats.total})`}
            active={showCategory === "all"}
            onClick={() => setShowCategory("all")}
          />
          <FilterChip
            label={`Enabled (${stats.enabled})`}
            active={showCategory === "enabled"}
            onClick={() => setShowCategory("enabled")}
            color="emerald"
          />
          <FilterChip
            label={`Available (${stats.available})`}
            active={showCategory === "available"}
            onClick={() => setShowCategory("available")}
            color="blue"
          />
          <FilterChip
            label={`Missing Deps (${stats.missing})`}
            active={showCategory === "missing"}
            onClick={() => setShowCategory("missing")}
            color="amber"
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <Separator />

        {/* Skill List */}
        <div className="space-y-2">
          {filteredSkills.length === 0 ? (
            <div className="py-8 text-center">
              <Package className="size-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No skills found.</p>
            </div>
          ) : (
            filteredSkills.map((skill) => (
              <SkillRow
                key={skill.skillKey}
                skill={skill}
                onToggle={() => handleToggleSkill(skill)}
              />
            ))
          )}
        </div>

        {/* Workspace info */}
        {skillReport?.workspaceDir && (
          <p className="text-xs text-muted-foreground pt-2">
            Skills directory:{" "}
            <code className="text-[10px] bg-muted px-1 py-0.5 rounded">
              {skillReport.managedSkillsDir}
            </code>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? color === "emerald"
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : color === "blue"
              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              : color === "amber"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "bg-primary/20 text-primary border border-primary/30"
          : "bg-muted/50 text-muted-foreground border border-border hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

function SkillRow({
  skill,
  onToggle,
}: {
  skill: SkillStatusEntry;
  onToggle: () => void;
}) {
  const isEnabled = skill.eligible && !skill.disabled;
  const isMissing = !skill.eligible;
  const hasMissingDeps =
    skill.missing.bins.length > 0 ||
    skill.missing.env.length > 0 ||
    skill.missing.config.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
        isEnabled
          ? "border-emerald-500/20 bg-emerald-500/5"
          : isMissing
            ? "border-amber-500/20 bg-amber-500/5"
            : "border-border"
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Emoji */}
        <span className="text-lg flex-shrink-0">{skill.emoji ?? "🔧"}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium truncate">{skill.name}</span>
            {skill.bundled && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                Built-in
              </Badge>
            )}
            {skill.always && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-500 border-emerald-500/30">
                Always on
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{skill.description}</p>

          {/* Missing dependencies */}
          {hasMissingDeps && (
            <div className="mt-1.5 space-y-1">
              {skill.missing.bins.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-400">
                  <XCircle className="size-3" />
                  <span>Missing binaries: {skill.missing.bins.join(", ")}</span>
                </div>
              )}
              {skill.missing.env.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-amber-400">
                  <XCircle className="size-3" />
                  <span>Missing env vars: {skill.missing.env.join(", ")}</span>
                </div>
              )}
              {skill.install.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1">
                  {skill.install.map((option) => (
                    <Badge
                      key={option.id}
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 gap-0.5 cursor-pointer hover:bg-primary/10"
                    >
                      <Download className="size-2.5" />
                      {option.label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
        {skill.homepage && (
          <a
            href={skill.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}

        {skill.always ? (
          <Badge variant="outline" className="text-xs text-emerald-500 border-emerald-500/30">
            <CheckCircle2 className="size-3 mr-1" />
            Active
          </Badge>
        ) : skill.eligible ? (
          <Switch
            checked={!skill.disabled}
            onCheckedChange={onToggle}
          />
        ) : (
          <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30">
            <AlertCircle className="size-3 mr-1" />
            Unavailable
          </Badge>
        )}
      </div>
    </motion.div>
  );
}

export default SkillConfigurator;
