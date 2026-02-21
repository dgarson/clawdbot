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
import type { CronJob } from "@/lib/gateway/types";
import {
  Clock,
  Plus,
  Play,
  Pencil,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle2,
  Timer,
  CalendarClock,
  Zap,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a CronSchedule to a beginner-friendly description */
function friendlySchedule(schedule: CronJob["schedule"]): string {
  if (schedule.kind === "every") {
    const mins = Math.round(schedule.everyMs / 60_000);
    if (mins < 60) return `Every ${mins} minute${mins === 1 ? "" : "s"}`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `Every ${hrs} hour${hrs === 1 ? "" : "s"}`;
    const days = Math.round(hrs / 24);
    return `Every ${days} day${days === 1 ? "" : "s"}`;
  }
  if (schedule.kind === "at") {
    try {
      const d = new Date(schedule.at);
      return `Once at ${d.toLocaleString()}`;
    } catch {
      return `Once at ${schedule.at}`;
    }
  }
  if (schedule.kind === "cron") {
    return cronExprToFriendly(schedule.expr);
  }
  return "Custom schedule";
}

/** Best-effort cron-expression → plain English */
function cronExprToFriendly(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;
  const [min, hour, dom, , dow] = parts;

  // "0 7 * * *" → "Every morning at 7:00 AM"
  if (dom === "*" && dow === "*" && !min.includes(",") && !hour.includes(",")) {
    const h = parseInt(hour, 10);
    const m = parseInt(min, 10);
    if (!isNaN(h) && !isNaN(m)) {
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const mm = m.toString().padStart(2, "0");
      return `Every day at ${h12}:${mm} ${ampm}`;
    }
  }

  // "*/5 * * * *" → "Every 5 minutes"
  if (min.startsWith("*/")) {
    const n = parseInt(min.slice(2), 10);
    if (!isNaN(n)) return `Every ${n} minute${n === 1 ? "" : "s"}`;
  }

  return `Cron: ${expr}`;
}

/** Technical schedule label */
function technicalSchedule(schedule: CronJob["schedule"]): string {
  if (schedule.kind === "cron") return schedule.expr + (schedule.tz ? ` (${schedule.tz})` : "");
  if (schedule.kind === "every") return `every ${schedule.everyMs}ms`;
  if (schedule.kind === "at") return `at ${schedule.at}`;
  return JSON.stringify(schedule);
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CronPage() {
  const connected = useGatewayStore((s) => s.connected);
  const request = useGatewayStore((s) => s.request);
  const { isAtLeast } = useProficiency();

  const [jobs, setJobs] = React.useState<CronJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [runningJobs, setRunningJobs] = React.useState<Set<string>>(new Set());
  const [togglingJobs, setTogglingJobs] = React.useState<Set<string>>(new Set());

  // Load jobs
  const loadJobs = React.useCallback(async () => {
    if (!connected) return;
    try {
      const result = await request<{ jobs: CronJob[] }>("cron.list", {});
      setJobs(result.jobs ?? []);
    } catch (err) {
      console.error("Failed to load cron jobs:", err);
    } finally {
      setLoading(false);
    }
  }, [connected, request]);

  React.useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Actions
  const handleRunNow = async (jobId: string) => {
    setRunningJobs((prev) => new Set(prev).add(jobId));
    try {
      await request("cron.run", { jobId });
      // Reload to get updated state
      await loadJobs();
    } catch (err) {
      console.error("Failed to run job:", err);
    } finally {
      setRunningJobs((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const handleToggle = async (job: CronJob) => {
    setTogglingJobs((prev) => new Set(prev).add(job.id));
    try {
      await request("cron.update", { jobId: job.id, enabled: !job.enabled });
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, enabled: !j.enabled } : j))
      );
    } catch (err) {
      console.error("Failed to toggle job:", err);
    } finally {
      setTogglingJobs((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <AdaptiveLabel beginner="Automations" standard="Automations" expert="Cron Jobs" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <AdaptiveLabel
              beginner="Set up tasks that run automatically on a schedule"
              standard="Schedule recurring agent tasks and automations"
              expert="Manage cron-scheduled agent invocations"
            />
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          <AdaptiveLabel beginner="New Automation" standard="New Automation" expert="New Job" />
        </Button>
      </div>

      <Separator />

      {/* Loading skeletons */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-40 bg-muted rounded" />
                <div className="h-3 w-28 bg-muted rounded mt-2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 w-full bg-muted rounded" />
                  <div className="h-3 w-3/4 bg-muted rounded" />
                </div>
              </CardContent>
              <CardFooter>
                <div className="h-8 w-20 bg-muted rounded" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        /* Empty state */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-accent p-4 mb-4">
              <CalendarClock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              <AdaptiveLabel
                beginner="No automations yet"
                standard="No automations configured"
                expert="No cron jobs"
              />
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              <AdaptiveLabel
                beginner="Create your first automation to have your agents work on a schedule — like sending daily summaries or checking for updates."
                standard="Create scheduled tasks that run your agents automatically."
                expert="No cron jobs registered. Create one to schedule agent invocations."
              />
            </p>
            <Button className="mt-6">
              <Plus className="h-4 w-4 mr-2" />
              <AdaptiveLabel beginner="Create Automation" standard="New Automation" expert="New Job" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Job cards */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {jobs.map((job) => {
            const isRunning = runningJobs.has(job.id);
            const isToggling = togglingJobs.has(job.id);

            return (
              <Card
                key={job.id}
                className={!job.enabled ? "opacity-60" : undefined}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="shrink-0 rounded-md bg-accent p-1.5">
                        {job.enabled ? (
                          <Zap className="h-4 w-4 text-primary" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <CardTitle className="text-base truncate">{job.name || job.id}</CardTitle>
                    </div>
                    <Badge variant={job.enabled ? "success" : "secondary"}>
                      {job.enabled ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  {job.description && (
                    <CardDescription className="mt-1.5">{job.description}</CardDescription>
                  )}
                </CardHeader>

                <CardContent className="pb-3 space-y-2 text-sm">
                  {/* Schedule */}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Timer className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {isAtLeast("expert")
                        ? technicalSchedule(job.schedule)
                        : friendlySchedule(job.schedule)}
                    </span>
                  </div>

                  {/* Last run */}
                  {job.state.lastRunAtMs && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {job.state.lastStatus === "ok" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                      ) : job.state.lastStatus === "error" ? (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>
                        <AdaptiveLabel
                          beginner={`Last ran ${relativeTime(job.state.lastRunAtMs)}`}
                          standard={`Last run: ${relativeTime(job.state.lastRunAtMs)}`}
                          expert={`Last: ${relativeTime(job.state.lastRunAtMs)} (${job.state.lastStatus ?? "unknown"}${job.state.lastDurationMs ? `, ${job.state.lastDurationMs}ms` : ""})`}
                        />
                      </span>
                    </div>
                  )}

                  {/* Next run (expert) */}
                  <ComplexityGate level="standard">
                    {job.state.nextRunAtMs && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                        <span>Next: {relativeTime(job.state.nextRunAtMs).replace("ago", "").trim() === "just now" ? "imminent" : new Date(job.state.nextRunAtMs).toLocaleString()}</span>
                      </div>
                    )}
                  </ComplexityGate>

                  {/* Error info (expert) */}
                  <ComplexityGate level="expert">
                    {job.state.lastError && (
                      <div className="text-xs text-destructive bg-destructive/10 rounded p-2 mt-1">
                        {job.state.lastError}
                      </div>
                    )}
                    {(job.state.consecutiveErrors ?? 0) > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {job.state.consecutiveErrors} consecutive errors
                      </Badge>
                    )}
                  </ComplexityGate>

                  {/* Agent / Session info (expert) */}
                  <ComplexityGate level="expert">
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {job.agentId && (
                        <Badge variant="outline" className="text-xs font-mono">
                          agent:{job.agentId}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs font-mono">
                        {job.sessionTarget}
                      </Badge>
                    </div>
                  </ComplexityGate>
                </CardContent>

                <CardFooter className="pt-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isRunning || !job.enabled}
                    onClick={() => handleRunNow(job.id)}
                  >
                    {isRunning ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Run Now
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isToggling}
                    onClick={() => handleToggle(job)}
                    className="ml-auto"
                  >
                    {isToggling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : job.enabled ? (
                      <ToggleRight className="h-4 w-4 text-success" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
