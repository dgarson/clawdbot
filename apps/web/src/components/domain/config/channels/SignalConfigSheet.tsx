"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Shield, AlertTriangle, ExternalLink, ChevronRight, CheckCircle2 } from "lucide-react";

import { showSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SignalIcon } from "./icons";
import type { SignalConfig } from "./types";

type SetupStep = "phone" | "verification" | "complete";

interface SignalConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: SignalConfig;
  onSave: (config: SignalConfig) => Promise<void>;
  onDisconnect?: () => Promise<void>;
  isConnected?: boolean;
}

export function SignalConfigSheet({
  open,
  onOpenChange,
  config,
  onSave,
  onDisconnect,
  isConnected,
}: SignalConfigSheetProps) {
  const [phoneNumber, setPhoneNumber] = React.useState(config?.phoneNumber ?? "");
  const [baseUrl, setBaseUrl] = React.useState(config?.baseUrl ?? "");
  const [deviceName, setDeviceName] = React.useState(config?.deviceName ?? "");
  const [verificationCode, setVerificationCode] = React.useState("");
  const [currentStep, setCurrentStep] = React.useState<SetupStep>("phone");
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [isRequestingCode, setIsRequestingCode] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setPhoneNumber(config?.phoneNumber ?? "");
      setBaseUrl(config?.baseUrl ?? "");
      setDeviceName(config?.deviceName ?? "");
      setVerificationCode("");
      setCurrentStep(isConnected ? "complete" : "phone");
    }
  }, [open, config, isConnected]);

  const handleRequestVerification = async () => {
    if (!phoneNumber.trim()) {return;}
    setIsRequestingCode(true);
    try {
      // In real implementation, this would trigger SMS/voice verification
      // Simulating the API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCurrentStep("verification");
    } finally {
      setIsRequestingCode(false);
    }
  };

  const handleVerifyAndSave = async () => {
    if (!verificationCode.trim()) {return;}
    setIsSaving(true);
    try {
      await onSave({
        phoneNumber: phoneNumber.trim(),
        baseUrl: baseUrl.trim() || undefined,
        deviceName: deviceName.trim() || undefined,
      });
      setCurrentStep("complete");
      showSuccess("Signal connected successfully");
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: "#3A76F020" }}
            >
              <SignalIcon className="h-5 w-5" style={{ color: "#3A76F0" }} />
            </div>
            <div className="flex items-center gap-2">
              <div>
                <DialogTitle>Signal</DialogTitle>
                <DialogDescription>Secure messaging setup</DialogDescription>
              </div>
              <Badge variant="secondary" className="ml-2">
                <Shield className="mr-1 h-3 w-3" />
                Advanced
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-6 space-y-4">
          {/* Warning banner */}
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning">Advanced Setup Required</p>
                <p className="text-muted-foreground mt-1">
                  Signal requires a dedicated phone number and signal-cli to be installed on the gateway host.
                </p>
                <a
                  href="https://docs.clawdbrain.bot/channels/signal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1 mt-1"
                >
                  Read the setup guide
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {currentStep === "complete" || isConnected ? (
              /* Connected state */
              <motion.div
                key="complete"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Connected as</p>
                    <p className="text-xl font-semibold">{config?.phoneNumber || phoneNumber}</p>
                  </div>
                </div>
              </motion.div>
            ) : currentStep === "verification" ? (
              /* Verification code step */
              <motion.div
                key="verification"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="rounded-lg border border-border bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground">
                    A verification code has been sent to <span className="font-medium text-foreground">{phoneNumber}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signal-code">Verification Code</Label>
                  <Input
                    id="signal-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                    className="text-center text-2xl tracking-widest"
                    maxLength={6}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the 6-digit code from Signal
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep("phone")}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleVerifyAndSave}
                    disabled={isSaving || verificationCode.length < 6}
                    className="flex-1"
                  >
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify
                  </Button>
                </div>
              </motion.div>
            ) : (
              /* Phone number step */
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="signal-phone">Phone Number</Label>
                  <div className="flex gap-2">
                    <Input
                      id="signal-phone"
                      type="tel"
                      placeholder="+1 234 567 8900"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter the phone number with country code (e.g., +1 for US)
                  </p>
                </div>

                <Button
                  onClick={handleRequestVerification}
                  disabled={isRequestingCode || !phoneNumber.trim()}
                  className="w-full"
                >
                  {isRequestingCode ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronRight className="mr-2 h-4 w-4" />
                  )}
                  Request Verification Code
                </Button>

                <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-4">
                  <p className="text-sm font-medium">Advanced connection settings</p>
                  <div className="space-y-2">
                    <Label htmlFor="signal-base-url">signal-cli base URL (optional)</Label>
                    <Input
                      id="signal-base-url"
                      type="url"
                      placeholder="http://localhost:8080"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use this if your signal-cli daemon runs on a remote host.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signal-device-name">Device name (optional)</Label>
                    <Input
                      id="signal-device-name"
                      type="text"
                      placeholder="Clawdbrain gateway"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Prerequisites reminder */}
                <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                  <p className="text-sm font-medium">Prerequisites</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-start gap-2">
                      <span className="text-muted-foreground/60">-</span>
                      signal-cli installed on gateway host
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-muted-foreground/60">-</span>
                      Dedicated phone number (not used by another Signal account)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-muted-foreground/60">-</span>
                      Ability to receive SMS or voice calls
                    </li>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="mt-6 flex-row gap-2 sm:justify-between">
          {(isConnected || currentStep === "complete") && onDisconnect && (
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
            {isConnected || currentStep === "complete" ? "Close" : "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
