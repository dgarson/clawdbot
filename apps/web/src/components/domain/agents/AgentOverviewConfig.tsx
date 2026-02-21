
import * as React from "react";
import { motion } from "framer-motion";
import {
  User,
  Brain,
  FileText,
  Sparkles,
  Hash,
  Palette,
  Tag,
  Globe,
  Shield,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Agent } from "@/stores/useAgentStore";
import type { AgentIdentityResult } from "@/lib/api/gateway-hooks";
import type { AgentFileEntry } from "@/hooks/queries/useAgentFiles";
import { AGENT_FILES, getFileLabel } from "@/hooks/queries/useAgentFiles";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentOverviewConfigProps {
  agentId: string;
  agent: Agent | null | undefined;
  identity: AgentIdentityResult | null | undefined;
  files: AgentFileEntry[];
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AgentOverviewConfig({
  agentId,
  agent,
  identity,
  files,
  isLoading,
}: AgentOverviewConfigProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading agent configuration…</span>
      </div>
    );
  }

  const agentName = identity?.name ?? agent?.name ?? agentId;
  const agentEmoji = identity?.emoji ?? "🤖";
  const agentAvatar = identity?.avatar ?? agent?.avatar;
  const agentModel = agent?.model;
  const agentRuntime = agent?.runtime ?? "pi";

  const existingFiles = files.filter((f) => !f.missing);
  const missingFiles = files.filter((f) => f.missing);

  return (
    <div className="space-y-6">
      {/* Identity Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-5" />
            Identity
          </CardTitle>
          <CardDescription>
            Core identity properties for this agent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              <InfoRow
                icon={<Hash className="size-4" />}
                label="Agent ID"
                value={<code className="text-xs bg-muted px-1.5 py-0.5 rounded">{agentId}</code>}
              />
              <InfoRow
                icon={<User className="size-4" />}
                label="Name"
                value={agentName}
              />
              <InfoRow
                icon={<Sparkles className="size-4" />}
                label="Emoji"
                value={agentEmoji}
              />
              {agent?.role && (
                <InfoRow
                  icon={<Tag className="size-4" />}
                  label="Role"
                  value={agent.role}
                />
              )}
            </div>

            <div className="space-y-4">
              <InfoRow
                icon={<Brain className="size-4" />}
                label="Model"
                value={
                  agentModel ? (
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{agentModel}</code>
                  ) : (
                    <span className="text-muted-foreground italic">System default</span>
                  )
                }
              />
              <InfoRow
                icon={<Shield className="size-4" />}
                label="Runtime"
                value={
                  <Badge variant="outline" className="capitalize">
                    {agentRuntime === "pi" ? "Pi" : "Claude SDK"}
                  </Badge>
                }
              />
              <InfoRow
                icon={<Globe className="size-4" />}
                label="Status"
                value={
                  <Badge
                    variant="outline"
                    className={
                      agent?.status === "online"
                        ? "text-emerald-500 border-emerald-500/30"
                        : agent?.status === "busy"
                          ? "text-amber-500 border-amber-500/30"
                          : "text-muted-foreground"
                    }
                  >
                    {agent?.status ?? "unknown"}
                  </Badge>
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Files Health Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Configuration Files
          </CardTitle>
          <CardDescription>
            Status of workspace configuration files. A well-configured agent typically has
            at least SOUL.md and AGENTS.md.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Existing files */}
            {existingFiles.map((file) => (
              <FileStatus key={file.name} file={file} exists />
            ))}

            {/* Missing files */}
            {missingFiles.length > 0 && (
              <>
                <Separator className="my-3" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Not yet created
                </p>
                {missingFiles.map((file) => (
                  <FileStatus key={file.name} file={file} exists={false} />
                ))}
              </>
            )}

            {files.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No files found. Connect to the gateway to see agent files.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Suggestions Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Sparkles className="size-5" />
            Quick Improvements
          </CardTitle>
          <CardDescription>
            Suggestions to improve this agent's configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {missingFiles.some((f) => f.name === "SOUL.md") && (
              <SuggestionRow
                level="important"
                text="Create a SOUL.md to define this agent's personality and communication style."
              />
            )}
            {missingFiles.some((f) => f.name === "AGENTS.md") && (
              <SuggestionRow
                level="important"
                text="Create an AGENTS.md to set up session behavior, role, and capabilities."
              />
            )}
            {!agentModel && (
              <SuggestionRow
                level="suggestion"
                text="Consider setting a specific model for this agent instead of using the system default."
              />
            )}
            {missingFiles.some((f) => f.name === "TOOLS.md") && (
              <SuggestionRow
                level="info"
                text="Add a TOOLS.md for environment-specific tool notes (SSH hosts, voice preferences, etc.)."
              />
            )}
            {existingFiles.length >= 3 &&
              !missingFiles.some((f) => f.name === "SOUL.md") &&
              !missingFiles.some((f) => f.name === "AGENTS.md") && (
                <SuggestionRow
                  level="good"
                  text="This agent has good coverage of core configuration files!"
                />
              )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex items-center gap-2 flex-1">
        <span className="text-sm text-muted-foreground min-w-[80px]">{label}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}

function FileStatus({ file, exists }: { file: AgentFileEntry; exists: boolean }) {
  const label = getFileLabel(file.name);

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-3">
        <FileText className={`size-4 ${exists ? "text-foreground" : "text-muted-foreground/40"}`} />
        <div>
          <span className={`text-sm ${exists ? "font-medium" : "text-muted-foreground"}`}>
            {file.name}
          </span>
          <span className="text-xs text-muted-foreground ml-2">
            {label !== file.name.replace(/\.[^.]+$/, "") ? label : ""}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {exists ? (
          <>
            {file.size != null && (
              <span className="text-xs text-muted-foreground">
                {file.size < 1024
                  ? `${file.size} B`
                  : `${(file.size / 1024).toFixed(1)} KB`}
              </span>
            )}
            <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-xs">
              ✓
            </Badge>
          </>
        ) : (
          <Badge variant="outline" className="text-muted-foreground border-border text-xs">
            —
          </Badge>
        )}
      </div>
    </div>
  );
}

function SuggestionRow({
  level,
  text,
}: {
  level: "important" | "suggestion" | "info" | "good";
  text: string;
}) {
  const colors = {
    important: "border-amber-500/30 bg-amber-500/5 text-amber-200",
    suggestion: "border-blue-500/30 bg-blue-500/5 text-blue-200",
    info: "border-muted-foreground/20 bg-muted/30 text-muted-foreground",
    good: "border-emerald-500/30 bg-emerald-500/5 text-emerald-200",
  };
  const icons = {
    important: "⚠️",
    suggestion: "💡",
    info: "ℹ️",
    good: "✅",
  };

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${colors[level]}`}>
      <span className="text-base leading-none mt-0.5">{icons[level]}</span>
      <span>{text}</span>
    </div>
  );
}
