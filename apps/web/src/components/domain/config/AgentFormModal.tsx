"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelProviderSelector } from "@/components/domain/config";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useModels } from "@/hooks/queries/useModels";
import type { ModelEntry } from "@/lib/api";
import type { Agent, AgentStatus } from "@/stores/useAgentStore";
import type { Workspace } from "@/stores/useWorkspaceStore";

// Stable empty array for fallback (avoids new reference each render)
const EMPTY_MODELS: ModelEntry[] = [];

// Avatar color options
const AVATAR_COLORS = [
  "from-blue-500 to-purple-500",
  "from-green-500 to-teal-500",
  "from-orange-500 to-red-500",
  "from-pink-500 to-rose-500",
  "from-indigo-500 to-blue-500",
  "from-amber-500 to-orange-500",
  "from-cyan-500 to-blue-500",
  "from-violet-500 to-purple-500",
];

// Name suggestions for new agents
const NAME_SUGGESTIONS = [
  "Research Assistant",
  "Code Helper",
  "Writing Coach",
  "Task Manager",
  "Creative Partner",
  "Data Analyst",
];

interface FormState {
  step: number;
  name: string;
  avatarColor: string;
  avatarUrl?: string;
  modelId: string;
  providerId?: string;
  runtime: "pi" | "claude";
  claudeSdkProvider?: "anthropic" | "zai" | "openrouter";
  workspaceIds: string[];
  showWorkspaces: boolean;
}

export interface AgentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: Agent | null;
  workspaces?: Workspace[];
  onSubmit: (data: {
    name: string;
    role: string;
    avatar?: string;
    status: AgentStatus;
    description?: string;
    model?: string;
    runtime?: "pi" | "claude";
    claudeSdkOptions?: {
      provider?: "anthropic" | "zai" | "openrouter";
    };
  }) => void;
  isSubmitting?: boolean;
}

export function AgentFormModal({
  open,
  onOpenChange,
  agent,
  workspaces = [],
  onSubmit,
  isSubmitting = false,
}: AgentFormModalProps) {
  const isEditing = !!agent;
  const { data: modelsData, isLoading: modelsLoading } = useModels();
  const models = modelsData?.models ?? EMPTY_MODELS;
  const modelIndex = React.useMemo(
    () => new Map(models.map((model) => [model.id, model])),
    [models]
  );
  const modelRefIndex = React.useMemo(
    () => new Map(models.map((model) => [`${model.provider}/${model.id}`, model])),
    [models]
  );
  const resolveModelEntry = React.useCallback(
    (providerId?: string, modelId?: string) => {
      if (!modelId) {return undefined;}
      if (providerId) {
        return (
          modelRefIndex.get(`${providerId}/${modelId}`) ??
          models.find((model) => model.provider === providerId && model.id === modelId)
        );
      }
      return modelIndex.get(modelId) ?? models.find((model) => model.id === modelId);
    },
    [modelIndex, modelRefIndex, models]
  );

  const [state, setState] = React.useState<FormState>({
    step: 1,
    name: "",
    avatarColor: AVATAR_COLORS[0],
    avatarUrl: undefined,
    modelId: "",
    providerId: undefined,
    runtime: "pi",
    claudeSdkProvider: undefined,
    workspaceIds: [],
    showWorkspaces: false,
  });

  const splitModelRef = React.useCallback((value?: string) => {
    if (!value) {return { providerId: undefined, modelId: "" };}
    const trimmed = value.trim();
    if (!trimmed) {return { providerId: undefined, modelId: "" };}
    const parts = trimmed.split("/");
    if (parts.length <= 1) {return { providerId: undefined, modelId: trimmed };}
    return { providerId: parts[0], modelId: parts.slice(1).join("/") };
  }, []);

  const buildModelRef = React.useCallback((provider?: string, modelId?: string) => {
    if (!modelId) {return undefined;}
    if (!provider) {return modelId;}
    return `${provider}/${modelId}`;
  }, []);

  // Reset state when dialog opens/closes or agent changes
  React.useEffect(() => {
    if (open) {
      if (agent) {
        // Editing: populate with agent data
        setState({
          step: 1,
          name: agent.name,
          avatarColor: AVATAR_COLORS[0],
          avatarUrl: agent.avatar,
          ...splitModelRef(agent.model),
          runtime: agent.runtime ?? "pi",
          claudeSdkProvider:
            agent.runtime === "claude"
              ? agent.claudeSdkOptions?.provider ?? "anthropic"
              : agent.claudeSdkOptions?.provider,
          workspaceIds: [],
          showWorkspaces: false,
        });
      } else {
        // Creating: generate sensible defaults
        const randomName =
          NAME_SUGGESTIONS[Math.floor(Math.random() * NAME_SUGGESTIONS.length)];
        const randomColor =
          AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
        setState({
          step: 1,
          name: randomName,
          avatarColor: randomColor,
          avatarUrl: undefined,
          modelId: "",
          providerId: undefined,
          runtime: "pi",
          claudeSdkProvider: undefined,
          workspaceIds: [],
          showWorkspaces: false,
        });
      }
    }
  }, [open, agent, splitModelRef]);

  React.useEffect(() => {
    if (!open || state.modelId.length > 0 || models.length === 0) {return;}
    const recommended = models.find((model) => model.recommended) ?? models[0];
    if (!recommended) {return;}
    setState((prev) => ({
      ...prev,
      modelId: recommended.id,
      providerId: recommended.provider ?? prev.providerId,
    }));
  }, [open, models, state.modelId.length]);

  const handleNext = () => {
    setState((prev) => ({ ...prev, step: prev.step + 1 }));
  };

  const handleBack = () => {
    setState((prev) => ({ ...prev, step: prev.step - 1 }));
  };

  const selectedModel = React.useMemo(
    () => resolveModelEntry(state.providerId, state.modelId),
    [resolveModelEntry, state.modelId, state.providerId]
  );

  const handleSubmit = () => {
    const modelRef = buildModelRef(state.providerId, state.modelId);
    const claudeSdkOptions =
      state.runtime === "claude" && state.claudeSdkProvider
        ? { provider: state.claudeSdkProvider }
        : undefined;
    onSubmit({
      name: state.name,
      role: selectedModel?.name ?? "Assistant",
      avatar: state.avatarUrl,
      status: agent?.status ?? "online",
      description: `Powered by ${selectedModel?.name ?? "AI"}`,
      model: modelRef,
      runtime: state.runtime,
      claudeSdkOptions,
    });
  };

  const canProceed = () => {
    switch (state.step) {
      case 1:
        return state.name.trim().length > 0;
      case 2:
        return state.modelId.length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const initials = state.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Agent" : "Create New Agent"}
          </DialogTitle>
          <DialogDescription>
            {state.step === 1 && "Give your agent a name and avatar"}
            {state.step === 2 && "Choose which AI model powers your agent"}
            {state.step === 3 && "Assign to workspaces (optional)"}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                step === state.step
                  ? "w-8 bg-primary"
                  : step < state.step
                    ? "w-2 bg-primary/60"
                    : "w-2 bg-muted"
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={state.step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="min-h-[240px]"
          >
            {/* Step 1: Name + Avatar */}
            {state.step === 1 && (
              <div className="space-y-6">
                {/* Avatar Preview */}
                <div className="flex flex-col items-center gap-4">
                  <Avatar className="h-20 w-20">
                    {state.avatarUrl ? (
                      <AvatarImage src={state.avatarUrl} alt={state.name} />
                    ) : null}
                    <AvatarFallback
                      className={cn(
                        "bg-gradient-to-br text-white text-2xl font-bold",
                        state.avatarColor
                      )}
                    >
                      {initials || <User className="h-8 w-8" />}
                    </AvatarFallback>
                  </Avatar>

                  {/* Color picker */}
                  <div className="flex items-center gap-2">
                    {AVATAR_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() =>
                          setState((prev) => ({ ...prev, avatarColor: color }))
                        }
                        className={cn(
                          "h-6 w-6 rounded-full bg-gradient-to-br transition-all",
                          color,
                          state.avatarColor === color
                            ? "ring-2 ring-primary ring-offset-2"
                            : "opacity-60 hover:opacity-100"
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Name Input */}
                <div className="space-y-2">
                  <Label htmlFor="agent-name">Agent Name</Label>
                  <Input
                    id="agent-name"
                    value={state.name}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Enter a name for your agent..."
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Choose a memorable name that reflects the agent&apos;s purpose
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Model Selection */}
            {state.step === 2 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Agent runtime</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      {
                        value: "pi" as const,
                        label: "Pi (recommended)",
                        helper: "Keeps conversation memory.",
                      },
                      {
                        value: "claude" as const,
                        label: "Claude Code SDK (advanced)",
                        helper: "Stateless but fast.",
                      },
                    ].map((option) => {
                      const selected = state.runtime === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setState((prev) => ({
                              ...prev,
                              runtime: option.value,
                              claudeSdkProvider:
                                option.value === "claude"
                                  ? prev.claudeSdkProvider ?? "anthropic"
                                  : prev.claudeSdkProvider,
                            }))
                          }
                          className={cn(
                            "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="space-y-1">
                              <p className="font-medium">{option.label}</p>
                              <p className="text-xs text-muted-foreground">{option.helper}</p>
                            </div>
                            {selected && (
                              <Badge variant="success" className="text-xs">
                                Selected
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {state.runtime === "claude" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">CCSDK provider</Label>
                    <Select
                      value={state.claudeSdkProvider ?? ""}
                      onValueChange={(value) =>
                        setState((prev) => ({
                          ...prev,
                          claudeSdkProvider: value as FormState["claudeSdkProvider"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="zai">Z.AI</SelectItem>
                        <SelectItem value="openrouter">OpenRouter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {modelsLoading ? (
                  <div className="space-y-3">
                    {[0, 1].map((item) => (
                      <Skeleton key={item} className="h-24 w-full rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <ModelProviderSelector
                    label="Model / Provider"
                    helper="Pick the model that should power this agent by default."
                    models={models}
                    providerId={state.providerId}
                    modelIds={state.modelId ? [state.modelId] : []}
                    onChange={(next) =>
                      setState((prev) => ({
                        ...prev,
                        providerId: next.providerId,
                        modelId: next.modelIds[0] ?? "",
                      }))
                    }
                  />
                )}
              </div>
            )}

            {/* Step 3: Workspace Assignment (collapsed by default) */}
            {state.step === 3 && (
              <div className="space-y-4">
                {/* Summary */}
                <Card className="bg-muted/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback
                          className={cn(
                            "bg-gradient-to-br text-white font-bold",
                            state.avatarColor
                          )}
                        >
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-medium">{state.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {state.modelId
                            ? selectedModel?.name ?? state.modelId
                            : "Model not selected"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Workspace assignment (collapsible) */}
                {workspaces.length > 0 && (
                  <div className="border rounded-lg">
                    <button
                      type="button"
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          showWorkspaces: !prev.showWorkspaces,
                        }))
                      }
                      className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                    >
                      <span>Assign to Workspaces</span>
                      <div className="flex items-center gap-2">
                        {state.workspaceIds.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {state.workspaceIds.length} selected
                          </Badge>
                        )}
                        {state.showWorkspaces ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </button>

                    <AnimatePresence>
                      {state.showWorkspaces && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3 pt-0 space-y-2">
                            {workspaces.map((workspace) => {
                              const isSelected = state.workspaceIds.includes(
                                workspace.id
                              );
                              return (
                                <button
                                  key={workspace.id}
                                  type="button"
                                  onClick={() =>
                                    setState((prev) => ({
                                      ...prev,
                                      workspaceIds: isSelected
                                        ? prev.workspaceIds.filter(
                                            (id) => id !== workspace.id
                                          )
                                        : [...prev.workspaceIds, workspace.id],
                                    }))
                                  }
                                  className={cn(
                                    "flex items-center justify-between w-full p-2 rounded-md text-sm transition-colors",
                                    isSelected
                                      ? "bg-primary/10 text-primary"
                                      : "hover:bg-muted"
                                  )}
                                >
                                  <span>{workspace.name}</span>
                                  {isSelected && (
                                    <Check className="h-4 w-4" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  You can always change these settings later
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <DialogFooter className="gap-2">
          {state.step > 1 && (
            <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          )}
          {state.step < 3 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canProceed() || isSubmitting}>
              {isSubmitting
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create Agent"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AgentFormModal;
