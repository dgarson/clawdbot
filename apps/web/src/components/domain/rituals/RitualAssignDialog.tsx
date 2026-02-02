"use client";

import * as React from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useGuidancePackStore } from "@/stores/useGuidancePackStore";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Layers,
  ListTodo,
  Sparkles,
  UserCheck,
} from "lucide-react";

export type AssignableAgent = {
  id: string;
  name: string;
  role?: string;
  status?: string;
  description?: string;
  tags?: string[];
  currentTask?: string;
};

export type RitualAssignPayload = {
  agentId: string;
  goals?: string[];
  workstreams?: string[];
  directivesMarkdown?: string | null;
  guidancePackIds?: string[];
};

interface RitualAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: AssignableAgent[];
  initialAgentId?: string;
  onConfirm: (payload: RitualAssignPayload) => void;
}

const steps = [
  { id: "agent", label: "Select Agent" },
  { id: "links", label: "Goals & Workstreams" },
  { id: "directives", label: "Directives" },
] as const;

type StepId = (typeof steps)[number]["id"];

export function RitualAssignDialog({
  open,
  onOpenChange,
  agents,
  initialAgentId,
  onConfirm,
}: RitualAssignDialogProps) {
  const [step, setStep] = React.useState<StepId>("agent");
  const [search, setSearch] = React.useState("");
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(
    initialAgentId ?? null
  );
  const [goalsOpen, setGoalsOpen] = React.useState(false);
  const [workstreamsOpen, setWorkstreamsOpen] = React.useState(false);
  const [goalsValue, setGoalsValue] = React.useState("");
  const [workstreamsValue, setWorkstreamsValue] = React.useState("");
  const [directivesValue, setDirectivesValue] = React.useState("");
  const [selectedPackIds, setSelectedPackIds] = React.useState<string[]>([]);
  const packs = useGuidancePackStore((state) => state.packs);

  React.useEffect(() => {
    if (open) {
      setStep("agent");
      setSearch("");
      setSelectedAgentId(initialAgentId ?? null);
      setGoalsOpen(false);
      setWorkstreamsOpen(false);
      setGoalsValue("");
      setWorkstreamsValue("");
      setDirectivesValue("");
      setSelectedPackIds([]);
    }
  }, [open, initialAgentId]);

  const filteredAgents = agents.filter((agent) => {
    const query = search.trim().toLowerCase();
    if (!query) {return true;}
    return (
      agent.name.toLowerCase().includes(query) ||
      agent.role?.toLowerCase().includes(query) ||
      agent.description?.toLowerCase().includes(query) ||
      agent.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  const stepIndex = steps.findIndex((item) => item.id === step);

  const goNext = () => {
    if (stepIndex < steps.length - 1) {
      setStep(steps[stepIndex + 1].id);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) {
      setStep(steps[stepIndex - 1].id);
    }
  };

  const handleConfirm = () => {
    if (!selectedAgentId) {return;}
    const goals = goalsValue
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
    const workstreams = workstreamsValue
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
    onConfirm({
      agentId: selectedAgentId,
      goals: goals.length ? goals : undefined,
      workstreams: workstreams.length ? workstreams : undefined,
      directivesMarkdown: directivesValue.trim() ? directivesValue.trim() : null,
      guidancePackIds: selectedPackIds.length ? selectedPackIds : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Assign Ritual
          </DialogTitle>
          <DialogDescription>
            Pick an agent and optionally attach goals, workstreams, or directives.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {steps.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1",
                index === stepIndex
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              <span className="font-medium">{index + 1}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {step === "agent" && (
          <div className="space-y-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search agents by name, role, or tag"
            />
            <div className="grid gap-3 md:grid-cols-2">
              {filteredAgents.map((agent) => {
                const isSelected = selectedAgentId === agent.id;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={cn(
                      "rounded-xl border bg-card/80 p-4 text-left transition-all",
                      isSelected
                        ? "border-primary/60 ring-1 ring-primary/30"
                        : "border-border/60 hover:border-primary/30 hover:bg-secondary/40"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {agent.name}
                          </span>
                          {agent.status ? (
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {agent.status}
                            </Badge>
                          ) : null}
                        </div>
                        {agent.role && (
                          <p className="text-xs text-muted-foreground">{agent.role}</p>
                        )}
                        {agent.description && (
                          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                            {agent.description}
                          </p>
                        )}
                        {agent.tags && agent.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {agent.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px]">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {agent.currentTask && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Current: {agent.currentTask}
                          </p>
                        )}
                      </div>
                      <ChevronRight className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "links" && (
          <div className="space-y-3">
            <Collapsible.Root open={goalsOpen} onOpenChange={setGoalsOpen}>
              <Collapsible.Trigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-sm font-medium text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Tie to high-level Goals (optional)
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", goalsOpen && "rotate-180")} />
                </button>
              </Collapsible.Trigger>
              <Collapsible.Content className="pt-2">
                <Textarea
                  value={goalsValue}
                  onChange={(event) => setGoalsValue(event.target.value)}
                  placeholder="Add goal names, one per line"
                  className="min-h-[120px]"
                />
              </Collapsible.Content>
            </Collapsible.Root>

            <Collapsible.Root open={workstreamsOpen} onOpenChange={setWorkstreamsOpen}>
              <Collapsible.Trigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-sm font-medium text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    Link Workstreams (optional)
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", workstreamsOpen && "rotate-180")} />
                </button>
              </Collapsible.Trigger>
              <Collapsible.Content className="pt-2">
                <Textarea
                  value={workstreamsValue}
                  onChange={(event) => setWorkstreamsValue(event.target.value)}
                  placeholder="Add workstream names, one per line"
                  className="min-h-[120px]"
                />
              </Collapsible.Content>
            </Collapsible.Root>
          </div>
        )}

        {step === "directives" && (
          <div className="space-y-3">
            {packs.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-secondary/40 p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Attach Guidance Packs
                </div>
                <div className="space-y-2">
                  {packs.map((pack) => {
                    const checked = selectedPackIds.includes(pack.id);
                    return (
                      <label
                        key={pack.id}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors",
                          checked
                            ? "border-primary/50 bg-primary/10"
                            : "border-border/60 hover:border-primary/30"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedPackIds((prev) =>
                              prev.includes(pack.id)
                                ? prev.filter((id) => id !== pack.id)
                                : [...prev, pack.id]
                            );
                          }}
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground">{pack.name}</div>
                          {pack.summary && (
                            <div className="text-xs text-muted-foreground">{pack.summary}</div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-sm font-medium text-foreground flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-primary" />
              Per-ritual directives (markdown)
            </div>
            <Textarea
              value={directivesValue}
              onChange={(event) => setDirectivesValue(event.target.value)}
              placeholder="Add instructions that should run with this ritual (markdown supported)"
              className="min-h-[160px]"
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <Button variant="ghost" onClick={goBack}>
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === "links" && (
              <Button variant="ghost" onClick={goNext}>
                Skip
              </Button>
            )}
            {step === "agent" ? (
              <Button onClick={goNext} disabled={!selectedAgentId}>
                Continue
              </Button>
            ) : step === "directives" ? (
              <Button onClick={handleConfirm} disabled={!selectedAgentId}>
                Save Assignment
              </Button>
            ) : (
              <Button onClick={goNext}>Continue</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default RitualAssignDialog;
