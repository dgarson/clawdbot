"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useGatewayStore } from "@/lib/stores/gateway";
import { useProficiency } from "@/lib/stores/proficiency";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ComplexityGate } from "@/components/adaptive/complexity-gate";
import { AdaptiveLabel } from "@/components/adaptive/adaptive-label";
import type {
  AgentIdentityResult,
  AgentsFilesListResult,
  AgentFileEntry,
} from "@/lib/gateway/types";
import {
  Bot,
  FileText,
  Save,
  RefreshCw,
  MessageSquare,
  ChevronLeft,
  Loader2,
  Check,
  AlertCircle,
  Trash2,
  Settings2,
  Eye,
  Wand2,
} from "lucide-react";

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;
  const connected = useGatewayStore((s) => s.connected);
  const request = useGatewayStore((s) => s.request);
  const { level, isAtLeast } = useProficiency();

  const [identity, setIdentity] = React.useState<AgentIdentityResult | null>(null);
  const [files, setFiles] = React.useState<AgentsFilesListResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeFile, setActiveFile] = React.useState<string | null>(null);
  const [fileContents, setFileContents] = React.useState<Record<string, string>>({});
  const [fileDrafts, setFileDrafts] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load agent data
  React.useEffect(() => {
    if (!connected || !agentId) return;
    (async () => {
      try {
        const [id, filesList] = await Promise.all([
          request<AgentIdentityResult>("agent.identity.get", { agentId }),
          request<AgentsFilesListResult>("agents.files.list", { agentId }),
        ]);
        setIdentity(id);
        setFiles(filesList);

        // Load file contents
        const contents: Record<string, string> = {};
        for (const file of filesList.files) {
          if (!file.missing) {
            try {
              const result = await request<{ file: AgentFileEntry }>("agents.files.get", {
                agentId,
                name: file.name,
              });
              if (result.file.content !== undefined) {
                contents[file.name] = result.file.content;
              }
            } catch { /* skip */ }
          }
        }
        setFileContents(contents);
        setFileDrafts({ ...contents });

        // Auto-select first file
        const firstFile = filesList.files.find((f) => !f.missing);
        if (firstFile) setActiveFile(firstFile.name);
      } catch (err) {
        setError("Failed to load agent details");
      } finally {
        setLoading(false);
      }
    })();
  }, [connected, request, agentId]);

  const handleSave = async (fileName: string) => {
    if (!connected || saving) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await request("agents.files.set", {
        agentId,
        name: fileName,
        content: fileDrafts[fileName] ?? "",
      });
      setFileContents((prev) => ({ ...prev, [fileName]: fileDrafts[fileName] ?? "" }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save file");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = activeFile ? fileDrafts[activeFile] !== fileContents[activeFile] : false;
  const emoji = identity?.emoji ?? "🤖";
  const name = identity?.name ?? agentId;

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-96 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-sm" onClick={() => router.push("/agents")}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-2xl">
              {emoji}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{name}</h1>
              <p className="text-sm text-muted-foreground">{agentId}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/chat?agent=${agentId}`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </Link>
          </Button>
        </div>
      </div>

      {/* File editor */}
      <div className="flex gap-4 min-h-[500px]">
        {/* File list */}
        <div className="w-48 shrink-0">
          <Card className="h-full">
            <CardHeader className="p-3">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <AdaptiveLabel beginner="Files" standard="Agent Files" expert="Workspace Files" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className="space-y-0.5">
                {files?.files.map((file) => (
                  <button
                    key={file.name}
                    onClick={() => setActiveFile(file.name)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${
                      activeFile === file.name
                        ? "bg-accent text-accent-foreground"
                        : file.missing
                        ? "text-muted-foreground/50 hover:bg-accent/50"
                        : "text-muted-foreground hover:bg-accent/50"
                    }`}
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{file.name}</span>
                    {fileDrafts[file.name] !== fileContents[file.name] && (
                      <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Editor */}
        <div className="flex-1 min-w-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="p-3 flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">
                  {activeFile ?? "No file selected"}
                </Badge>
                {isDirty && (
                  <Badge variant="warning" className="text-[10px]">Modified</Badge>
                )}
              </div>
              {activeFile && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (activeFile && fileContents[activeFile] !== undefined) {
                        setFileDrafts((prev) => ({
                          ...prev,
                          [activeFile]: fileContents[activeFile],
                        }));
                      }
                    }}
                    disabled={!isDirty}
                    className="h-7 text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Revert
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => activeFile && handleSave(activeFile)}
                    disabled={!isDirty || saving}
                    className="h-7 text-xs"
                  >
                    {saving ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : saveSuccess ? (
                      <Check className="h-3 w-3 mr-1" />
                    ) : (
                      <Save className="h-3 w-3 mr-1" />
                    )}
                    {saving ? "Saving..." : saveSuccess ? "Saved!" : "Save"}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 p-0">
              {activeFile ? (
                <Textarea
                  value={fileDrafts[activeFile] ?? ""}
                  onChange={(e) =>
                    setFileDrafts((prev) => ({
                      ...prev,
                      [activeFile]: e.target.value,
                    }))
                  }
                  className="h-full min-h-[400px] rounded-none border-0 font-mono text-sm resize-none focus-visible:ring-0"
                  placeholder={`Edit ${activeFile}...`}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Select a file to edit
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
