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
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Pencil,
  Calendar,
  Code,
  Palette,
  FileText,
  FileCode2,
  Globe,
  Mail,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  User,
  Upload,
} from "lucide-react";
import { useCreateAgent } from "@/hooks/mutations/useAgentMutations";

// Template definitions
const TEMPLATES = [
  {
    id: "researcher",
    name: "Researcher",
    description: "Explore topics, synthesize information, and provide insights",
    icon: Search,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    defaultTags: ["research", "analysis"],
  },
  {
    id: "writer",
    name: "Writer",
    description: "Draft content, edit documents, and craft compelling narratives",
    icon: Pencil,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    defaultTags: ["writing", "editing"],
  },
  {
    id: "scheduler",
    name: "Scheduler",
    description: "Manage calendars, set reminders, and coordinate meetings",
    icon: Calendar,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    defaultTags: ["scheduling", "planning"],
  },
  {
    id: "developer",
    name: "Developer",
    description: "Write code, debug issues, and assist with technical tasks",
    icon: Code,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    defaultTags: ["code", "debug"],
  },
  {
    id: "creative",
    name: "Creative",
    description: "Generate ideas, brainstorm solutions, and spark creativity",
    icon: Palette,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    defaultTags: ["creative", "ideas"],
  },
  {
    id: "blank",
    name: "Blank",
    description: "Start from scratch with a fully customizable agent",
    icon: FileText,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    defaultTags: [],
  },
] as const;

// Tool definitions
const TOOLS = [
  { id: "web-search", name: "Web Search", icon: Globe, description: "Search the internet for information" },
  { id: "read-docs", name: "Read Docs", icon: FileText, description: "Read and analyze documents" },
  { id: "write-files", name: "Write Files", icon: FileCode2, description: "Create and edit files" },
  { id: "code-exec", name: "Code Exec", icon: Code, description: "Execute code snippets" },
  { id: "calendar", name: "Calendar", icon: Calendar, description: "Access calendar events" },
  { id: "email", name: "Email", icon: Mail, description: "Send and read emails" },
] as const;

// Core values options
const CORE_VALUES = [
  "Accuracy",
  "Creativity",
  "Efficiency",
  "Empathy",
  "Humor",
  "Thoroughness",
  "Brevity",
  "Curiosity",
  "Patience",
  "Proactivity",
] as const;

interface WizardState {
  step: number;
  template: (typeof TEMPLATES)[number] | null;
  name: string;
  description: string;
  avatarLetter: string;
  personality: {
    formality: number; // 0 = Formal, 100 = Casual
    verbosity: number; // 0 = Concise, 100 = Detailed
    tone: number; // 0 = Serious, 100 = Playful
  };
  coreValues: string[];
  enabledTools: string[];
}

interface CreateAgentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAgentWizard({ open, onOpenChange }: CreateAgentWizardProps) {
  const createAgent = useCreateAgent();

  const [state, setState] = React.useState<WizardState>({
    step: 1,
    template: null,
    name: "",
    description: "",
    avatarLetter: "",
    personality: {
      formality: 50,
      verbosity: 50,
      tone: 50,
    },
    coreValues: [],
    enabledTools: ["web-search", "read-docs"],
  });

  const resetState = React.useCallback(() => {
    setState({
      step: 1,
      template: null,
      name: "",
      description: "",
      avatarLetter: "",
      personality: {
        formality: 50,
        verbosity: 50,
        tone: 50,
      },
      coreValues: [],
      enabledTools: ["web-search", "read-docs"],
    });
  }, []);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        resetState();
      }
      onOpenChange(open);
    },
    [onOpenChange, resetState]
  );

  const handleTemplateSelect = (template: (typeof TEMPLATES)[number]) => {
    setState((prev) => ({
      ...prev,
      template,
      name: template.id !== "blank" ? `${template.name} Agent` : "",
      avatarLetter: template.id !== "blank" ? template.name.charAt(0) : "",
    }));
  };

  const handleNext = () => {
    setState((prev) => ({ ...prev, step: prev.step + 1 }));
  };

  const handleBack = () => {
    setState((prev) => ({ ...prev, step: prev.step - 1 }));
  };

  const handleCreate = async () => {
    const roleFromTemplate = state.template?.name || "Assistant";

    createAgent.mutate(
      {
        name: state.name,
        role: roleFromTemplate,
        description: state.description,
        status: "online",
        tags: state.template?.defaultTags ? [...state.template.defaultTags] : [],
        taskCount: 0,
      },
      {
        onSuccess: () => {
          handleOpenChange(false);
        },
      }
    );
  };

  const toggleCoreValue = (value: string) => {
    setState((prev) => ({
      ...prev,
      coreValues: prev.coreValues.includes(value)
        ? prev.coreValues.filter((v) => v !== value)
        : [...prev.coreValues, value],
    }));
  };

  const toggleTool = (toolId: string) => {
    setState((prev) => ({
      ...prev,
      enabledTools: prev.enabledTools.includes(toolId)
        ? prev.enabledTools.filter((t) => t !== toolId)
        : [...prev.enabledTools, toolId],
    }));
  };

  const canProceed = () => {
    switch (state.step) {
      case 1:
        return state.template !== null;
      case 2:
        return state.name.trim().length > 0;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Agent</DialogTitle>
          <DialogDescription>
            {state.step === 1 && "Choose a template to get started"}
            {state.step === 2 && "Set up your agent's identity"}
            {state.step === 3 && "Configure personality traits"}
            {state.step === 4 && "Select tools and review"}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3, 4].map((step) => (
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
            className="min-h-[300px]"
          >
            {/* Step 1: Template Selection */}
            {state.step === 1 && (
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  const isSelected = state.template?.id === template.id;
                  return (
                    <Card
                      key={template.id}
                      className={cn(
                        "cursor-pointer transition-all duration-200 hover:border-primary/50",
                        isSelected && "border-primary ring-2 ring-primary/20"
                      )}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                              template.bgColor
                            )}
                          >
                            <Icon className={cn("h-5 w-5", template.color)} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-foreground">
                                {template.name}
                              </h4>
                              {isSelected && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {template.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Step 2: Basic Info */}
            {state.step === 2 && (
              <div className="space-y-6">
                {/* Avatar Preview */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group">
                    <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center ring-4 ring-border/50">
                      {state.avatarLetter ? (
                        <span className="text-4xl font-bold text-foreground">
                          {state.avatarLetter}
                        </span>
                      ) : (
                        <User className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                    <button
                      type="button"
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Upload className="h-6 w-6 text-white" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click to upload custom avatar
                  </p>
                </div>

                {/* Name Input */}
                <div className="space-y-2">
                  <Label htmlFor="agent-name">Name</Label>
                  <input
                    id="agent-name"
                    type="text"
                    value={state.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      setState((prev) => ({
                        ...prev,
                        name: value,
                        avatarLetter: value.charAt(0).toUpperCase(),
                      }));
                    }}
                    placeholder="Enter agent name..."
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="agent-description">Description</Label>
                  <Textarea
                    id="agent-description"
                    value={state.description}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="What will this agent help you with?"
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Personality */}
            {state.step === 3 && (
              <div className="space-y-8">
                {/* Personality Sliders */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Formal</span>
                      <span className="text-muted-foreground">Casual</span>
                    </div>
                    <Slider
                      value={[state.personality.formality]}
                      onValueChange={([value]) =>
                        setState((prev) => ({
                          ...prev,
                          personality: { ...prev.personality, formality: value },
                        }))
                      }
                      max={100}
                      step={1}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Concise</span>
                      <span className="text-muted-foreground">Detailed</span>
                    </div>
                    <Slider
                      value={[state.personality.verbosity]}
                      onValueChange={([value]) =>
                        setState((prev) => ({
                          ...prev,
                          personality: { ...prev.personality, verbosity: value },
                        }))
                      }
                      max={100}
                      step={1}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Serious</span>
                      <span className="text-muted-foreground">Playful</span>
                    </div>
                    <Slider
                      value={[state.personality.tone]}
                      onValueChange={([value]) =>
                        setState((prev) => ({
                          ...prev,
                          personality: { ...prev.personality, tone: value },
                        }))
                      }
                      max={100}
                      step={1}
                    />
                  </div>
                </div>

                {/* Core Values */}
                <div className="space-y-3">
                  <Label>Core Values</Label>
                  <div className="flex flex-wrap gap-2">
                    {CORE_VALUES.map((value) => (
                      <Badge
                        key={value}
                        variant={
                          state.coreValues.includes(value) ? "default" : "outline"
                        }
                        className="cursor-pointer transition-colors"
                        onClick={() => toggleCoreValue(value)}
                      >
                        {value}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Tools & Review */}
            {state.step === 4 && (
              <div className="space-y-6">
                {/* Tool Toggles */}
                <div className="space-y-3">
                  <Label>Available Tools</Label>
                  <div className="grid gap-3">
                    {TOOLS.map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <div
                          key={tool.id}
                          className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{tool.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {tool.description}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={state.enabledTools.includes(tool.id)}
                            onCheckedChange={() => toggleTool(tool.id)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Summary */}
                <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Summary</h4>
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-medium">{state.name || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Template:</span>
                      <span className="font-medium">
                        {state.template?.name || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tools:</span>
                      <span className="font-medium">
                        {state.enabledTools.length} enabled
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Values:</span>
                      <span className="font-medium">
                        {state.coreValues.length > 0
                          ? state.coreValues.slice(0, 3).join(", ")
                          : "None selected"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <DialogFooter className="gap-2">
          {state.step > 1 && (
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          )}
          {state.step < 4 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={!canProceed() || createAgent.isPending}
            >
              {createAgent.isPending ? "Creating..." : "Create Agent"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateAgentWizard;
