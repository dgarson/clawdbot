"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useGatewayStore } from "@/lib/stores/gateway";
import { useProficiencyStore } from "@/lib/stores/proficiency";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Gauge,
  Loader2,
  Key,
  ArrowRight,
  Rocket,
  Heart,
  Brain,
} from "lucide-react";

// ─── Step Definitions ────────────────────────────────────
type OnboardingStep = "welcome" | "proficiency" | "channel" | "provider" | "agent" | "ready";

const STEPS: { id: OnboardingStep; label: string }[] = [
  { id: "welcome", label: "Welcome" },
  { id: "proficiency", label: "Experience" },
  { id: "channel", label: "Connect" },
  { id: "provider", label: "AI Provider" },
  { id: "agent", label: "First Agent" },
  { id: "ready", label: "Ready!" },
];

// ─── Channel Options ─────────────────────────────────────
const CHANNEL_OPTIONS = [
  { id: "telegram", name: "Telegram", emoji: "💬", description: "Fast, reliable, rich formatting" },
  { id: "discord", name: "Discord", emoji: "🎮", description: "Great for teams and communities" },
  { id: "slack", name: "Slack", emoji: "📋", description: "Integrate with your workspace" },
  { id: "whatsapp", name: "WhatsApp", emoji: "📱", description: "Mobile-first messaging" },
  { id: "imessage", name: "iMessage", emoji: "🍎", description: "Native Apple experience" },
  { id: "webchat", name: "Web Chat", emoji: "🌐", description: "Built-in browser chat" },
];

// ─── Provider Options ────────────────────────────────────
const PROVIDER_OPTIONS = [
  { id: "anthropic", name: "Anthropic", emoji: "🧠", description: "Claude — Best for nuanced reasoning", recommended: true },
  { id: "openai", name: "OpenAI", emoji: "⚡", description: "GPT — Fast and versatile" },
  { id: "google", name: "Google", emoji: "🔍", description: "Gemini — Great for research" },
  { id: "openrouter", name: "OpenRouter", emoji: "🔀", description: "Multi-provider routing" },
];

// ─── Quick Agent Templates ───────────────────────────────
const QUICK_AGENTS = [
  { id: "assistant", name: "Personal Assistant", emoji: "🧑‍💼", description: "Task management, scheduling, reminders" },
  { id: "coder", name: "Code Partner", emoji: "💻", description: "Development help, reviews, debugging" },
  { id: "writer", name: "Creative Writer", emoji: "🎨", description: "Content, brainstorming, editing" },
  { id: "researcher", name: "Researcher", emoji: "🔬", description: "Deep research and analysis" },
  { id: "skip", name: "I'll set this up later", emoji: "⏭️", description: "Skip for now" },
];

// ─── Progress Dots ───────────────────────────────────────
function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i < current
              ? "w-2 bg-primary"
              : i === current
              ? "w-6 bg-primary"
              : "w-2 bg-muted-foreground/20"
          }`}
        />
      ))}
    </div>
  );
}

// ─── Animated Check ──────────────────────────────────────
function AnimatedCheck() {
  return (
    <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center animate-bounce">
      <Check className="h-8 w-8 text-primary" />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const connected = useGatewayStore((s) => s.connected);
  const request = useGatewayStore((s) => s.request);
  const setProfLevel = useProficiencyStore((s) => s.setLevel);

  const [step, setStep] = React.useState<OnboardingStep>("welcome");
  const [selectedProficiency, setSelectedProficiency] = React.useState<"beginner" | "standard" | "expert">("standard");
  const [selectedChannel, setSelectedChannel] = React.useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = React.useState<string | null>(null);
  const [apiKey, setApiKey] = React.useState("");
  const [selectedAgent, setSelectedAgent] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  const currentIdx = STEPS.findIndex((s) => s.id === step);

  const nextStep = () => {
    if (currentIdx < STEPS.length - 1) {
      setStep(STEPS[currentIdx + 1].id);
    }
  };

  const prevStep = () => {
    if (currentIdx > 0) {
      setStep(STEPS[currentIdx - 1].id);
    }
  };

  const handleFinish = async () => {
    // Apply proficiency
    setProfLevel(selectedProficiency);

    // Create agent if selected
    if (selectedAgent && selectedAgent !== "skip" && connected) {
      setCreating(true);
      try {
        const template = QUICK_AGENTS.find((a) => a.id === selectedAgent);
        if (template) {
          await request("agents.create", {
            name: template.name,
            workspace: template.id,
            emoji: template.emoji,
          });
        }
      } catch {
        // Non-blocking — continue even if creation fails
      }
      setCreating(false);
    }

    // Mark onboarding complete (stored in localStorage)
    localStorage.setItem("openclaw:onboarding-complete", "true");
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        {/* Progress */}
        <div className="flex flex-col items-center gap-3">
          <ProgressDots total={STEPS.length} current={currentIdx} />
          <p className="text-xs text-muted-foreground">
            Step {currentIdx + 1} of {STEPS.length}
          </p>
        </div>

        {/* ─── WELCOME ─────────────────────────────────── */}
        {step === "welcome" && (
          <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-6xl mb-4">🐾</div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome to OpenClaw
            </h1>
            <p className="text-muted-foreground text-lg max-w-sm mx-auto">
              Your AI team is about to come alive. Let's get you set up in under 2 minutes.
            </p>
            <div className="flex flex-col gap-3 pt-4">
              <Button size="lg" onClick={nextStep} className="w-full">
                Get Started
                <Rocket className="h-4 w-4 ml-2" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                localStorage.setItem("openclaw:onboarding-complete", "true");
                router.push("/dashboard");
              }}>
                Skip setup — I know what I'm doing
              </Button>
            </div>
          </div>
        )}

        {/* ─── PROFICIENCY ─────────────────────────────── */}
        {step === "proficiency" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center">
              <h2 className="text-2xl font-bold">How experienced are you?</h2>
              <p className="text-muted-foreground mt-2">
                This adjusts the interface complexity. You can change it anytime.
              </p>
            </div>

            <div className="space-y-3">
              {([
                {
                  level: "beginner" as const,
                  icon: Heart,
                  title: "New to AI agents",
                  desc: "Guided experience with tooltips and simple controls",
                },
                {
                  level: "standard" as const,
                  icon: Gauge,
                  title: "Comfortable with tech",
                  desc: "Balanced features for regular users",
                },
                {
                  level: "expert" as const,
                  icon: Brain,
                  title: "Power user / Developer",
                  desc: "Full access, raw editors, dense layouts",
                },
              ]).map(({ level, icon: Icon, title, desc }) => (
                <Card
                  key={level}
                  className={`cursor-pointer transition-all ${
                    selectedProficiency === level
                      ? "ring-2 ring-primary border-primary"
                      : "hover:border-primary/30"
                  }`}
                  onClick={() => setSelectedProficiency(level)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <Icon className={`h-6 w-6 shrink-0 ${selectedProficiency === level ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{title}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    {selectedProficiency === level && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ─── CHANNEL ─────────────────────────────────── */}
        {step === "channel" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Where will you chat?</h2>
              <p className="text-muted-foreground mt-2">
                Pick your primary messaging platform. You can add more later.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {CHANNEL_OPTIONS.map((channel) => (
                <Card
                  key={channel.id}
                  className={`cursor-pointer transition-all ${
                    selectedChannel === channel.id
                      ? "ring-2 ring-primary border-primary"
                      : "hover:border-primary/30"
                  }`}
                  onClick={() => setSelectedChannel(channel.id)}
                >
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl mb-2">{channel.emoji}</div>
                    <p className="font-medium text-sm">{channel.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{channel.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button variant="ghost" size="sm" className="w-full" onClick={nextStep}>
              Skip — I'll configure channels later
            </Button>
          </div>
        )}

        {/* ─── PROVIDER ────────────────────────────────── */}
        {step === "provider" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Connect an AI provider</h2>
              <p className="text-muted-foreground mt-2">
                Your agents need an AI model to think. Pick a provider.
              </p>
            </div>

            <div className="space-y-3">
              {PROVIDER_OPTIONS.map((provider) => (
                <Card
                  key={provider.id}
                  className={`cursor-pointer transition-all ${
                    selectedProvider === provider.id
                      ? "ring-2 ring-primary border-primary"
                      : "hover:border-primary/30"
                  }`}
                  onClick={() => setSelectedProvider(provider.id)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="text-2xl">{provider.emoji}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{provider.name}</p>
                        {provider.recommended && (
                          <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{provider.description}</p>
                    </div>
                    {selectedProvider === provider.id && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedProvider && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Key className="h-3.5 w-3.5" />
                  API Key
                </label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={`Enter your ${PROVIDER_OPTIONS.find(p => p.id === selectedProvider)?.name} API key`}
                />
                <p className="text-[10px] text-muted-foreground">
                  Your key is stored locally and never sent to OpenClaw servers.
                </p>
              </div>
            )}

            <Button variant="ghost" size="sm" className="w-full" onClick={nextStep}>
              Skip — I'll add a provider later
            </Button>
          </div>
        )}

        {/* ─── AGENT ───────────────────────────────────── */}
        {step === "agent" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Create your first agent</h2>
              <p className="text-muted-foreground mt-2">
                Pick a template to get started. You can customize everything later.
              </p>
            </div>

            <div className="space-y-3">
              {QUICK_AGENTS.map((agent) => (
                <Card
                  key={agent.id}
                  className={`cursor-pointer transition-all ${
                    selectedAgent === agent.id
                      ? "ring-2 ring-primary border-primary"
                      : "hover:border-primary/30"
                  }`}
                  onClick={() => setSelectedAgent(agent.id)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="text-2xl">{agent.emoji}</div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.description}</p>
                    </div>
                    {selectedAgent === agent.id && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ─── READY ───────────────────────────────────── */}
        {step === "ready" && (
          <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AnimatedCheck />
            <h2 className="text-2xl font-bold">You're all set!</h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {selectedAgent && selectedAgent !== "skip"
                ? `Your ${QUICK_AGENTS.find(a => a.id === selectedAgent)?.name} agent is ready to go.`
                : "Your OpenClaw instance is configured and ready."
              }
            </p>

            <div className="bg-accent/50 rounded-xl p-4 text-left space-y-2 text-sm">
              <p className="font-medium">Quick tips:</p>
              <ul className="space-y-1 text-muted-foreground text-xs">
                <li>• Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">⌘K</kbd> to open the command palette</li>
                <li>• Chat with your agents in the <strong>Chat</strong> tab</li>
                <li>• Set up automations in <strong>Cron</strong></li>
                <li>• Explore skills in the <strong>Marketplace</strong></li>
              </ul>
            </div>

            <Button
              size="lg"
              onClick={handleFinish}
              disabled={creating}
              className="w-full"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  Launch Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}

        {/* ─── Navigation ──────────────────────────────── */}
        {step !== "welcome" && step !== "ready" && (
          <div className="flex items-center justify-between pt-4">
            <Button variant="ghost" size="sm" onClick={prevStep}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button onClick={nextStep}>
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
