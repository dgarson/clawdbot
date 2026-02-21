"use client";

import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  User,
  Brain,
  Wrench,
  Zap,
  FileText,
  Clock,
  MessageCircle,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAgent, useAgentIdentity } from "@/hooks/queries/useAgents";
import { useAgentFiles, useAgentFileSave, AGENT_FILES, getFileLabel, getFileDescription } from "@/hooks/queries/useAgentFiles";
import { useUIStore } from "@/stores/useUIStore";
import { SoulEditor } from "./SoulEditor";
import { AgentFileEditor } from "./AgentFileEditor";
import { AgentOverviewConfig } from "./AgentOverviewConfig";
import { LLMAssistPanel, type AssistContext } from "@/components/domain/assist/LLMAssistPanel";
import { AutoReviewPanel } from "@/components/domain/assist/AutoReviewPanel";
import { ModelBehaviorConfig, type ModelBehaviorSettings, type OverrideFlags } from "./ModelBehaviorConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConfigTab =
  | "overview"
  | "soul"
  | "instructions"
  | "model"
  | "tools"
  | "skills"
  | "channels"
  | "schedule"
  | "files";

interface TabDefinition {
  id: ConfigTab;
  label: string;
  icon: React.ReactNode;
  description: string;
  /** If true, this tab is available even for non-technical users */
  essential: boolean;
}

const TABS: TabDefinition[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <User className="size-4" />,
    description: "Identity, model, and status",
    essential: true,
  },
  {
    id: "soul",
    label: "Soul",
    icon: <Sparkles className="size-4" />,
    description: "Personality, voice, and identity",
    essential: true,
  },
  {
    id: "instructions",
    label: "Instructions",
    icon: <FileText className="size-4" />,
    description: "Behavior, capabilities, and rules",
    essential: true,
  },
  {
    id: "model",
    label: "Model",
    icon: <Brain className="size-4" />,
    description: "AI model and generation settings",
    essential: false,
  },
  {
    id: "tools",
    label: "Tools",
    icon: <Wrench className="size-4" />,
    description: "Tool access and permissions",
    essential: false,
  },
  {
    id: "skills",
    label: "Skills",
    icon: <Zap className="size-4" />,
    description: "Skills and integrations",
    essential: false,
  },
  {
    id: "channels",
    label: "Channels",
    icon: <MessageCircle className="size-4" />,
    description: "Communication channels",
    essential: false,
  },
  {
    id: "schedule",
    label: "Schedule",
    icon: <Clock className="size-4" />,
    description: "Cron jobs and heartbeat",
    essential: false,
  },
  {
    id: "files",
    label: "Files",
    icon: <FileText className="size-4" />,
    description: "Raw workspace files",
    essential: false,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface AgentConfigPageProps {
  agentId: string;
}

export function AgentConfigPage({ agentId }: AgentConfigPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState<ConfigTab>("overview");
  const [assistOpen, setAssistOpen] = React.useState(false);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const powerUserMode = useUIStore((s) => s.powerUserMode);

  // Data
  const { data: agent, isLoading: agentLoading } = useAgent(agentId);
  const { data: identity, isLoading: identityLoading } = useAgentIdentity(agentId);
  const { files, workspace, isLoading: filesLoading } = useAgentFiles(agentId);
  const { save: saveFile } = useAgentFileSave();

  const isLoading = agentLoading || identityLoading || filesLoading;
  const agentName = identity?.name ?? agent?.name ?? agentId;
  const agentEmoji = identity?.emoji ?? "🤖";

  // Filter tabs based on power user mode
  const visibleTabs = powerUserMode ? TABS : TABS.filter((t) => t.essential);

  // Build assist context
  const assistContext: AssistContext = React.useMemo(
    () => ({
      section: activeTab,
      agentName,
    }),
    [activeTab, agentName],
  );

  // Handle file changes from assist panel
  const handleAssistFileChange = React.useCallback(
    (fileName: string, newContent: string) => {
      void saveFile(agentId, fileName, newContent);
    },
    [agentId, saveFile],
  );

  // Handle review fixes
  const handleReviewFix = React.useCallback(
    (fix: { type: string; fileName?: string; newContent?: string }) => {
      if (fix.type === "file_change" && fix.fileName && fix.newContent) {
        void saveFile(agentId, fix.fileName, fix.newContent);
      }
    },
    [agentId, saveFile],
  );

  return (
    <div className="flex h-full min-h-0">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: "/agents/$agentId", params: { agentId } })}
                className="gap-1.5"
              >
                <ChevronLeft className="size-4" />
                Back
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                  {agentEmoji}
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {isLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-5 animate-spin" />
                        Loading…
                      </span>
                    ) : (
                      <>Configure {agentName}</>
                    )}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {workspace ? (
                      <code className="text-xs">{workspace}</code>
                    ) : (
                      "Agent workspace configuration"
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Auto Review Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={reviewOpen ? "default" : "outline"}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setReviewOpen(!reviewOpen)}
                    >
                      <CheckCircle2 className="size-4" />
                      Auto Review
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Analyze config and get suggestions for improvement</p>
                  </TooltipContent>
                </Tooltip>

                {/* AI Assist Toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={assistOpen ? "default" : "outline"}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setAssistOpen(!assistOpen)}
                    >
                      {assistOpen ? (
                        <PanelRightClose className="size-4" />
                      ) : (
                        <PanelRightOpen className="size-4" />
                      )}
                      AI Assist
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Get AI help configuring this agent</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </motion.div>

          <Separator className="mb-6" />

          {/* Auto Review Panel (inline, toggled) */}
          <AnimatePresence>
            {reviewOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <AutoReviewPanel
                  agentId={agentId}
                  agentName={agentName}
                  files={files}
                  open={reviewOpen}
                  onClose={() => setReviewOpen(false)}
                  onApplyFix={handleReviewFix}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ConfigTab)}>
            <TabsList className="mb-6 flex-wrap h-auto gap-1 bg-transparent p-0">
              {visibleTabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg px-3 py-2"
                >
                  {tab.icon}
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <TabsContent value="overview" className="mt-0">
                  <AgentOverviewConfig
                    agentId={agentId}
                    agent={agent}
                    identity={identity}
                    files={files}
                    isLoading={isLoading}
                  />
                </TabsContent>

                <TabsContent value="soul" className="mt-0">
                  <SoulEditor agentId={agentId} />
                </TabsContent>

                <TabsContent value="instructions" className="mt-0">
                  <AgentFileEditor
                    agentId={agentId}
                    fileName="AGENTS.md"
                    title="Agent Instructions"
                    description="Define how this agent behaves, what it can do, and how it should handle each session."
                    placeholder={`# Agent Instructions\n\nDefine the agent's behavior here...\n\n## Your Role\n\nDescribe what this agent does...\n\n## Working Style\n\nHow the agent should approach tasks...`}
                  />
                </TabsContent>

                <TabsContent value="model" className="mt-0">
                  <ModelBehaviorTab agentId={agentId} />
                </TabsContent>

                <TabsContent value="tools" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wrench className="size-5" />
                        Tools & Permissions
                      </CardTitle>
                      <CardDescription>
                        Control which tools this agent can use and set security policies.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
                        <Wrench className="size-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Tool configuration coming soon.
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Choose tool profiles, toggle individual tools, and set exec permissions.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="skills" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="size-5" />
                        Skills
                      </CardTitle>
                      <CardDescription>
                        Enable skills to give this agent access to external services and capabilities.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
                        <Zap className="size-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Skills configuration coming soon.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="channels" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="size-5" />
                        Channels
                      </CardTitle>
                      <CardDescription>
                        Configure which messaging channels this agent can communicate through.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
                        <MessageCircle className="size-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Channel configuration coming soon.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="schedule" className="mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="size-5" />
                        Schedule & Heartbeat
                      </CardTitle>
                      <CardDescription>
                        Set up recurring tasks, heartbeat check-ins, and availability windows.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
                        <Clock className="size-10 mx-auto text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Schedule configuration coming soon.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="files" className="mt-0">
                  <AgentFilesTab agentId={agentId} files={files} isLoading={filesLoading} />
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </div>
      </div>

      {/* AI Assist Sidebar */}
      <LLMAssistPanel
        agentId={agentId}
        context={assistContext}
        open={assistOpen}
        onClose={() => setAssistOpen(false)}
        onApplyChanges={handleAssistFileChange}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Model & Behavior Tab
// ---------------------------------------------------------------------------

function ModelBehaviorTab({ agentId }: { agentId: string }) {
  const [settings, setSettings] = React.useState<ModelBehaviorSettings>({});
  const [overrides, setOverrides] = React.useState<Partial<OverrideFlags>>({});

  const handleOverrideChange = React.useCallback(
    (field: keyof OverrideFlags, enabled: boolean) => {
      setOverrides((prev) => ({ ...prev, [field]: enabled }));
    },
    [],
  );

  return (
    <ModelBehaviorConfig
      settings={settings}
      onChange={setSettings}
      overrides={overrides}
      onOverrideChange={handleOverrideChange}
    />
  );
}

// ---------------------------------------------------------------------------
// Files Tab
// ---------------------------------------------------------------------------

interface AgentFilesTabProps {
  agentId: string;
  files: Array<{ name: string; path: string; missing: boolean; size?: number; updatedAtMs?: number }>;
  isLoading: boolean;
}

function AgentFilesTab({ agentId, files, isLoading }: AgentFilesTabProps) {
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="size-6 mx-auto animate-spin text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Loading workspace files…</p>
        </CardContent>
      </Card>
    );
  }

  if (selectedFile) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedFile(null)}
          className="gap-1.5"
        >
          <ChevronLeft className="size-4" />
          Back to file list
        </Button>
        <AgentFileEditor
          agentId={agentId}
          fileName={selectedFile}
          title={getFileLabel(selectedFile)}
          description={getFileDescription(selectedFile)}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-5" />
          Workspace Files
        </CardTitle>
        <CardDescription>
          All configuration files in this agent's workspace. Click to edit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {files.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
              <FileText className="size-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No files found in workspace.</p>
            </div>
          ) : (
            files.map((file) => (
              <button
                key={file.name}
                onClick={() => setSelectedFile(file.name)}
                className="w-full flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-primary/30 hover:bg-primary/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <FileText className="size-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {getFileDescription(file.name) || file.path}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {file.missing ? (
                    <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                      Not created
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {file.size != null
                        ? file.size < 1024
                          ? `${file.size} B`
                          : `${(file.size / 1024).toFixed(1)} KB`
                        : ""}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
