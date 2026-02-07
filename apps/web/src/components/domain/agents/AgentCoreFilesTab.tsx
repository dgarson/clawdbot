"use client";

import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  FileText,
  RefreshCw,
  Save,
  RotateCcw,
  AlertTriangle,
  Wand2,
  Pencil,
} from "lucide-react";
import {
  getAgentFile,
  listAgentFiles,
  setAgentFile,
  type AgentFileEntry,
  type AgentsFilesListResult,
} from "@/lib/api";

interface AgentCoreFilesTabProps {
  agentId: string;
}

type EditorMode = "guided" | "direct";

type GuidedFile = {
  key: string;
  label: string;
  description: string;
  fileName: string;
  helper?: string;
};

const GUIDED_FILES: GuidedFile[] = [
  {
    key: "agents",
    label: "Agents",
    description: "Primary directives, boundaries, and role definition.",
    fileName: "AGENTS.md",
  },
  {
    key: "soul",
    label: "Soul",
    description: "Persona, voice, and identity calibration.",
    fileName: "SOUL.md",
  },
  {
    key: "tools",
    label: "Tools",
    description: "Tooling access, policies, and usage guidance.",
    fileName: "TOOLS.md",
  },
  {
    key: "skills",
    label: "Skills",
    description: "Skill playbooks and capability notes.",
    fileName: "TOOLS.md",
    helper: "Stored in TOOLS.md for now.",
  },
];

function formatBytes(bytes?: number): string {
  if (bytes === undefined) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB", "TB"] as const;
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatUpdatedAt(updatedAtMs?: number): string {
  if (!updatedAtMs) {
    return "Unknown";
  }
  const now = Date.now();
  const diff = Math.max(0, now - updatedAtMs);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(updatedAtMs).toLocaleDateString();
}

function mergeFileEntry(
  list: AgentsFilesListResult | null,
  entry: AgentFileEntry
): AgentsFilesListResult | null {
  if (!list) {
    return list;
  }
  const hasEntry = list.files.some((file) => file.name === entry.name);
  const nextFiles = hasEntry
    ? list.files.map((file) => (file.name === entry.name ? entry : file))
    : [...list.files, entry];
  return { ...list, files: nextFiles };
}

function resolveStatusLabel(file: AgentFileEntry | null): string {
  if (!file) {
    return "Not loaded";
  }
  if (file.missing) {
    return "Missing";
  }
  return `${formatBytes(file.size)} · ${formatUpdatedAt(file.updatedAtMs)}`;
}

export function AgentCoreFilesTab({ agentId }: AgentCoreFilesTabProps) {
  const [mode, setMode] = React.useState<EditorMode>("guided");
  const [list, setList] = React.useState<AgentsFilesListResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeFile, setActiveFile] = React.useState<string | null>(null);
  const [guidedActive, setGuidedActive] = React.useState<string>(GUIDED_FILES[0].key);
  const [contents, setContents] = React.useState<Record<string, string>>({});
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [savingFile, setSavingFile] = React.useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = React.useState<Record<string, boolean>>({});

  const guidedDefinition = React.useMemo(() => {
    return GUIDED_FILES.find((file) => file.key === guidedActive) ?? GUIDED_FILES[0];
  }, [guidedActive]);

  const activeGuidedFileName = guidedDefinition.fileName;

  const fileEntries = list?.files ?? [];

  const activeEntry = activeFile
    ? fileEntries.find((file) => file.name === activeFile) ?? null
    : null;
  const guidedEntry = fileEntries.find((file) => file.name === activeGuidedFileName) ?? null;

  const getDraftValue = (name: string) => {
    const base = contents[name] ?? "";
    return drafts[name] ?? base;
  };

  const isDirty = (name: string | null) => {
    if (!name) {
      return false;
    }
    return getDraftValue(name) !== (contents[name] ?? "");
  };

  const setFileLoading = (name: string, value: boolean) => {
    setLoadingFiles((prev) => ({ ...prev, [name]: value }));
  };

  const loadFiles = React.useCallback(async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await listAgentFiles(agentId);
      setList(res);
      setActiveFile((prev) => {
        if (prev && res.files.some((file) => file.name === prev)) {
          return prev;
        }
        return res.files[0]?.name ?? null;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [agentId, loading]);

  const loadFileContent = React.useCallback(
    async (name: string, opts?: { force?: boolean; preserveDraft?: boolean }) => {
      if (!opts?.force && Object.hasOwn(contents, name)) {
        return;
      }
      if (loadingFiles[name]) {
        return;
      }
      setFileLoading(name, true);
      setError(null);
      try {
        const res = await getAgentFile(agentId, name);
        if (res?.file) {
          const content = res.file.content ?? "";
          const previousBase = contents[name] ?? "";
          const currentDraft = drafts[name];
          const preserveDraft = opts?.preserveDraft ?? true;
          setList((prev) => mergeFileEntry(prev, res.file));
          setContents((prev) => ({ ...prev, [name]: content }));
          if (!preserveDraft || currentDraft === undefined || currentDraft === previousBase) {
            setDrafts((prev) => ({ ...prev, [name]: content }));
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setFileLoading(name, false);
      }
    },
    [agentId, contents, drafts, loadingFiles]
  );

  const handleSave = async (name: string) => {
    if (savingFile) {
      return;
    }
    setSavingFile(name);
    setError(null);
    try {
      const content = getDraftValue(name);
      const res = await setAgentFile(agentId, name, content);
      if (res?.file) {
        setList((prev) => mergeFileEntry(prev, res.file));
        setContents((prev) => ({ ...prev, [name]: content }));
        setDrafts((prev) => ({ ...prev, [name]: content }));
        toast.success("File saved");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error("Failed to save file");
    } finally {
      setSavingFile(null);
    }
  };

  const handleReset = (name: string) => {
    setDrafts((prev) => ({ ...prev, [name]: contents[name] ?? "" }));
  };

  React.useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  React.useEffect(() => {
    if (!activeFile || mode !== "direct") {
      return;
    }
    void loadFileContent(activeFile);
  }, [activeFile, loadFileContent, mode]);

  React.useEffect(() => {
    if (mode !== "guided") {
      return;
    }
    void loadFileContent(activeGuidedFileName);
  }, [activeGuidedFileName, loadFileContent, mode]);

  const renderFileRow = (file: AgentFileEntry, isActive: boolean, onSelect: () => void) => {
    const status = resolveStatusLabel(file);
    const dirty = isDirty(file.name);
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-left transition hover:border-primary/40",
          isActive && "border-primary/70 bg-primary/5"
        )}
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{file.name}</span>
            {file.missing ? (
              <Badge variant="secondary" className="text-[10px]">
                missing
              </Badge>
            ) : null}
            {dirty ? (
              <Badge variant="outline" className="text-[10px]">
                unsaved
              </Badge>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground">{status}</div>
        </div>
      </button>
    );
  };

  const renderGuidedItem = (item: GuidedFile, isActive: boolean) => {
    const entry = fileEntries.find((file) => file.name === item.fileName) ?? null;
    return (
      <button
        type="button"
        onClick={() => setGuidedActive(item.key)}
        className={cn(
          "flex w-full flex-col gap-1 rounded-lg border border-border/60 px-3 py-2 text-left transition hover:border-primary/40",
          isActive && "border-primary/70 bg-primary/5"
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{item.label}</span>
          {isDirty(item.fileName) ? (
            <Badge variant="outline" className="text-[10px]">
              unsaved
            </Badge>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">{item.description}</div>
        <div className="text-[11px] text-muted-foreground font-mono">
          {item.fileName} · {resolveStatusLabel(entry)}
        </div>
      </button>
    );
  };

  const renderEditorHeader = (label: string, entry: AgentFileEntry | null, name: string) => {
    const presenceLabel = entry ? (entry.missing ? "Missing file" : "Existing file") : "Not loaded";
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{label}</span>
            <span className="text-xs text-muted-foreground font-mono">{name}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {presenceLabel} · {resolveStatusLabel(entry)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleReset(name)}
            disabled={!isDirty(name)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={() => handleSave(name)}
            disabled={!isDirty(name) || savingFile === name}
          >
            <Save className="mr-2 h-4 w-4" />
            {savingFile === name ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Core Files
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Edit the core markdown files that define this agent’s persona, tools, and skills.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadFiles} disabled={loading}>
                <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
                {loading ? "Refreshing" : "Refresh"}
              </Button>
            </div>
          </div>
          {list ? (
            <div className="rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground font-mono">
              Workspace: {list.workspace}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Load the agent workspace files to edit core instructions.
            </div>
          )}
          <Tabs value={mode} onValueChange={(value) => setMode(value as EditorMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="guided" className="gap-1.5">
                <Wand2 className="h-4 w-4" />
                Guided
              </TabsTrigger>
              <TabsTrigger value="direct" className="gap-1.5">
                <Pencil className="h-4 w-4" />
                Direct Edit
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Failed to load files</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {!list ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Workspace not loaded</AlertTitle>
              <AlertDescription>
                Connect to the gateway and refresh to list the core agent files.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="space-y-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Files</div>
                {mode === "guided"
                  ? GUIDED_FILES.map((item) => (
                      <div key={item.key}>
                        {renderGuidedItem(item, item.key === guidedActive)}
                      </div>
                    ))
                  : fileEntries.length === 0
                    ? (
                      <div className="text-sm text-muted-foreground">No files found.</div>
                    )
                    : fileEntries.map((file) => (
                        <div key={file.name}>
                          {renderFileRow(file, file.name === activeFile, () => setActiveFile(file.name))}
                        </div>
                      ))}
              </div>
              <div className="space-y-4">
                {mode === "guided" ? (
                  <div className="space-y-3">
                    {renderEditorHeader(guidedDefinition.label, guidedEntry, activeGuidedFileName)}
                    <div className="text-sm text-muted-foreground">
                      {guidedDefinition.description}
                      {guidedDefinition.helper ? (
                        <span className="block text-xs text-muted-foreground mt-1">
                          {guidedDefinition.helper}
                        </span>
                      ) : null}
                    </div>
                    {guidedEntry?.missing ? (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>File missing</AlertTitle>
                        <AlertDescription>
                          Saving will create {activeGuidedFileName} in the workspace.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <Textarea
                      value={getDraftValue(activeGuidedFileName)}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [activeGuidedFileName]: event.target.value,
                        }))
                      }
                      className="min-h-[320px] font-mono text-sm"
                      placeholder={`Edit ${activeGuidedFileName}...`}
                      disabled={loadingFiles[activeGuidedFileName]}
                    />
                  </div>
                ) : activeEntry ? (
                  <div className="space-y-3">
                    {renderEditorHeader(activeEntry.name, activeEntry, activeEntry.name)}
                    <div className="text-xs text-muted-foreground font-mono">{activeEntry.path}</div>
                    {activeEntry.missing ? (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>File missing</AlertTitle>
                        <AlertDescription>
                          This file does not exist yet. Saving will create it in the workspace.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <Textarea
                      value={getDraftValue(activeEntry.name)}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [activeEntry.name]: event.target.value,
                        }))
                      }
                      className="min-h-[320px] font-mono text-sm"
                      placeholder={`Edit ${activeEntry.name}...`}
                      disabled={loadingFiles[activeEntry.name]}
                    />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Select a file to begin.</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
