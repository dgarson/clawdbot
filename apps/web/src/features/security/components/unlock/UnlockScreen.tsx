"use client";

import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSecurity } from "../../SecurityProvider";
import { UnlockForm } from "./UnlockForm";
import { TwoFactorVerify } from "../two-factor/TwoFactorVerify";

/**
 * Full-page unlock screen.
 * Shows password form, and 2FA form if enabled.
 */
export function UnlockScreen() {
  const navigate = useNavigate();
  const { state } = useSecurity();
  const [step, setStep] = React.useState<"password" | "2fa">("password");

  // If already unlocked, redirect to home
  React.useEffect(() => {
    if (state.isUnlocked) {
      navigate({ to: "/" });
    }
  }, [state.isUnlocked, navigate]);

  const handlePasswordSuccess = () => {
    // If 2FA is enabled, we'll get a requires2fa response
    // which triggers onRequires2fa callback
    navigate({ to: "/" });
  };

  const handleRequires2fa = () => {
    setStep("2fa");
  };

  const handle2faSuccess = () => {
    navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>
            {step === "password" ? "Welcome back" : "Verify your identity"}
          </CardTitle>
          <CardDescription>
            {step === "password"
              ? "Enter your password to unlock Clawdbrain"
              : "Enter the 6-digit code from your authenticator app"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "password" ? (
            <UnlockForm
              onSuccess={handlePasswordSuccess}
              requires2fa={state.twoFactorEnabled}
              onRequires2fa={handleRequires2fa}
            />
          ) : (
            <TwoFactorVerify onSuccess={handle2faSuccess} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default UnlockScreen;
