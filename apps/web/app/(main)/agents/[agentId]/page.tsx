"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useGatewayStore } from "@/lib/stores/gateway";
import { useProficiency } from "@/lib/stores/proficiency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ComplexityGate } from "@/components/adaptive/complexity-gate";
import { AdaptiveLabel } from "@/components/adaptive/adaptive-label";
import type {
  AgentIdentityResult,
  AgentsFilesListResult,
  AgentFileEntry,
  SessionEntry,
  SessionsListResult,
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
  Settings2,
  Copy,
  Trash2,
  Activity,
  BarChart3,
  Clock,
  Zap,
  Hash,
  ExternalLink,
  Play,
  Pause,
  MoreHorizontal,
  Edit3,
  Plus,
  Download,
} from "lucide-react";

// ─── Tabs ────────────────────────────────────────────────
type DetailTab = "overview" | "files" | "sessions" | "config";

const TABS: { id: DetailTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "files", label: "Files", icon: FileText },
  { id: "sessions", label: "Sessions", icon: MessageSquare },
  { id: "config", label: "Configuration", icon: Settings2 },
];

// ─── Stat Card ───────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold tabular-nums">{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ─────────────────────────────────────────────
function relativeTime(ms: number | undefined): string {
  if (!ms) return "never";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Activity Item ───────────────────────────────────────
function ActivityItem({
  session,
}: {
  session: SessionEntry;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-accent/50 transition-colors group">
      <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {session.derivedTitle || session.label || session.key}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {session.channel && <span>{session.channel}</span>}
          <span>•</span>
          <span>{session.messageCount ?? 0} messages</span>
          <span>•</span>
          <span>{relativeTime(session.lastActiveAtMs)}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
        asChild
      >
        <Link href={`/chat?session=${session.key}`}>
          <ExternalLink className="h-3 w-3" />
        </Link>
      </Button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;
  const connected = useGatewayStore((s) => s.connected);
  const request = useGatewayStore((s) => s.request);
  const { isAtLeast } = useProficiency();

  // State
  const [tab, setTab] = React.useState<DetailTab>("overview");
  const [identity, setIdentity] = React.useState<AgentIdentityResult | null>(null);
  const [files, setFiles] = React.useState<AgentsFilesListResult | null>(null);
  const [sessions, setSessions] = React.useState<SessionEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeFile, setActiveFile] = React.useState<string | null>(null);
  const [fileContents, setFileContents] = React.useState<Record<string, string>>({});
  const [fileDrafts, setFileDrafts] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // Load agent data
  React.useEffect(() => {
    if (!connected || !agentId) return;
    void (async () => {
      try {
        const [id, filesList, sessionsList] = await Promise.all([
          request<AgentIdentityResult>("agent.identity.get", { agentId }),
          request<AgentsFilesListResult>("agents.files.list", { agentId }),
          request<SessionsListResult>("sessions.list", { agentId }).catch(() => ({ sessions: [] })),
        ]);
        setIdentity(id);
        setFiles(filesList);
        setSessions(sessionsList.sessions ?? []);

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

        // Auto-select SOUL.md or first file
        const soulFile = filesList.files.find((f) => f.name === "SOUL.md" && !f.missing);
        const firstFile = filesList.files.find((f) => !f.missing);
        setActiveFile((soulFile ?? firstFile)?.name ?? null);
      } catch {
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

  const handleDelete = async () => {
    if (!connected || deleting) return;
    setDeleting(true);
    try {
      await request("agents.delete", { agentId });
      router.push("/agents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete agent");
      setDeleting(false);
    }
  };

  const isDirty = activeFile ? fileDrafts[activeFile] !== fileContents[activeFile] : false;
  const emoji = identity?.emoji ?? "🤖";
  const name = identity?.name ?? agentId;
  const totalFiles = files?.files.length ?? 0;
  const existingFiles = files?.files.filter((f) => !f.missing).length ?? 0;
  const totalSize = files?.files.reduce((sum, f) => sum + (f.size ?? 0), 0) ?? 0;
  const recentSessions = sessions
    .sort((a, b) => (b.lastActiveAtMs ?? 0) - (a.lastActiveAtMs ?? 0))
    .slice(0, 10);
  const totalMessages = sessions.reduce((sum, s) => sum + (s.messageCount ?? 0), 0);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-muted rounded-xl" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-muted rounded" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
          </div>
          <div className="h-10 w-80 bg-muted rounded-lg" />
          <div className="h-96 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* ─── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/agents")}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Agents
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-3xl shadow-sm">
              {emoji}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px] font-mono">
                  {agentId}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {existingFiles} files
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {formatBytes(totalSize)}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/chat?agent=${agentId}`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </Link>
          </Button>
          <ComplexityGate level="standard">
            {deleteConfirm ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Confirm Delete
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirm(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </ComplexityGate>
        </div>
      </div>

      {/* ─── Tab Navigation ─────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.filter(
          (t) => t.id !== "config" || isAtLeast("expert")
        ).map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {t.id === "sessions" && sessions.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-1 h-5">
                  {sessions.length}
                </Badge>
              )}
              {t.id === "files" && isDirty && (
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Tab: Overview ──────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={MessageSquare}
              label="Total Sessions"
              value={sessions.length}
              sub={sessions.length > 0 ? `Last: ${relativeTime(sessions[0]?.lastActiveAtMs)}` : undefined}
            />
            <StatCard
              icon={Hash}
              label="Total Messages"
              value={totalMessages}
            />
            <StatCard
              icon={FileText}
              label="Workspace Files"
              value={`${existingFiles}/${totalFiles}`}
              sub={formatBytes(totalSize)}
            />
            <StatCard
              icon={Clock}
              label="Last Active"
              value={sessions.length > 0 ? relativeTime(recentSessions[0]?.lastActiveAtMs) : "Never"}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SOUL.md Preview */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    SOUL.md
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setActiveFile("SOUL.md");
                      setTab("files");
                    }}
                  >
                    <Edit3 className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {fileContents["SOUL.md"] ? (
                  <pre className="text-xs font-mono bg-muted p-4 rounded-lg overflow-auto max-h-64 whitespace-pre-wrap text-muted-foreground">
                    {fileContents["SOUL.md"]}
                  </pre>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Bot className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No SOUL.md found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This file defines your agent's personality and behavior.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        setFileDrafts((prev) => ({
                          ...prev,
                          "SOUL.md": "# Soul\n\nYou are...\n\n## Communication Style\n- \n",
                        }));
                        setActiveFile("SOUL.md");
                        setTab("files");
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Create SOUL.md
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start h-9 text-xs" asChild>
                  <Link href={`/chat?agent=${agentId}`}>
                    <MessageSquare className="h-3.5 w-3.5 mr-2" />
                    Start New Chat
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-9 text-xs"
                  onClick={() => {
                    setActiveFile("SOUL.md");
                    setTab("files");
                  }}
                >
                  <Edit3 className="h-3.5 w-3.5 mr-2" />
                  Edit SOUL.md
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-9 text-xs"
                  onClick={() => setTab("files")}
                >
                  <FileText className="h-3.5 w-3.5 mr-2" />
                  Manage Files
                </Button>
                <ComplexityGate level="standard">
                  <Button
                    variant="outline"
                    className="w-full justify-start h-9 text-xs"
                    onClick={() => setTab("config")}
                  >
                    <Settings2 className="h-3.5 w-3.5 mr-2" />
                    Agent Configuration
                  </Button>
                </ComplexityGate>
                <Separator />
                <Button
                  variant="outline"
                  className="w-full justify-start h-9 text-xs"
                  onClick={() => {
                    void navigator.clipboard.writeText(agentId);
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-2" />
                  Copy Agent ID
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Sessions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Recent Activity
                </CardTitle>
                {sessions.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setTab("sessions")}
                  >
                    View All
                    <ChevronLeft className="h-3 w-3 ml-1 rotate-180" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {recentSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No sessions yet</p>
                  <p className="text-xs mt-1">Start a chat to see activity here</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {recentSessions.slice(0, 5).map((session) => (
                    <ActivityItem key={session.key} session={session} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Tab: Files ─────────────────────────────── */}
      {tab === "files" && (
        <div className="flex gap-4 min-h-[500px]">
          {/* File list */}
          <div className="w-52 shrink-0">
            <Card className="h-full">
              <CardHeader className="p-3">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <AdaptiveLabel beginner="Files" standard="Agent Files" expert="Workspace" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 pt-0">
                <div className="space-y-0.5">
                  {files?.files.map((file) => (
                    <button
                      key={file.name}
                      onClick={() => setActiveFile(file.name)}
                      className={`w-full text-left px-2.5 py-2 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${
                        activeFile === file.name
                          ? "bg-accent text-accent-foreground"
                          : file.missing
                          ? "text-muted-foreground/50 hover:bg-accent/50"
                          : "text-muted-foreground hover:bg-accent/50"
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="truncate block">{file.name}</span>
                        {!file.missing && file.size !== undefined && (
                          <span className="text-[10px] opacity-60">{formatBytes(file.size)}</span>
                        )}
                      </div>
                      {fileDrafts[file.name] !== fileContents[file.name] && (
                        <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
                      )}
                      {file.missing && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">
                          missing
                        </Badge>
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
              <CardHeader className="p-3 flex-row items-center justify-between space-y-0 border-b border-border">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">
                    {activeFile ?? "No file selected"}
                  </Badge>
                  {isDirty && (
                    <Badge className="text-[10px] bg-warning/10 text-warning border-warning/20">
                      Modified
                    </Badge>
                  )}
                </div>
                {activeFile && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
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
                      onClick={() => activeFile && void handleSave(activeFile)}
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
                    className="h-full min-h-[450px] rounded-none border-0 font-mono text-sm resize-none focus-visible:ring-0"
                    placeholder={`Edit ${activeFile}...`}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-muted-foreground">
                    <FileText className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">Select a file to edit</p>
                    <p className="text-xs mt-1">Or create a new file to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─── Tab: Sessions ──────────────────────────── */}
      {tab === "sessions" && (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-accent p-4 mb-4">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No sessions yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Sessions are created when you chat with this agent. Start a conversation to see activity here.
                </p>
                <Button className="mt-4" asChild>
                  <Link href={`/chat?agent=${agentId}`}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Start Chatting
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {sessions.length} session{sessions.length !== 1 ? "s" : ""} • {totalMessages} total messages
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/chat?agent=${agentId}`}>
                    <Plus className="h-3 w-3 mr-1" />
                    New Session
                  </Link>
                </Button>
              </div>

              {/* Session List */}
              <div className="space-y-2">
                {sessions
                  .sort((a, b) => (b.lastActiveAtMs ?? 0) - (a.lastActiveAtMs ?? 0))
                  .map((session) => (
                    <Card key={session.key} className="hover:bg-accent/50 transition-colors">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {session.derivedTitle || session.label || session.key}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            {session.channel && (
                              <Badge variant="outline" className="text-[10px]">
                                {session.channel}
                              </Badge>
                            )}
                            <span>{session.messageCount ?? 0} messages</span>
                            <span>{relativeTime(session.lastActiveAtMs)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8" asChild>
                            <Link href={`/chat?session=${session.key}`}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Tab: Configuration ─────────────────────── */}
      {tab === "config" && (
        <div className="space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Agent Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Agent ID</p>
                  <p className="font-mono text-xs bg-muted px-2 py-1.5 rounded">{agentId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Name</p>
                  <p className="font-medium">{name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Emoji</p>
                  <p className="text-2xl">{emoji}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Workspace</p>
                  <p className="font-mono text-xs bg-muted px-2 py-1.5 rounded">
                    {files?.workspace ?? "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Workspace Files</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {files?.files.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-mono">{file.name}</span>
                      {file.missing && (
                        <Badge variant="outline" className="text-[10px]">missing</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {file.size !== undefined && <span>{formatBytes(file.size)}</span>}
                      {file.updatedAtMs && (
                        <span>{relativeTime(file.updatedAtMs)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Delete Agent</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently remove this agent and all its files.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Delete Agent
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
