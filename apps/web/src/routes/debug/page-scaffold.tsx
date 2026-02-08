"use client";

import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  CirclePlus,
  ClipboardList,
  Layers3,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  PageScaffold,
  PageScaffoldSection,
  type PageScaffoldState,
} from "@/components/layout";
import { RouteErrorFallback } from "@/components/composed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/debug/page-scaffold")({
  component: PageScaffoldPreviewPage,
  errorComponent: RouteErrorFallback,
});

const STATE_OPTIONS: Array<{ value: PageScaffoldState; label: string }> = [
  { value: "ready", label: "Ready" },
  { value: "loading", label: "Loading" },
  { value: "empty", label: "Empty" },
  { value: "error", label: "Error" },
];

function PageScaffoldPreviewPage() {
  const [state, setState] = React.useState<PageScaffoldState>("ready");
  const [isRetrying, setIsRetrying] = React.useState(false);
  const retryTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const handleRetry = () => {
    setIsRetrying(true);
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
    }
    retryTimerRef.current = window.setTimeout(() => {
      setState("ready");
      setIsRetrying(false);
      retryTimerRef.current = null;
    }, 900);
  };

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      {STATE_OPTIONS.map((option) => (
        <Button
          key={option.value}
          variant={state === option.value ? "default" : "outline"}
          size="sm"
          onClick={() => setState(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );

  return (
    <PageScaffold
      title="Page Scaffold Preview"
      description="Preview the shared route scaffold primitives without replacing existing production pages."
      breadcrumbs={[
        { label: "Debug", href: "/debug" },
        { label: "Page Scaffold Preview" },
      ]}
      actions={controls}
      state={state}
      onRetry={handleRetry}
      isRetrying={isRetrying}
      emptyTitle="No preview content loaded"
      emptyDescription="Switch to the ready state to preview how sections render inside the scaffold."
      emptyAction={
        <Button size="sm" onClick={() => setState("ready")}>
          <CirclePlus className="h-4 w-4" />
          Load preview content
        </Button>
      }
      errorTitle="Failed to load preview state"
      errorDescription="This is an intentional error mode for testing scaffold behavior."
    >
      <PageScaffoldSection
        title="Overview"
        description="Shared top-level summary cards that most pages need."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Execution health</CardDescription>
              <CardTitle className="text-xl">98%</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Stable over last 24h
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending approvals</CardDescription>
              <CardTitle className="text-xl">6</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-warning" />
                2 high-priority requests
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tasks completed</CardDescription>
              <CardTitle className="text-xl">42</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={78} className="h-2" />
              <p className="text-xs text-muted-foreground">78% of weekly target</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active workstreams</CardDescription>
              <CardTitle className="text-xl">9</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Layers3 className="h-4 w-4 text-primary" />
                3 recently updated
              </div>
            </CardContent>
          </Card>
        </div>
      </PageScaffoldSection>

      <PageScaffoldSection
        title="Recent Activity"
        description="Example section body to validate list-oriented content inside the scaffold."
        actions={
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      >
        <Card>
          <CardContent className="space-y-3 p-4">
            {[
              {
                title: "Session replay regenerated",
                detail: "Agent Ops · 2 minutes ago",
                tag: "System",
              },
              {
                title: "Approvals digest sent",
                detail: "Scheduler · 11 minutes ago",
                tag: "Automation",
              },
              {
                title: "Goal status updated",
                detail: "Planning Assistant · 25 minutes ago",
                tag: "Workflow",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <Badge variant="secondary">{item.tag}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </PageScaffoldSection>

      <PageScaffoldSection
        title="Scaffold Notes"
        description="Reference examples for common page-level section patterns."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4" />
                Header Slot
              </CardTitle>
              <CardDescription>
                Supports breadcrumb navigation, title/description, and actions.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4" />
                State Modes
              </CardTitle>
              <CardDescription>
                Ready/loading/empty/error modes are centralized in one layout primitive.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers3 className="h-4 w-4" />
                Section Primitive
              </CardTitle>
              <CardDescription>
                Reusable section framing keeps route content hierarchy consistent.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </PageScaffoldSection>
    </PageScaffold>
  );
}
