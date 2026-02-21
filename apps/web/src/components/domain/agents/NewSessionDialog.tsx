"use client";

import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MessageSquarePlus,
  Sparkles,
  Zap,
  Settings2,
  Brain,
  Gauge,
  FileText,
  Wrench,
  MemoryStick,
  Info,
} from "lucide-react";

// Stubbed feature flag - can be wired to real capability check later
const isThinkingLevelSupported = (): boolean => {
  return true;
};

export interface NewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
  /** Called when a session is started - allows parent to handle navigation if desired */
  onSessionStart?: (sessionKey: string, config: SessionConfig) => void;
}

export type SessionMode = "chat" | "task" | "quick";
export type ThinkingLevel = "off" | "low" | "medium" | "high";

export interface SessionConfig {
  mode: SessionMode;
  thinkingLevel: ThinkingLevel;
  initialPrompt: string;
  // Advanced options
  sessionName?: string;
  systemPromptOverride?: string;
  temperature: number;
  maxTokens: number;
  enableMemory: boolean;
  enableTools: boolean;
  streamResponses: boolean;
}

const sessionModes: { value: SessionMode; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "chat",
    label: "Chat Session",
    description: "Open-ended conversation with the agent",
    icon: <MessageSquarePlus className="h-5 w-5" />,
  },
  {
    value: "task",
    label: "Task Session",
    description: "Focused session to complete a specific task",
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    value: "quick",
    label: "Quick Action",
    description: "Single prompt with immediate response",
    icon: <Zap className="h-5 w-5" />,
  },
];

const thinkingLevels: { value: ThinkingLevel; label: string; description: string }[] = [
  { value: "off", label: "Off", description: "No extended thinking" },
  { value: "low", label: "Low", description: "Brief consideration" },
  { value: "medium", label: "Medium", description: "Balanced analysis" },
  { value: "high", label: "High", description: "Deep reasoning" },
];

const defaultConfig: SessionConfig = {
  mode: "chat",
  thinkingLevel: "medium",
  initialPrompt: "",
  sessionName: "",
  systemPromptOverride: "",
  temperature: 0.7,
  maxTokens: 4096,
  enableMemory: true,
  enableTools: true,
  streamResponses: true,
};

export function NewSessionDialog({
  open,
  onOpenChange,
  agentId,
  agentName,
  onSessionStart,
}: NewSessionDialogProps) {
  const navigate = useNavigate();
  const [config, setConfig] = React.useState<SessionConfig>(defaultConfig);
  const [isStarting, setIsStarting] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const thinkingSupported = isThinkingLevelSupported();

  const updateConfig = <K extends keyof SessionConfig>(key: K, value: SessionConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleStartSession = async () => {
    setIsStarting(true);

    // Generate session key
    const sessionKey = `session-${Date.now()}`;

    // If parent wants to handle navigation, call the callback
    if (onSessionStart) {
      onSessionStart(sessionKey, config);
    } else {
      // Default navigation behavior - go to the new session
      navigate({
        to: "/agents/$agentId/session/$sessionKey",
        params: { agentId, sessionKey },
        search: {
          newSession: true,
          ...(config.initialPrompt ? { initialMessage: config.initialPrompt } : {}),
        },
      });
    }

    setIsStarting(false);
    onOpenChange(false);
    setShowAdvanced(false);

    // Reset form
    setConfig(defaultConfig);
  };

  const handleClose = () => {
    onOpenChange(false);
    setShowAdvanced(false);
    // Reset form on close
    setConfig(defaultConfig);
  };

  const selectedMode = sessionModes.find((m) => m.value === config.mode);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5 text-primary" />
              New Session with {agentName}
            </DialogTitle>
            <DialogDescription>
              Start a new conversation or task session with this agent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Session Type & Thinking Level Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Session Type */}
              <div className="space-y-2">
                <Label htmlFor="session-mode">Session Type</Label>
                <Select
                  value={config.mode}
                  onValueChange={(v) => updateConfig("mode", v as SessionMode)}
                >
                  <SelectTrigger id="session-mode" className="h-auto min-h-[60px]">
                    <SelectValue placeholder="Select session type">
                      {selectedMode && (
                        <div className="flex items-center gap-3 py-1">
                          <div className="text-primary">{selectedMode.icon}</div>
                          <div className="text-left">
                            <div className="font-medium">{selectedMode.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {selectedMode.description}
                            </div>
                          </div>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {sessionModes.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value} className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="text-primary">{mode.icon}</div>
                          <div>
                            <div className="font-medium">{mode.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {mode.description}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Thinking Level */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="thinking-level">Thinking Level</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px]">
                        <p className="text-xs">
                          Controls how much the agent "thinks" before responding.
                          Higher levels produce more thoughtful but slower responses.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select
                  value={config.thinkingLevel}
                  onValueChange={(v) => updateConfig("thinkingLevel", v as ThinkingLevel)}
                  disabled={!thinkingSupported}
                >
                  <SelectTrigger
                    id="thinking-level"
                    className={cn("h-auto min-h-[60px]", !thinkingSupported && "opacity-50")}
                  >
                    <SelectValue placeholder="Select thinking level">
                      <div className="flex items-center gap-3 py-1">
                        <Brain className="h-5 w-5 text-primary" />
                        <div className="text-left">
                          <div className="font-medium">
                            {thinkingLevels.find((l) => l.value === config.thinkingLevel)?.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {thinkingLevels.find((l) => l.value === config.thinkingLevel)?.description}
                          </div>
                        </div>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {thinkingLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value} className="py-3">
                        <div className="flex items-center gap-3">
                          <Brain className="h-5 w-5 text-primary" />
                          <div>
                            <div className="font-medium">{level.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {level.description}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!thinkingSupported && (
                  <p className="text-xs text-muted-foreground">
                    Thinking levels not supported for this agent.
                  </p>
                )}
              </div>
            </div>

            {/* Initial Prompt */}
            <div className="space-y-2">
              <Label htmlFor="initial-prompt">
                {config.mode === "quick" ? "Your prompt" : "Initial message (optional)"}
              </Label>
              <Textarea
                id="initial-prompt"
                placeholder={
                  config.mode === "quick"
                    ? "Enter your prompt..."
                    : "Start with a specific request or leave blank to begin open-ended..."
                }
                value={config.initialPrompt}
                onChange={(e) => updateConfig("initialPrompt", e.target.value)}
                className="min-h-[100px] resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-3 sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(true)}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="h-4 w-4" />
              Advanced Options
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleStartSession}
                disabled={isStarting || (config.mode === "quick" && !config.initialPrompt.trim())}
                className="gap-2"
              >
                {isStarting ? (
                  <>Starting...</>
                ) : (
                  <>
                    {selectedMode?.icon}
                    Start Session
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advanced Options Slideout */}
      <Sheet open={showAdvanced} onOpenChange={setShowAdvanced}>
        <SheetContent side="right" className="w-[400px] sm:w-[450px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Advanced Session Options
            </SheetTitle>
            <SheetDescription>
              Fine-tune your session configuration for power users.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-6">
            {/* Session Name */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="session-name">Session Name</Label>
              </div>
              <Input
                id="session-name"
                placeholder="Optional name for this session..."
                value={config.sessionName}
                onChange={(e) => updateConfig("sessionName", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Give this session a memorable name for easy reference.
              </p>
            </div>

            {/* Temperature */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-muted-foreground" />
                  <Label>Temperature</Label>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {config.temperature.toFixed(1)}
                </span>
              </div>
              <Slider
                value={[config.temperature]}
                onValueChange={([v]) => updateConfig("temperature", v)}
                min={0}
                max={2}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Lower values produce more focused responses. Higher values increase creativity.
              </p>
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="max-tokens">Max Tokens</Label>
              </div>
              <Select
                value={config.maxTokens.toString()}
                onValueChange={(v) => updateConfig("maxTokens", parseInt(v, 10))}
              >
                <SelectTrigger id="max-tokens">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1024">1,024 tokens</SelectItem>
                  <SelectItem value="2048">2,048 tokens</SelectItem>
                  <SelectItem value="4096">4,096 tokens</SelectItem>
                  <SelectItem value="8192">8,192 tokens</SelectItem>
                  <SelectItem value="16384">16,384 tokens</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Maximum length of the agent's responses.
              </p>
            </div>

            {/* System Prompt Override */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="system-prompt">System Prompt Override</Label>
              </div>
              <Textarea
                id="system-prompt"
                placeholder="Override the agent's default system prompt for this session..."
                value={config.systemPromptOverride}
                onChange={(e) => updateConfig("systemPromptOverride", e.target.value)}
                className="min-h-[80px] resize-none font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use the agent's default personality and instructions.
              </p>
            </div>

            {/* Toggles */}
            <div className="space-y-4 rounded-lg border border-border/50 p-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Capabilities
              </h4>

              {/* Enable Memory */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="enable-memory" className="cursor-pointer">
                      Enable Memory
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Allow agent to access and store memories
                    </p>
                  </div>
                </div>
                <Switch
                  id="enable-memory"
                  checked={config.enableMemory}
                  onCheckedChange={(v) => updateConfig("enableMemory", v)}
                />
              </div>

              {/* Enable Tools */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="enable-tools" className="cursor-pointer">
                      Enable Tools
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Allow agent to use configured tools
                    </p>
                  </div>
                </div>
                <Switch
                  id="enable-tools"
                  checked={config.enableTools}
                  onCheckedChange={(v) => updateConfig("enableTools", v)}
                />
              </div>

              {/* Stream Responses */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="stream-responses" className="cursor-pointer">
                      Stream Responses
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Show responses as they're generated
                    </p>
                  </div>
                </div>
                <Switch
                  id="stream-responses"
                  checked={config.streamResponses}
                  onCheckedChange={(v) => updateConfig("streamResponses", v)}
                />
              </div>
            </div>
          </div>

          {/* Slideout Footer */}
          <div className="border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setShowAdvanced(false)}
              className="w-full"
            >
              Done
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default NewSessionDialog;
