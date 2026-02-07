"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { PartyPopper, ArrowRight, Rocket, MessageSquare, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getChannelsStatus, getConfig, getHealth } from "@/lib/api";
import { getGatewayClient } from "@/lib/api/gateway-client";
import { markOnboardingComplete } from "@/hooks/useOnboardingCheck";

interface SuccessStepProps {
  onGoToDashboard: () => void;
  onStartChat: () => void;
}

// Confetti particle component
function ConfettiParticle({
  delay,
  x,
  drift,
  color,
}: {
  delay: number;
  x: number;
  drift: number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ y: -20, x, opacity: 1, rotate: 0 }}
      animate={{
        y: 400,
        opacity: 0,
        rotate: 360,
        x: x + drift,
      }}
      transition={{
        duration: 2.5,
        delay,
        ease: "easeOut",
      }}
      className="absolute top-0 pointer-events-none"
      style={{ left: "50%" }}
    >
      <div
        className="w-3 h-3 rounded-sm"
        style={{ backgroundColor: color }}
      />
    </motion.div>
  );
}

const confettiColors = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#06b6d4", // cyan
];

export function SuccessStep({ onGoToDashboard, onStartChat }: SuccessStepProps) {
  const [showConfetti, setShowConfetti] = React.useState(true);
  const [checkState, setCheckState] = React.useState<"idle" | "running" | "success" | "error">("idle");
  const [checkErrors, setCheckErrors] = React.useState<string[]>([]);
  const [gatewayReachable, setGatewayReachable] = React.useState(false);
  const [channelsWorking, setChannelsWorking] = React.useState(false);
  const [modelAccessible, setModelAccessible] = React.useState(false);
  const [configSaved, setConfigSaved] = React.useState(false);
  const savedRef = React.useRef(false);
  const [confettiParticles] = React.useState(() =>
    Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      delay: i * 0.05,
      x: (Math.random() - 0.5) * 300,
      drift: (Math.random() - 0.5) * 100,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
    }))
  );

  React.useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const runHealthChecks = React.useCallback(async () => {
    setCheckState("running");
    setCheckErrors([]);
    setGatewayReachable(false);
    setChannelsWorking(false);
    setModelAccessible(false);
    setConfigSaved(false);

    const errors: string[] = [];
    let gatewayOk = false;
    let channelsOk = false;
    let modelOk = false;

    try {
      const health = await getHealth();
      gatewayOk = health.ok ?? (health as { status?: string }).status === "ok";
      if (!gatewayOk) {
        errors.push("Gateway is not reachable");
      }

      const channels = await getChannelsStatus();
      const channelList = channels.channels ?? {};
      const hasConnectedChannels = Object.values(channelList).some((channel) => channel.connected);
      channelsOk = Object.keys(channelList).length === 0 || hasConnectedChannels;
      if (!channelsOk) {
        errors.push("No channels are connected");
      }

      const snapshot = await getConfig();
      const defaults = (snapshot.config?.agents as { defaults?: { model?: unknown } } | undefined)?.defaults;
      const modelValue = defaults?.model;
      const model =
        typeof modelValue === "string"
          ? modelValue
          : typeof modelValue === "object"
            ? (modelValue as { primary?: string }).primary
            : undefined;

      if (model) {
        try {
          const client = getGatewayClient();
          await client.request("agent.test", { model, maxTokens: 10 });
          modelOk = true;
        } catch {
          errors.push("Model API is not accessible");
        }
      } else {
        errors.push("No model configured");
      }

      setGatewayReachable(gatewayOk);
      setChannelsWorking(channelsOk);
      setModelAccessible(modelOk);
    } catch (error) {
      errors.push(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    setCheckErrors(errors);
    setCheckState(errors.length === 0 ? "success" : "error");

    if (errors.length === 0 && !savedRef.current) {
      try {
        const snapshot = await getConfig();
        if (!snapshot.hash) {
          throw new Error("Config hash missing");
        }

        const updatedConfig = {
          ...snapshot.config,
          wizard: {
            ...(snapshot.config?.wizard as Record<string, unknown> | undefined),
            onboarding: {
              completedAt: new Date().toISOString(),
            },
          },
        };

        const client = getGatewayClient();
        await client.request("config.set", {
          raw: JSON.stringify(updatedConfig, null, 2),
          baseHash: snapshot.hash,
        });
        savedRef.current = true;
        setConfigSaved(true);
        markOnboardingComplete();
      } catch (error) {
        setConfigSaved(false);
        setCheckState("error");
        setCheckErrors((prev) => [
          ...prev,
          error instanceof Error ? error.message : "Failed to save onboarding completion",
        ]);
      }
    }
  }, []);

  React.useEffect(() => {
    void runHealthChecks();
  }, [runHealthChecks]);

  return (
    <div className="flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          {confettiParticles.map((particle) => (
            <ConfettiParticle
              key={particle.id}
              delay={particle.delay}
              x={particle.x}
              drift={particle.drift}
              color={particle.color}
            />
          ))}
        </div>
      )}

      {/* Success Icon */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", duration: 0.8 }}
        className="mb-8 relative"
      >
        <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-xl">
          <PartyPopper className="h-12 w-12 text-white" />
        </div>
        <motion.div
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: 3, duration: 0.5, delay: 0.5 }}
          className="absolute -inset-3 rounded-3xl bg-green-500/30 -z-10 blur-xl"
        />
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-3 mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          You're All Set!
        </h1>
        <p className="text-lg text-muted-foreground max-w-md">
          Clawdbrain is ready to help you be more productive. Let's get started!
        </p>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-2 gap-4 mb-10 w-full max-w-sm"
      >
        <div className="p-4 rounded-xl bg-muted/30 text-center">
          <div className="text-2xl font-bold text-foreground">1</div>
          <div className="text-xs text-muted-foreground">Agent Ready</div>
        </div>
        <div className="p-4 rounded-xl bg-muted/30 text-center">
          <div className="text-2xl font-bold text-foreground">Unlimited</div>
          <div className="text-xs text-muted-foreground">Possibilities</div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <Button size="lg" onClick={onGoToDashboard} className="px-6">
          <Rocket className="h-4 w-4" />
          Go to Dashboard
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={onStartChat}
          className="px-6"
        >
          <MessageSquare className="h-4 w-4" />
          Start a Conversation
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-8 w-full max-w-lg"
      >
        <Card className="bg-muted/30 border-muted">
          <CardContent className="p-5 space-y-4 text-left">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Gateway validation</p>
                <p className="text-xs text-muted-foreground">
                  Verifies gateway, channel, and model connectivity before you start.
                </p>
              </div>
              {checkState === "running" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {checkState === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              {checkState === "error" && <XCircle className="h-4 w-4 text-destructive" />}
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                {checkState === "running" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : gatewayReachable ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                ) : (
                  <XCircle className="h-3 w-3 text-destructive" />
                )}
                <span>Gateway health check</span>
              </div>
              <div className="flex items-center gap-2">
                {checkState === "running" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : channelsWorking ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                ) : (
                  <XCircle className="h-3 w-3 text-destructive" />
                )}
                <span>Channels connectivity</span>
              </div>
              <div className="flex items-center gap-2">
                {checkState === "running" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : modelAccessible ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                ) : (
                  <XCircle className="h-3 w-3 text-destructive" />
                )}
                <span>Model access test</span>
              </div>
              <div className="flex items-center gap-2">
                {checkState === "running" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : configSaved ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                ) : (
                  <XCircle className="h-3 w-3 text-destructive" />
                )}
                <span>Onboarding completion saved</span>
              </div>
            </div>

            {checkErrors.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-1">
                {checkErrors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className={cn("text-xs", checkState === "success" ? "text-emerald-600" : "text-muted-foreground")}>
                {checkState === "running" && "Running gateway checks..."}
                {checkState === "success" && "All checks passed. You're ready to go."}
                {checkState === "error" && "Some checks failed. Fix the issues and retry."}
                {checkState === "idle" && "Ready to validate your setup."}
              </p>
              <Button size="sm" variant="outline" onClick={() => void runHealthChecks()}>
                Retry checks
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-10 text-sm text-muted-foreground"
      >
        <p>
          Tip: Use <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Cmd+K</kbd> to quickly access commands
        </p>
      </motion.div>
    </div>
  );
}

export default SuccessStep;
