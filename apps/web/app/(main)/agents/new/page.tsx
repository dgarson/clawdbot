"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useGatewayStore } from "@/lib/stores/gateway";
import { useProficiency } from "@/lib/stores/proficiency";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ComplexityGate } from "@/components/adaptive/complexity-gate";
import { AdaptiveLabel } from "@/components/adaptive/adaptive-label";
import { GuidedTooltip } from "@/components/adaptive/guided-tooltip";
import type { ModelsListResult, ModelChoice, AgentsCreateResult } from "@/lib/gateway/types";
import {
  Bot,
  Sparkles,
  User,
  Brain,
  Zap,
  Shield,
  MessageSquare,
  Check,
  ChevronLeft,
  ChevronRight,
  Wand2,
  Eye,
  AlertCircle,
  Palette,
  Settings2,
  FileText,
  ArrowRight,
  Loader2,
} from "lucide-react";

// === Templates ===
type AgentTemplate = {
  id: string;
  emoji: string;
  name: string;
  description: string;
  soul: string;
  tags: string[];
};

const TEMPLATES: AgentTemplate[] = [
  {
    id: "personal-assistant",
    emoji: "🧑‍💼",
    name: "Personal Assistant",
    description: "Manages schedule, tasks, and reminders. Friendly and organized.",
    soul: "You are a personal assistant. You're organized, proactive, and always helpful. You manage schedules, set reminders, and keep things on track.\n\n## Communication Style\n- Friendly but professional\n- Use bullet points for clarity\n- Confirm before taking actions\n- Proactively suggest improvements",
    tags: ["productivity", "tasks", "calendar"],
  },
  {
    id: "code-reviewer",
    emoji: "💻",
    name: "Code Reviewer",
    description: "Reviews code, suggests improvements, catches bugs. Technical and thorough.",
    soul: "You are a senior code reviewer. You analyze code for bugs, performance issues, security vulnerabilities, and style problems.\n\n## Communication Style\n- Technical and precise\n- Always explain the 'why' behind suggestions\n- Prioritize issues by severity\n- Suggest concrete fixes, not just problems",
    tags: ["development", "code", "review"],
  },
  {
    id: "creative-writer",
    emoji: "🎨",
    name: "Creative Writer",
    description: "Helps with content creation, brainstorming, and storytelling.",
    soul: "You are a creative writer and content strategist. You help generate ideas, draft content, and refine writing.\n\n## Communication Style\n- Creative and inspiring\n- Adapt tone to the content type\n- Offer multiple options when brainstorming\n- Balance creativity with clarity",
    tags: ["writing", "content", "creative"],
  },
  {
    id: "data-analyst",
    emoji: "📊",
    name: "Data Analyst",
    description: "Analyzes data, creates reports, and finds insights. Analytical and precise.",
    soul: "You are a data analyst. You help interpret data, create summaries, and surface actionable insights.\n\n## Communication Style\n- Analytical and data-driven\n- Use tables and structured formats\n- Highlight key findings prominently\n- Quantify whenever possible",
    tags: ["data", "analytics", "reports"],
  },
  {
    id: "customer-support",
    emoji: "🤝",
    name: "Customer Support",
    description: "Handles support inquiries with empathy and efficiency.",
    soul: "You are a customer support specialist. You help resolve issues, answer questions, and ensure customer satisfaction.\n\n## Communication Style\n- Empathetic and patient\n- Acknowledge feelings before solving\n- Provide step-by-step solutions\n- Follow up on resolution",
    tags: ["support", "customer", "service"],
  },
  {
    id: "blank",
    emoji: "⬜",
    name: "Start from Scratch",
    description: "Begin with a blank slate. Full creative freedom.",
    soul: "",
    tags: [],
  },
];

// === Wizard Steps ===
type WizardStep = "template" | "identity" | "personality" | "model" | "review";

const STEPS: { id: WizardStep; label: string; beginnerLabel: string }[] = [
  { id: "template", label: "Template", beginnerLabel: "Choose a type" },
  { id: "identity", label: "Identity", beginnerLabel: "Name your agent" },
  { id: "personality", label: "Personality", beginnerLabel: "Personality" },
  { id: "model", label: "Model", beginnerLabel: "Brain power" },
  { id: "review", label: "Review", beginnerLabel: "Review & create" },
];

// === Form State ===
type AgentFormState = {
  templateId: string;
  name: string;
  emoji: string;
  description: string;
  soulContent: string;
  modelId: string | null;
  formality: number; // 0-100
  verbosity: number;
  proactivity: number;
  humor: number;
};

const DEFAULT_FORM: AgentFormState = {
  templateId: "",
  name: "",
  emoji: "🤖",
  description: "",
  soulContent: "",
  modelId: null,
  formality: 50,
  verbosity: 50,
  proactivity: 50,
  humor: 30,
};

// === Personality Slider ===
function PersonalitySlider({
  label,
  leftLabel,
  rightLabel,
  value,
  onChange,
  helpText,
}: {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (v: number) => void;
  helpText?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {helpText && (
          <GuidedTooltip content={helpText}>
            <span className="text-[10px] text-muted-foreground">{value}%</span>
          </GuidedTooltip>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-16 text-right">{leftLabel}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-primary h-2 rounded-full appearance-none bg-muted cursor-pointer"
        />
        <span className="text-xs text-muted-foreground w-16">{rightLabel}</span>
      </div>
    </div>
  );
}

// === Step Progress ===
function StepProgress({
  steps,
  currentStep,
  onStepClick,
}: {
  steps: typeof STEPS;
  currentStep: WizardStep;
  onStepClick: (step: WizardStep) => void;
}) {
  const { level } = useProficiency();
  const currentIdx = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, idx) => {
        const isComplete = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const label = level === "beginner" ? step.beginnerLabel : step.label;

        return (
          <React.Fragment key={step.id}>
            {idx > 0 && (
              <div className={`h-[2px] flex-1 max-w-8 ${isComplete ? "bg-primary" : "bg-border"}`} />
            )}
            <button
              onClick={() => idx <= currentIdx && onStepClick(step.id)}
              disabled={idx > currentIdx}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isComplete
                  ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {isComplete ? (
                <Check className="h-3 w-3" />
              ) : (
                <span>{idx + 1}</span>
              )}
              <span className="hidden sm:inline">{label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// === Main Component ===
export default function AgentBuilderPage() {
  const router = useRouter();
  const { level, isAtLeast } = useProficiency();
  const connected = useGatewayStore((s) => s.connected);
  const request = useGatewayStore((s) => s.request);

  const [step, setStep] = React.useState<WizardStep>("template");
  const [form, setForm] = React.useState<AgentFormState>({ ...DEFAULT_FORM });
  const [models, setModels] = React.useState<ModelChoice[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reviewFeedback, setReviewFeedback] = React.useState<string | null>(null);
  const [reviewing, setReviewing] = React.useState(false);

  // Load models
  React.useEffect(() => {
    if (!connected) {return;}
    request<{ models: ModelChoice[] }>("models.list", {})
      .then((r) => setModels(r.models ?? []))
      .catch(() => {});
  }, [connected, request]);

  const updateForm = (updates: Partial<AgentFormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const selectTemplate = (template: AgentTemplate) => {
    updateForm({
      templateId: template.id,
      name: template.id === "blank" ? "" : template.name,
      emoji: template.emoji,
      soulContent: template.soul,
      description: template.description,
    });
    setStep("identity");
  };

  const generateSoulFromSliders = (): string => {
    const traits: string[] = [];
    if (form.formality > 70) {traits.push("formal and professional");}
    else if (form.formality < 30) {traits.push("casual and relaxed");}
    else {traits.push("balanced in formality");}

    if (form.verbosity > 70) {traits.push("detailed and thorough");}
    else if (form.verbosity < 30) {traits.push("concise and to-the-point");}

    if (form.proactivity > 70) {traits.push("proactive — suggests improvements unprompted");}
    else if (form.proactivity < 30) {traits.push("reactive — waits for explicit requests");}

    if (form.humor > 70) {traits.push("playful with a sense of humor");}
    else if (form.humor < 30) {traits.push("serious and focused");}

    let soul = form.soulContent || `You are ${form.name || "an AI assistant"}.`;
    if (!soul.includes("Communication Style") && !soul.includes("communication style")) {
      soul += `\n\n## Communication Style\n- ${traits.join("\n- ")}`;
    }
    return soul;
  };

  const handleCreate = async () => {
    if (!connected || creating) {return;}
    setCreating(true);
    setError(null);

    try {
      const agentName = form.name.trim() || "New Agent";
      const result = await request<AgentsCreateResult>("agents.create", {
        name: agentName,
        workspace: agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        emoji: form.emoji,
      });

      // Save SOUL.md
      const soulContent = isAtLeast("standard") ? form.soulContent : generateSoulFromSliders();
      if (soulContent.trim()) {
        await request("agents.files.set", {
          agentId: result.agentId,
          name: "SOUL.md",
          content: soulContent,
        });
      }

      router.push(`/agents/${result.agentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
      setCreating(false);
    }
  };

  const handleAutoReview = async () => {
    if (!connected || reviewing) {return;}
    setReviewing(true);
    setReviewFeedback(null);

    try {
      const configSummary = `Agent Name: ${form.name}\nEmoji: ${form.emoji}\nModel: ${form.modelId ?? "default"}\n\nSOUL.md:\n${form.soulContent || generateSoulFromSliders()}`;

      // Use a chat send to get AI feedback on the config
      const response = await request<{ message?: { content?: string } }>("chat.send", {
        sessionKey: `__builder-review-${Date.now()}`,
        message: `Please review this OpenClaw agent configuration and provide feedback. Be specific about what's good and what could be improved:\n\n${configSummary}`,
        idempotencyKey: crypto.randomUUID(),
      });

      // The actual response comes via event stream, so we'll show a placeholder
      setReviewFeedback("Review submitted. Check the response in your chat for detailed feedback.");
    } catch (err) {
      setReviewFeedback("Could not run auto-review. Please check your connection.");
    } finally {
      setReviewing(false);
    }
  };

  const canProceed = (): boolean => {
    switch (step) {
      case "template": return !!form.templateId;
      case "identity": return !!form.name.trim();
      case "personality": return true;
      case "model": return true;
      case "review": return !!form.name.trim();
      default: return false;
    }
  };

  const nextStep = () => {
    const idx = STEPS.findIndex((s) => s.id === step);
    if (idx < STEPS.length - 1) {setStep(STEPS[idx + 1].id);}
  };

  const prevStep = () => {
    const idx = STEPS.findIndex((s) => s.id === step);
    if (idx > 0) {setStep(STEPS[idx - 1].id);}
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <AdaptiveLabel
              beginner="Create Your AI Agent"
              standard="New Agent"
              expert="Create Agent"
            />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <AdaptiveLabel
              beginner="Let's build your perfect AI assistant step by step"
              standard="Configure a new agent with identity, personality, and capabilities"
              expert="Agent workspace scaffolding"
            />
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push("/agents")}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      {/* Step Progress */}
      <StepProgress steps={STEPS} currentStep={step} onStepClick={setStep} />

      {/* Step Content */}
      <div className="min-h-[400px]">
        {/* STEP: Template */}
        {step === "template" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              <AdaptiveLabel
                beginner="What kind of AI agent do you want?"
                standard="Choose a template"
                expert="Select template"
              />
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TEMPLATES.map((template) => (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    form.templateId === template.id
                      ? "ring-2 ring-primary border-primary"
                      : "hover:border-primary/30"
                  }`}
                  onClick={() => selectTemplate(template)}
                >
                  <CardContent className="p-5">
                    <div className="text-3xl mb-3">{template.emoji}</div>
                    <h3 className="font-semibold text-sm mb-1">{template.name}</h3>
                    <p className="text-xs text-muted-foreground">{template.description}</p>
                    {template.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {template.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* STEP: Identity */}
        {step === "identity" && (
          <div className="space-y-6 max-w-lg">
            <h2 className="text-lg font-semibold">
              <AdaptiveLabel
                beginner="Give your agent a name and look"
                standard="Agent Identity"
                expert="Identity"
              />
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  <GuidedTooltip content="This is how your agent will introduce itself and appear in conversations.">
                    <AdaptiveLabel beginner="Agent Name" standard="Name" expert="Name" />
                  </GuidedTooltip>
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  placeholder="e.g., Schedule Assistant"
                  className="text-base"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  <AdaptiveLabel beginner="Pick an emoji" standard="Emoji" expert="Emoji" />
                </label>
                <div className="flex flex-wrap gap-2">
                  {["🤖", "🧑‍💼", "💻", "🎨", "📊", "🤝", "📧", "🛡️", "📝", "🏠", "🧠", "⚡"].map((e) => (
                    <button
                      key={e}
                      onClick={() => updateForm({ emoji: e })}
                      className={`text-2xl p-2 rounded-lg transition-colors ${
                        form.emoji === e ? "bg-primary/10 ring-2 ring-primary" : "hover:bg-accent"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  <AdaptiveLabel
                    beginner="What should this agent do?"
                    standard="Description"
                    expert="Description (optional)"
                  />
                </label>
                <Textarea
                  value={form.description}
                  onChange={(e) => updateForm({ description: e.target.value })}
                  placeholder="Describe what this agent will help you with..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP: Personality */}
        {step === "personality" && (
          <div className="space-y-6 max-w-lg">
            <h2 className="text-lg font-semibold">
              <AdaptiveLabel
                beginner="How should your agent communicate?"
                standard="Personality & Style"
                expert="SOUL Configuration"
              />
            </h2>

            {/* Beginner/Standard: Sliders */}
            <ComplexityGate
              level="expert"
              fallback={
                <div className="space-y-6">
                  <PersonalitySlider
                    label="Formality"
                    leftLabel="Casual"
                    rightLabel="Formal"
                    value={form.formality}
                    onChange={(v) => updateForm({ formality: v })}
                    helpText="How formally should your agent communicate? Casual is friendly and relaxed, formal is professional."
                  />
                  <PersonalitySlider
                    label="Detail Level"
                    leftLabel="Concise"
                    rightLabel="Detailed"
                    value={form.verbosity}
                    onChange={(v) => updateForm({ verbosity: v })}
                    helpText="How much detail should responses include? Concise gives quick answers, detailed gives thorough explanations."
                  />
                  <PersonalitySlider
                    label="Initiative"
                    leftLabel="Reactive"
                    rightLabel="Proactive"
                    value={form.proactivity}
                    onChange={(v) => updateForm({ proactivity: v })}
                    helpText="Should your agent wait for instructions or suggest things on its own?"
                  />
                  <PersonalitySlider
                    label="Tone"
                    leftLabel="Serious"
                    rightLabel="Playful"
                    value={form.humor}
                    onChange={(v) => updateForm({ humor: v })}
                    helpText="Set the general tone. Serious is all-business, playful includes humor."
                  />
                </div>
              }
            >
              {/* Expert: Direct SOUL.md editing */}
              <div>
                <label className="text-sm font-medium mb-1.5 flex items-center gap-2">
                  SOUL.md
                  <Badge variant="secondary" className="text-[10px]">Markdown</Badge>
                </label>
                <Textarea
                  value={form.soulContent}
                  onChange={(e) => updateForm({ soulContent: e.target.value })}
                  placeholder="# Soul&#10;&#10;You are..."
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>
            </ComplexityGate>
          </div>
        )}

        {/* STEP: Model */}
        {step === "model" && (
          <div className="space-y-6 max-w-2xl">
            <h2 className="text-lg font-semibold">
              <AdaptiveLabel
                beginner="Choose your agent's brain power"
                standard="Select Model"
                expert="Model Configuration"
              />
            </h2>

            <p className="text-sm text-muted-foreground">
              <AdaptiveLabel
                beginner="Pick how smart your agent should be. Smarter models cost more but give better results."
                standard="Choose the language model that powers your agent."
                expert="Select primary model. Fallbacks can be configured later."
              />
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Default option */}
              <Card
                className={`cursor-pointer transition-all ${
                  form.modelId === null ? "ring-2 ring-primary border-primary" : "hover:border-primary/30"
                }`}
                onClick={() => updateForm({ modelId: null })}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Default</span>
                    <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use the system default model. Good balance of quality and cost.
                  </p>
                </CardContent>
              </Card>

              {/* Model options */}
              {models.slice(0, 7).map((model) => (
                <Card
                  key={model.id}
                  className={`cursor-pointer transition-all ${
                    form.modelId === model.id ? "ring-2 ring-primary border-primary" : "hover:border-primary/30"
                  }`}
                  onClick={() => updateForm({ modelId: model.id })}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm truncate">{model.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{model.provider}</Badge>
                      {model.reasoning && (
                        <Badge variant="secondary" className="text-[10px]">Reasoning</Badge>
                      )}
                      <ComplexityGate level="standard">
                        {model.contextWindow && (
                          <span className="text-[10px] text-muted-foreground">
                            {Math.round(model.contextWindow / 1000)}K ctx
                          </span>
                        )}
                      </ComplexityGate>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* STEP: Review */}
        {step === "review" && (
          <div className="space-y-6 max-w-2xl">
            <h2 className="text-lg font-semibold">
              <AdaptiveLabel
                beginner="Ready to create your agent!"
                standard="Review Configuration"
                expert="Review & Create"
              />
            </h2>

            {/* Summary card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{form.emoji}</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{form.name || "Unnamed Agent"}</h3>
                    {form.description && (
                      <p className="text-sm text-muted-foreground mt-1">{form.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Badge variant="outline">
                        {form.modelId ?? "Default model"}
                      </Badge>
                      {form.templateId && form.templateId !== "blank" && (
                        <Badge variant="secondary">
                          Template: {TEMPLATES.find((t) => t.id === form.templateId)?.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Personality summary */}
            <ComplexityGate
              level="expert"
              fallback={
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Personality</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Formality</span>
                      <span>{form.formality > 60 ? "Formal" : form.formality < 40 ? "Casual" : "Balanced"}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Detail</span>
                      <span>{form.verbosity > 60 ? "Detailed" : form.verbosity < 40 ? "Concise" : "Balanced"}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Initiative</span>
                      <span>{form.proactivity > 60 ? "Proactive" : form.proactivity < 40 ? "Reactive" : "Balanced"}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Tone</span>
                      <span>{form.humor > 60 ? "Playful" : form.humor < 40 ? "Serious" : "Balanced"}</span>
                    </div>
                  </CardContent>
                </Card>
              }
            >
              {/* Expert: Show generated SOUL.md */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    SOUL.md Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs font-mono bg-muted p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap">
                    {form.soulContent || generateSoulFromSliders()}
                  </pre>
                </CardContent>
              </Card>
            </ComplexityGate>

            {/* Auto-Review */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-primary" />
                      <AdaptiveLabel
                        beginner="AI Review"
                        standard="Auto-Review"
                        expert="LLM Config Review"
                      />
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Get AI feedback on your agent configuration before creating it
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAutoReview}
                    disabled={reviewing}
                  >
                    {reviewing ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Reviewing...
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3 mr-1" />
                        Review
                      </>
                    )}
                  </Button>
                </div>
                {reviewFeedback && (
                  <div className="mt-3 p-3 bg-accent rounded-lg text-xs">
                    {reviewFeedback}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={step === "template"}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        {step === "review" ? (
          <Button
            size="lg"
            onClick={handleCreate}
            disabled={!canProceed() || creating || !connected}
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                <AdaptiveLabel
                  beginner="Create My Agent!"
                  standard="Create Agent"
                  expert="Create"
                />
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={nextStep}
            disabled={!canProceed()}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
