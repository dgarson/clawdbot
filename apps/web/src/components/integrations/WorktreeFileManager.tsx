
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  Folder,
  FileText,
  RefreshCw,
  ArrowUp,
  Copy,
} from "lucide-react";
import type { WorktreeAdapter, WorktreeEntry } from "@/integrations/worktree";

function splitPath(path: string): string[] {
  return path
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizePath(path: string): string {
  const parts = splitPath(path);
  return `/${parts.join("/")}`;
}

function parentPath(path: string): string {
  const parts = splitPath(path);
  if (parts.length <= 1) {return "/";}
  return `/${parts.slice(0, -1).join("/")}`;
}

function formatBytes(bytes?: number): string {
  if (typeof bytes !== "number") {return "—";}
  if (bytes < 1024) {return `${bytes} B`;}
  const kb = bytes / 1024;
  if (kb < 1024) {return `${kb.toFixed(1)} KB`;}
  const mb = kb / 1024;
  if (mb < 1024) {return `${mb.toFixed(1)} MB`;}
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export type WorktreeFileManagerProps = {
  agentId: string;
  adapter: WorktreeAdapter;

  className?: string;
  height?: number | string;

  initialPath?: string;
  pinnedPaths?: Array<{ label: string; path: string }>;

  onPathChange?: (path: string) => void;
  onOpenFile?: (file: WorktreeEntry) => void;
};

export function WorktreeFileManager({
  agentId,
  adapter,
  className,
  height = 420,
  initialPath = "/",
  pinnedPaths,
  onPathChange,
  onOpenFile,
}: WorktreeFileManagerProps) {
  const [path, setPath] = React.useState(() => normalizePath(initialPath));
  const [pathInput, setPathInput] = React.useState(() => normalizePath(initialPath));

  React.useEffect(() => {
    const next = normalizePath(initialPath);
    setPath(next);
    setPathInput(next);
  }, [initialPath]);

  React.useEffect(() => {
    onPathChange?.(path);
  }, [path, onPathChange]);

  const query = useQuery({
    queryKey: ["worktree", agentId, path] as const,
    queryFn: ({ signal }) => adapter.list(agentId, path, { signal }),
  });

  const crumbs = React.useMemo(() => {
    const parts = splitPath(path);
    const out: Array<{ label: string; path: string }> = [{ label: "/", path: "/" }];
    let current = "";
    for (const p of parts) {
      current += `/${p}`;
      out.push({ label: p, path: current });
    }
    return out;
  }, [path]);

  const entries = query.data?.entries ?? [];

  const openDir = React.useCallback(
    (next: string) => {
      const normalized = normalizePath(next);
      setPath(normalized);
      setPathInput(normalized);
    },
    []
  );

  const onSubmitPath = React.useCallback(() => {
    openDir(pathInput);
  }, [openDir, pathInput]);

  const handleEntryClick = React.useCallback(
    (entry: WorktreeEntry) => {
      if (entry.kind === "dir") {
        openDir(entry.path);
        return;
      }
      onOpenFile?.(entry);
    },
    [onOpenFile, openDir]
  );

  return (
    <div
      className={cn("flex flex-col overflow-hidden rounded-xl border border-border bg-card", className)}
      style={{ height }}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Button
          size="icon-sm"
          variant="outline"
          onClick={() => openDir(parentPath(path))}
          title="Up one folder"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          onClick={() => void query.refetch()}
          title="Refresh"
          disabled={query.isFetching}
        >
          <RefreshCw className={cn("h-4 w-4", query.isFetching && "animate-spin")} />
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-1 text-xs text-muted-foreground">
          {crumbs.map((c, idx) => (
            <React.Fragment key={c.path}>
              {idx > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />}
              <button
                type="button"
                className={cn(
                  "max-w-[160px] truncate rounded px-1 py-0.5 hover:bg-muted/60",
                  c.path === path && "text-foreground"
                )}
                onClick={() => openDir(c.path)}
                title={c.path}
              >
                {c.label}
              </button>
            </React.Fragment>
          ))}
        </div>

        <Button
          size="icon-sm"
          variant="outline"
          onClick={() => {
            void copyToClipboard(path)
              .then(() => toast.success("Path copied"))
              .catch(() => toast.error("Failed to copy path"));
          }}
          title="Copy current path"
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>

      {pinnedPaths && pinnedPaths.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <div className="text-xs font-medium text-muted-foreground">Quick</div>
          {pinnedPaths.map((p) => (
            <button
              key={p.path}
              type="button"
              onClick={() => openDir(p.path)}
              className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-xs text-foreground hover:bg-muted/50"
              title={p.path}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="border-b border-border px-3 py-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitPath();
          }}
        >
          <Input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            className="h-8 font-mono text-xs"
            spellCheck={false}
          />
          <Button size="sm" variant="outline" type="submit">
            Go
          </Button>
        </form>
      </div>

      {query.error && (
        <div className="border-b border-border bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {query.error instanceof Error ? query.error.message : String(query.error)}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="divide-y divide-border/60">
          {query.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Empty folder</div>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                onClick={() => handleEntryClick(entry)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/40"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/40">
                  {entry.kind === "dir" ? (
                    <Folder className="h-4 w-4 text-primary" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {entry.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                      {entry.kind}
                    </Badge>
                    <span className="font-mono">{formatBytes(entry.sizeBytes)}</span>
                    {entry.modifiedAt ? <span>{new Date(entry.modifiedAt).toLocaleString()}</span> : null}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default WorktreeFileManager;
