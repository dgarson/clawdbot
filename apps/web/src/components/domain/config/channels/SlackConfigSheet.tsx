"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ExternalLink, CheckCircle2, Hash, KeyRound, ShieldCheck } from "lucide-react";

import { slackBotTokenSchema } from "@/lib/validation";
import { showSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WizardSteps } from "@/components/composed/WizardSteps";
import { useFieldValidation } from "@/hooks/useFieldValidation";
import { SlackIcon } from "./icons";
import type { SlackConfig } from "./types";

type OAuthStatus = "idle" | "redirecting" | "connected" | "error";

type SlackAuthMode = "oauth" | "token";

interface SlackConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: SlackConfig;
  onConnect: () => Promise<void>;
  onSaveTokenConfig?: (config: SlackConfig) => Promise<void>;
  onDisconnect?: () => Promise<void>;
  isConnected?: boolean;
}

export function SlackConfigSheet({
  open,
  onOpenChange,
  config,
  onConnect,
  onSaveTokenConfig,
  onDisconnect,
  isConnected,
}: SlackConfigSheetProps) {
  const [oauthStatus, setOauthStatus] = React.useState<OAuthStatus>("idle");
  const [authMode, setAuthMode] = React.useState<SlackAuthMode>(config?.mode ?? "oauth");
  const [botToken, setBotToken] = React.useState(config?.botToken ?? "");
  const [appToken, setAppToken] = React.useState(config?.appToken ?? "");
  const [signingSecret, setSigningSecret] = React.useState(config?.signingSecret ?? "");
  const [defaultChannel, setDefaultChannel] = React.useState(config?.defaultChannel ?? "");
  const [allowChannels, setAllowChannels] = React.useState(
    config?.allowChannels ? config.allowChannels.join("\n") : ""
  );
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const tokenValidation = useFieldValidation(slackBotTokenSchema, botToken, {
    debounceMs: 300,
    skipEmpty: true,
  });

  React.useEffect(() => {
    if (open) {
      setOauthStatus("idle");
      setAuthMode(config?.mode ?? "oauth");
      setBotToken(config?.botToken ?? "");
      setAppToken(config?.appToken ?? "");
      setSigningSecret(config?.signingSecret ?? "");
      setDefaultChannel(config?.defaultChannel ?? "");
      setAllowChannels(config?.allowChannels ? config.allowChannels.join("\n") : "");
      setCurrentStep(0);
    }
  }, [open, config]);

  const steps = ["Method", "Access", "Behavior", "Review"];
  const isReviewStep = currentStep === steps.length - 1;
  const oauthReady = isConnected || oauthStatus === "connected";
  const canProceedFromAccess =
    authMode === "oauth"
      ? oauthReady
      : !!botToken.trim() && tokenValidation.isValid;

  const handleConnectOAuth = async () => {
    setOauthStatus("redirecting");
    try {
      await onConnect();
    } catch {
      setOauthStatus("error");
    }
  };

  const handleSaveTokens = async () => {
    if (!onSaveTokenConfig) {return;}
    setIsSaving(true);
    try {
      await onSaveTokenConfig({
        mode: "token",
        botToken: botToken.trim(),
        appToken: appToken.trim() || undefined,
        signingSecret: signingSecret.trim() || undefined,
        defaultChannel: defaultChannel.trim() || undefined,
        allowChannels: allowChannels
          .split(/[,\r\n]/)
          .map((value) => value.trim())
          .filter(Boolean),
      });
      showSuccess("Slack token configuration saved");
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!onDisconnect) {return;}
    setIsDisconnecting(true);
    try {
      await onDisconnect();
      onOpenChange(false);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const renderOAuthAccess = () => {
    if (isConnected && config?.workspaceName) {
      return (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Connected to</p>
              <p className="text-xl font-semibold">{config.workspaceName}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <div className="flex gap-2">
              <Hash className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Add the bot to channels where you want it to respond. Mention @Clawdbrain or DM the bot directly.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (oauthStatus === "redirecting") {
      return (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[#4A154B]/10">
              <SlackIcon className="h-10 w-10" />
            </div>
            <motion.div
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-background border-2 border-border"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </div>
          <div className="text-center space-y-1">
            <p className="font-medium">Redirecting to Slack...</p>
            <p className="text-sm text-muted-foreground">
              Complete the authorization in the Slack window
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOauthStatus("idle")}
            className="mt-2"
          >
            Cancel
          </Button>
        </div>
      );
    }

    if (oauthStatus === "error") {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive font-medium">
              Failed to connect to Slack
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Please try again or check your network connection.
            </p>
          </div>
          <Button onClick={handleConnectOAuth} className="w-full">
            <ExternalLink className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[#4A154B]/10">
            <SlackIcon className="h-10 w-10" />
          </div>
          <div className="text-center space-y-2 max-w-[280px]">
            <p className="font-medium">Connect Your Workspace</p>
            <p className="text-sm text-muted-foreground">
              Connect your Slack workspace to send and receive messages through Slack.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
          <p className="text-sm font-medium">What happens next:</p>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-primary">1.</span>
              You will be redirected to Slack
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">2.</span>
              Select the workspace to connect
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">3.</span>
              Authorize Clawdbrain to access your workspace
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">4.</span>
              You will be redirected back here
            </li>
          </ul>
        </div>

        <Button
          onClick={handleConnectOAuth}
          className="w-full"
          style={{ backgroundColor: "#4A154B" }}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Connect with Slack
        </Button>
        <Button
          variant="outline"
          onClick={() => setOauthStatus("connected")}
          className="w-full"
        >
          I completed authorization
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: "#4A154B20" }}
            >
              <SlackIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Slack</DialogTitle>
              <DialogDescription>Connect your Slack workspace</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          <WizardSteps steps={steps} currentStep={currentStep} onStepChange={setCurrentStep} />

          {currentStep === 0 && (
            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => setAuthMode("oauth")}
                className={
                  authMode === "oauth"
                    ? "rounded-lg border border-primary/60 bg-primary/5 p-3 text-left"
                    : "rounded-lg border border-border p-3 text-left hover:border-primary/30"
                }
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Slack OAuth</p>
                    <p className="text-xs text-muted-foreground">Install the app and manage scopes per workspace.</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("token")}
                className={
                  authMode === "token"
                    ? "rounded-lg border border-primary/60 bg-primary/5 p-3 text-left"
                    : "rounded-lg border border-border p-3 text-left hover:border-primary/30"
                }
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                    <KeyRound className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Bot + App Tokens</p>
                    <p className="text-xs text-muted-foreground">Use Socket Mode or internal apps with direct tokens.</p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {currentStep === 1 && (
            <AnimatePresence mode="wait">
              {authMode === "oauth" ? (
                <motion.div
                  key="oauth"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {renderOAuthAccess()}
                </motion.div>
              ) : (
                <motion.div
                  key="token"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="slack-bot-token">Bot Token</Label>
                    <Input
                      id="slack-bot-token"
                      type="password"
                      placeholder="xoxb-123456789-abc"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                    />
                    {!tokenValidation.isValid && botToken.trim() && (
                      <p className="text-xs text-destructive">{tokenValidation.error}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slack-app-token">App Token (Socket Mode)</Label>
                    <Input
                      id="slack-app-token"
                      type="password"
                      placeholder="xapp-123456789-abc"
                      value={appToken}
                      onChange={(e) => setAppToken(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. Required for Socket Mode with Events API.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slack-signing">Signing Secret (optional)</Label>
                    <Input
                      id="slack-signing"
                      type="password"
                      placeholder="Signing secret"
                      value={signingSecret}
                      onChange={(e) => setSigningSecret(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="slack-default-channel">Default channel (optional)</Label>
                <Input
                  id="slack-default-channel"
                  type="text"
                  placeholder="#operations or C012ABCDEF"
                  value={defaultChannel}
                  onChange={(e) => setDefaultChannel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slack-allowlist">Allowed channels (optional)</Label>
                <Textarea
                  id="slack-allowlist"
                  rows={4}
                  placeholder="#support\n#eng-updates"
                  value={allowChannels}
                  onChange={(e) => setAllowChannels(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Limit which channels the bot can read and respond to.
                </p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Auth mode</span>
                <span className="font-medium">{authMode === "oauth" ? "OAuth" : "Tokens"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Default channel</span>
                <span className="font-medium">{defaultChannel || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Allowlist</span>
                <span className="font-medium">{allowChannels.trim() ? "Configured" : "All channels"}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 flex-row gap-2 sm:justify-between">
          {isConnected && onDisconnect && (
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting || isSaving}
            >
              {isDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disconnect
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {currentStep > 0 && (
            <Button variant="outline" onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}>
              Back
            </Button>
          )}
          {isReviewStep ? (
            authMode === "token" ? (
              <Button
                onClick={handleSaveTokens}
                disabled={isSaving || !botToken.trim() || !tokenValidation.isValid}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isConnected ? "Update" : "Connect"}
              </Button>
            ) : (
              <Button onClick={() => onOpenChange(false)} disabled={!oauthReady}>
                Finish
              </Button>
            )
          ) : (
            <Button
              onClick={() => setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))}
              disabled={currentStep === 1 && !canProceedFromAccess}
            >
              Next
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
