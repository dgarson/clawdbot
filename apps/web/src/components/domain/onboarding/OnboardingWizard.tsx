import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Wifi,
  WifiOff,
  Clock,
  User,
  Save,
  CheckCircle2,
  XCircle,
  Radio,
  Bot,
  Plus,
  MessageSquare,
  Sparkles,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptionalGateway } from "@/providers/GatewayProvider";
import { useGatewayQuery, useGatewayMutation } from "@/lib/api/gateway-hooks";
import { useGatewayConnection } from "@/hooks/useGatewayConnection";
import { useAgents, type Agent } from "@/hooks/queries";
import { QuickChatBox } from "@/components/domain/home/QuickChatBox";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "openclaw:onboarding:step";

const STEPS = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "identity", title: "Identity", icon: User },
  { id: "channels", title: "Channels", icon: Radio },
  { id: "agents", title: "First Agent", icon: Bot },
  { id: "chat", title: "First Chat", icon: MessageSquare },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GatewayStatusResult {
  ok?: boolean;
  version?: string;
  uptime?: number;
  uptimeFormatted?: string;
  [key: string]: unknown;
}

interface ConfigGetResult {
  config?: {
    identity?: { name?: string; displayName?: string };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ConfigSetResult {
  ok?: boolean;
  [key: string]: unknown;
}

interface ChannelStatusResult {
  channelOrder?: string[];
  channelLabels?: Record<string, string>;
  channels?: Record<string, { configured?: boolean; connected?: boolean; error?: string }>;
  channelAccounts?: Record<string, Array<{ accountId: string; connected?: boolean; enabled?: boolean; configured?: boolean; statusMessage?: string }>>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSavedStep(): number {
  if (typeof window === "undefined") {return 0;}
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const n = parseInt(saved, 10);
    if (!isNaN(n) && n >= 0 && n < STEPS.length) {return n;}
  }
  return 0;
}

function saveStep(step: number) {
  if (typeof window === "undefined") {return;}
  localStorage.setItem(STORAGE_KEY, String(step));
}

function formatUptime(seconds?: number): string {
  if (seconds == null || seconds <= 0) {return "just started";}
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) {parts.push(`${h}h`);}
  if (m > 0) {parts.push(`${m}m`);}
  if (s > 0 || parts.length === 0) {parts.push(`${s}s`);}
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Step Components
// ---------------------------------------------------------------------------

function StepWelcome() {
  const gateway = useOptionalGateway();
  const { isConnected } = useGatewayConnection();

  const { data: status, isLoading, isError, error } = useGatewayQuery<GatewayStatusResult>(
    "gateway.status",
    {},
    { enabled: isConnected, staleTime: 10_000, refetchInterval: 15_000 },
  );

  return (
    <div className="flex flex-col items-center text-center space-y-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10"
      >
        <Sparkles className="h-10 w-10 text-primary" />
      </motion.div>

      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to OpenClaw</h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          Let's get you set up in a few quick steps. We'll check your gateway, configure your
          identity, and get you chatting with an agent.
        </p>
      </div>

      {/* Gateway status card */}
      <Card className="w-full max-w-sm mx-auto">
        <CardContent className="p-6">
          {!gateway || !isConnected ? (
            <div className="flex items-center gap-3 text-destructive">
              <WifiOff className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <p className="font-medium">Gateway not connected</p>
                <p className="text-sm text-muted-foreground">
                  Make sure your gateway is running, then refresh this page.
                </p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Checking gateway…</span>
            </div>
          ) : isError ? (
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <p className="font-medium">Couldn't reach gateway</p>
                <p className="text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : "Unknown error"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-emerald-500">
              <Wifi className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <p className="font-medium">Your gateway is running!</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Uptime: {status?.uptimeFormatted ?? formatUptime(status?.uptime)}</span>
                  {status?.version && (
                    <Badge variant="secondary" className="text-xs">
                      v{status.version}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StepIdentity({ onSaved }: { onSaved: () => void }) {
  const { isConnected } = useGatewayConnection();

  const { data: configData, isLoading: configLoading } = useGatewayQuery<ConfigGetResult>(
    "config.get",
    {},
    { enabled: isConnected, staleTime: 30_000 },
  );

  const [name, setName] = React.useState("");
  const [hasEdited, setHasEdited] = React.useState(false);

  // Prefill from config once loaded
  React.useEffect(() => {
    if (configData && !hasEdited) {
      const savedName =
        configData.config?.identity?.displayName ??
        configData.config?.identity?.name ??
        "";
      if (savedName) {setName(savedName);}
    }
  }, [configData, hasEdited]);

  const saveMutation = useGatewayMutation<
    { key: string; value: unknown },
    ConfigSetResult
  >("config.set", {
    invalidate: [["config.get"]],
    onSuccess: () => onSaved(),
  });

  const handleSave = () => {
    if (!name.trim()) {return;}
    saveMutation.mutate({
      key: "identity.displayName",
      value: name.trim(),
    });
  };

  return (
    <div className="flex flex-col items-center text-center space-y-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10"
      >
        <User className="h-8 w-8 text-blue-500" />
      </motion.div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold">What should we call you?</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          This name will be shown in conversations and used by your agents.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {configLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Input
            placeholder="Your name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setHasEdited(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {handleSave();}
            }}
            className="text-center text-lg"
            autoFocus
          />
        )}

        <Button
          onClick={handleSave}
          disabled={!name.trim() || saveMutation.isPending}
          className="w-full gap-2"
          size="lg"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save & Continue
        </Button>

        {saveMutation.isError && (
          <p className="text-sm text-destructive">
            Failed to save: {saveMutation.error?.message ?? "Unknown error"}
          </p>
        )}

        {saveMutation.isSuccess && (
          <p className="text-sm text-emerald-500 flex items-center justify-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Saved!
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StepChannels() {
  const { isConnected } = useGatewayConnection();

  const {
    data: channelData,
    isLoading,
    isError,
    error,
  } = useGatewayQuery<ChannelStatusResult>(
    "channels.status",
    {},
    { enabled: isConnected, staleTime: 15_000, refetchInterval: 20_000 },
  );

  const channelList = React.useMemo(() => {
    if (!channelData?.channelOrder) {return [];}
    return channelData.channelOrder.map((id) => {
      const summary = channelData.channels?.[id];
      const label = channelData.channelLabels?.[id] ?? id;
      const accounts = channelData.channelAccounts?.[id] ?? [];
      const hasConnected = summary?.connected || accounts.some((a) => a.connected);
      const hasConfigured = summary?.configured || accounts.some((a) => a.configured);
      return { id, label, connected: hasConnected, configured: hasConfigured, error: summary?.error };
    });
  }, [channelData]);

  return (
    <div className="flex flex-col items-center text-center space-y-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10"
      >
        <Radio className="h-8 w-8 text-violet-500" />
      </motion.div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Connected Channels</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Here are the messaging channels your gateway knows about. You can configure more later in
          Settings.
        </p>
      </div>

      <div className="w-full max-w-md space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))
        ) : isError ? (
          <Card className="border-destructive/50">
            <CardContent className="p-4 flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="text-sm">
                {error instanceof Error ? error.message : "Failed to load channels"}
              </span>
            </CardContent>
          </Card>
        ) : channelList.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-muted-foreground">
              No channels found. You can add channels in Settings after onboarding.
            </CardContent>
          </Card>
        ) : (
          channelList.map((ch) => (
            <Card key={ch.id} className="transition-colors hover:border-primary/30">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      ch.connected
                        ? "bg-emerald-500/10 text-emerald-500"
                        : ch.configured
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Radio className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">{ch.label}</p>
                    {ch.error && <p className="text-xs text-destructive">{ch.error}</p>}
                  </div>
                </div>

                {ch.connected ? (
                  <Badge variant="default" className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20 border-0 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : ch.configured ? (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Configured
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground gap-1">
                    <XCircle className="h-3 w-3" />
                    Not set up
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StepAgents() {
  const { data: agents, isLoading, isError, error, isLive: _isLive } = useAgents();

  const agentList = agents ?? [];

  return (
    <div className="flex flex-col items-center text-center space-y-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10"
      >
        <Bot className="h-8 w-8 text-orange-500" />
      </motion.div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Your Agents</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          {agentList.length > 0
            ? "Here are the agents already configured on your gateway."
            : "You don't have any agents yet. Let's create your first one!"}
        </p>
      </div>

      <div className="w-full max-w-md space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))
        ) : isError ? (
          <Card className="border-destructive/50">
            <CardContent className="p-4 flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span className="text-sm">
                {error instanceof Error ? error.message : "Failed to load agents"}
              </span>
            </CardContent>
          </Card>
        ) : agentList.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="p-8 flex flex-col items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">No agents yet</p>
                <p className="text-sm text-muted-foreground">
                  Head to the Agents page after onboarding to create your first agent.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          agentList.slice(0, 6).map((agent: Agent) => (
            <Card key={agent.id} className="transition-colors hover:border-primary/30">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold",
                      agent.status === "online"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : agent.status === "busy"
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {agent.name?.[0]?.toUpperCase() ?? "A"}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">{agent.name}</p>
                    {agent.role && (
                      <p className="text-xs text-muted-foreground">{agent.role}</p>
                    )}
                  </div>
                </div>
                <Badge
                  variant={agent.status === "online" ? "default" : "secondary"}
                  className={cn(
                    "capitalize",
                    agent.status === "online" &&
                      "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20 border-0",
                  )}
                >
                  {agent.status}
                </Badge>
              </CardContent>
            </Card>
          ))
        )}

        {agentList.length > 6 && (
          <p className="text-sm text-muted-foreground">
            +{agentList.length - 6} more agents
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StepChat({ onComplete }: { onComplete: () => void }) {
  const navigate = useNavigate();

  const handleSend = (message: string, agentId: string) => {
    // Navigate to conversations with the message pre-sent
    onComplete();
    void navigate({
      to: "/conversations",
      search: { agentId, message },
    });
  };

  return (
    <div className="flex flex-col items-center text-center space-y-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10"
      >
        <MessageSquare className="h-8 w-8 text-primary" />
      </motion.div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Send your first message</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Pick an agent and type a message to start a conversation. You can also skip this and
          explore later.
        </p>
      </div>

      <div className="w-full max-w-lg">
        <QuickChatBox onSend={handleSend} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Wizard
// ---------------------------------------------------------------------------

interface OnboardingWizardProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export function OnboardingWizard({ onComplete, onCancel }: OnboardingWizardProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = React.useState(getSavedStep);

  // Persist step to localStorage
  React.useEffect(() => {
    saveStep(currentStep);
  }, [currentStep]);

  const stepConfig = STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = React.useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep]);

  const handleBack = React.useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const handleFinish = React.useCallback(() => {
    // Clean up saved progress
    localStorage.removeItem(STORAGE_KEY);
    onComplete?.();
    void navigate({ to: "/" });
  }, [onComplete, navigate]);

  const handleCancel = React.useCallback(() => {
    onCancel?.();
    void navigate({ to: "/" });
  }, [onCancel, navigate]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-4 min-w-[80px]">
          {!isFirstStep && (
            <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
        </div>

        {/* Step dots */}
        <div className="flex items-center gap-2">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center justify-center rounded-full transition-all duration-300",
                  index === currentStep
                    ? "h-8 w-8 bg-primary text-primary-foreground"
                    : index < currentStep
                      ? "h-6 w-6 bg-primary/20 text-primary"
                      : "h-6 w-6 bg-muted text-muted-foreground",
                )}
              >
                {index < currentStep ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Icon className={cn("shrink-0", index === currentStep ? "h-4 w-4" : "h-3 w-3")} />
                )}
              </div>
            );
          })}
        </div>

        {/* Close */}
        <div className="min-w-[80px] flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Progress bar */}
      <Progress value={progress} className="h-1 rounded-none" />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto flex items-center justify-center">
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {stepConfig.id === "welcome" && <StepWelcome />}
              {stepConfig.id === "identity" && <StepIdentity onSaved={handleNext} />}
              {stepConfig.id === "channels" && <StepChannels />}
              {stepConfig.id === "agents" && <StepAgents />}
              {stepConfig.id === "chat" && <StepChat onComplete={handleFinish} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer nav — hidden on identity step (has its own save) and chat step (has its own action) */}
      {stepConfig.id !== "identity" && (
        <footer className="border-t px-6 py-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {STEPS.length}
          </span>

          <div className="flex items-center gap-3">
            {isLastStep ? (
              <Button size="lg" onClick={handleFinish} className="gap-2">
                Finish Setup
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="lg" onClick={handleNext} className="gap-2">
                {stepConfig.id === "welcome" ? "Get Started" : "Continue"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}

export default OnboardingWizard;
