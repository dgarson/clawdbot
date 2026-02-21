"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft, Shield } from "lucide-react";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { setup2faParamsSchema, type Setup2faParams } from "../../lib/security-schemas";
import { useSetup2fa, useVerify2fa } from "../../hooks/useSecurityMutations";
import { QRCodeDisplay } from "./QRCodeDisplay";
import { TwoFactorInput, useTwoFactorInputReset } from "./TwoFactorInput";
import { RecoveryCodesDisplay } from "./RecoveryCodesDisplay";
import type { TwoFactorSetupData, RecoveryCodesData } from "../../types";

type WizardStep = "password" | "scan" | "verify" | "recovery";

interface TwoFactorSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * 4-step wizard for enabling 2FA:
 * 1. Enter password to confirm identity
 * 2. Scan QR code with authenticator app
 * 3. Verify with generated code
 * 4. Save recovery codes
 */
export function TwoFactorSetupWizard({
  open,
  onOpenChange,
  onSuccess,
}: TwoFactorSetupWizardProps) {
  const [step, setStep] = React.useState<WizardStep>("password");
  const [setupData, setSetupData] = React.useState<TwoFactorSetupData | null>(null);
  const [recoveryCodes, setRecoveryCodes] = React.useState<RecoveryCodesData | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);
  const { key: inputKey, reset: resetInput } = useTwoFactorInputReset();

  const setup2faMutation = useSetup2fa();
  const verify2faMutation = useVerify2fa();

  const form = useForm<Setup2faParams>({
    resolver: zodResolver(setup2faParamsSchema),
    defaultValues: {
      password: "",
    },
  });

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setStep("password");
      setSetupData(null);
      setRecoveryCodes(null);
      setVerifyError(null);
      form.reset();
    }
  }, [open, form]);

  const handlePasswordSubmit = async (data: Setup2faParams) => {
    try {
      const result = await setup2faMutation.mutateAsync(data);
      setSetupData(result.setupData);
      setStep("scan");
    } catch {
      // Error handled by mutation
    }
  };

  const handleVerifyCode = async (code: string) => {
    setVerifyError(null);

    try {
      const result = await verify2faMutation.mutateAsync({ code });

      if (result.success && result.recoveryCodes) {
        setRecoveryCodes(result.recoveryCodes);
        setStep("recovery");
      } else {
        setVerifyError("Invalid code. Please try again.");
        resetInput();
      }
    } catch {
      setVerifyError("Verification failed. Please try again.");
      resetInput();
    }
  };

  const handleComplete = () => {
    onOpenChange(false);
    onSuccess?.();
  };

  const stepIndex = ["password", "scan", "verify", "recovery"].indexOf(step);
  const progress = ((stepIndex + 1) / 4) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">
            {step === "password" && "Enable two-factor authentication"}
            {step === "scan" && "Scan QR code"}
            {step === "verify" && "Verify setup"}
            {step === "recovery" && "Save recovery codes"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === "password" && "Enter your password to continue"}
            {step === "scan" && "Scan with your authenticator app"}
            {step === "verify" && "Enter the code from your app"}
            {step === "recovery" && "Store these codes safely"}
          </DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="h-1" />

        <div className="py-4">
          {/* Step 1: Password */}
          {step === "password" && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <Label htmlFor="2fa-password">Password</Label>
                      <FormControl>
                        <div className="relative">
                          <Input
                            id="2fa-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            autoFocus
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2"
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={setup2faMutation.isPending}>
                    {setup2faMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}

          {/* Step 2: Scan QR */}
          {step === "scan" && setupData && (
            <div className="space-y-4">
              <QRCodeDisplay
                qrCodeDataUrl={setupData.qrCodeDataUrl}
                secret={setupData.secret}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("password")}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button type="button" onClick={() => setStep("verify")}>
                  I've scanned it
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 3: Verify */}
          {step === "verify" && (
            <div className="space-y-6">
              <p className="text-center text-sm text-muted-foreground">
                Enter the 6-digit code from your authenticator app
              </p>

              <TwoFactorInput
                key={inputKey}
                onComplete={handleVerifyCode}
                disabled={verify2faMutation.isPending}
                error={!!verifyError}
                autoFocus
              />

              {verify2faMutation.isPending && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </div>
              )}

              {verifyError && (
                <p className="text-center text-sm text-destructive">{verifyError}</p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("scan")}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 4: Recovery codes */}
          {step === "recovery" && recoveryCodes && (
            <RecoveryCodesDisplay
              codesData={recoveryCodes}
              onAcknowledge={handleComplete}
              requireAcknowledge
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TwoFactorSetupWizard;
