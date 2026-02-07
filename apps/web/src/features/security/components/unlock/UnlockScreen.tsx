"use client";

import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Shield, Lock, Clock, Pause, ArrowRight, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSecurity } from "../../SecurityProvider";
import { useGatewayConnection, useGatewayUrl } from "@/hooks/useGatewayConnection";
import { UnlockForm } from "./UnlockForm";
import { TwoFactorVerify } from "../two-factor/TwoFactorVerify";
import {
  StepIndicator,
  type UnlockStep,
} from "./StepIndicator";
import {
  ConnectionStep,
  type ConnectionStatus,
} from "./ConnectionStep";

const TRUST_BULLETS = [
  { icon: Lock, text: "Approval gates for sensitive actions" },
  { icon: Clock, text: "A clear history of what happened and why" },
  { icon: Pause, text: "Pause or stop automation at any time" },
] as const;

/**
 * Console Access screen (/unlock).
 *
 * 2-column layout on desktop:
 *   Left: education + trust messaging
 *   Right: stepper flow (Connect -> Unlock -> Enter)
 *
 * Mobile: stacked with action first.
 */
export function UnlockScreen() {
  const navigate = useNavigate();
  const { state } = useSecurity();
  const [authStep, setAuthStep] = React.useState<"password" | "2fa">("password");

  const gatewayUrl = useGatewayUrl();
  const gateway = useGatewayConnection({ autoConnect: true });

  // Derive which high-level step we're on
  const isConnected = gateway.isConnected;
  const currentStep: UnlockStep = !isConnected
    ? "connect"
    : state.isUnlocked
      ? "enter"
      : "unlock";

  // Map gateway state to ConnectionStatus
  const connectionStatus: ConnectionStatus = gateway.isConnected
    ? "connected"
    : gateway.isConnecting
      ? "connecting"
      : gateway.state.status === "error"
        ? "error"
        : "disconnected";

  // If already unlocked, redirect to home
  React.useEffect(() => {
    if (state.isUnlocked) {
      navigate({ to: "/" });
    }
  }, [state.isUnlocked, navigate]);

  const handlePasswordSuccess = () => {
    navigate({ to: "/" });
  };

  const handleRequires2fa = () => {
    setAuthStep("2fa");
  };

  const handle2faSuccess = () => {
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile: action first; Desktop: 2-column */}
      <div className="flex w-full flex-col-reverse md:flex-row">
        {/* Left column - education + trust (desktop) / bottom (mobile) */}
        <div className="flex flex-col justify-center px-6 py-10 md:w-5/12 md:px-10 lg:px-16 md:py-0">
          <div className="mx-auto w-full max-w-md space-y-8">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                S
              </div>
              <span className="text-lg font-semibold text-foreground">
                Clawdbrain
              </span>
            </div>

            {/* Headline */}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Open your console
              </h1>
              <p className="mt-2 text-muted-foreground">
                Connect, unlock, and pick up where you left off -- without
                losing control of what runs.
              </p>
            </div>

            {/* Trust bullets */}
            <div className="space-y-3">
              {TRUST_BULLETS.map((bullet) => (
                <div key={bullet.text} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <bullet.icon className="size-3.5 text-primary" />
                  </div>
                  <span className="text-sm text-foreground">{bullet.text}</span>
                </div>
              ))}
            </div>

            {/* Secondary links */}
            <div className="flex flex-col gap-2 text-sm">
              <Link
                to="/landing"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                See the product tour
                <ExternalLink className="size-3" />
              </Link>
              <Link
                to="/onboarding"
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                New here? Start with guided setup
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right column - action (desktop) / top (mobile) */}
        <div className="flex flex-1 flex-col items-center justify-center bg-muted/30 px-6 py-10 md:px-10 lg:px-16">
          <div className="mx-auto w-full max-w-md space-y-6">
            {/* Stepper */}
            <StepIndicator currentStep={currentStep} />

            {/* Connection step card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="size-4 text-primary" />
                  {currentStep === "connect" && "Connect to Gateway"}
                  {currentStep === "unlock" && "Unlock your console"}
                  {currentStep === "enter" && "Welcome back"}
                </CardTitle>
                <CardDescription>
                  {currentStep === "connect" &&
                    "Establish a connection to your Clawdbrain Gateway."}
                  {currentStep === "unlock" &&
                    "Enter your password to access the console."}
                  {currentStep === "enter" &&
                    "You are connected and unlocked. Entering console..."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentStep === "connect" && (
                  <ConnectionStep
                    status={connectionStatus}
                    gatewayUrl={gatewayUrl}
                    onRetry={() => gateway.retryConnect()}
                    errorMessage={
                      gateway.state.status === "error"
                        ? (gateway.state as { error?: string }).error
                        : undefined
                    }
                  />
                )}

                {currentStep === "unlock" && (
                  <>
                    {authStep === "password" ? (
                      <UnlockForm
                        onSuccess={handlePasswordSuccess}
                        requires2fa={state.twoFactorEnabled}
                        onRequires2fa={handleRequires2fa}
                      />
                    ) : (
                      <TwoFactorVerify onSuccess={handle2faSuccess} />
                    )}
                  </>
                )}

                {currentStep === "enter" && (
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                      <Shield className="size-5 text-green-500" />
                    </div>
                    <Button asChild>
                      <Link to="/">
                        Enter Console
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick start CTA */}
            {currentStep !== "enter" && (
              <p className="text-center text-xs text-muted-foreground">
                Need help?{" "}
                <a
                  href="https://docs.clawdbrain.bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Read the docs
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UnlockScreen;
