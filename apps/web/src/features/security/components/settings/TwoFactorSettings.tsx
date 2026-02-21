"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Smartphone, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useSecurity } from "../../SecurityProvider";
import { useDisable2fa } from "../../hooks/useSecurityMutations";
import { TwoFactorSetupWizard } from "../two-factor/TwoFactorSetupWizard";
import { TwoFactorInput, useTwoFactorInputReset } from "../two-factor/TwoFactorInput";
import { disable2faParamsSchema } from "../../lib/security-schemas";

/**
 * Two-factor authentication settings card.
 * Enable/disable 2FA.
 */
export function TwoFactorSettings() {
  const { state } = useSecurity();
  const [showSetupWizard, setShowSetupWizard] = React.useState(false);
  const [showDisable, setShowDisable] = React.useState(false);

  // Can only enable 2FA if lock is enabled
  const canEnable2fa = state.lockEnabled;

  const handleToggle = (enabled: boolean) => {
    if (enabled && !state.twoFactorEnabled) {
      setShowSetupWizard(true);
    } else if (!enabled && state.twoFactorEnabled) {
      setShowDisable(true);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/disable toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label htmlFor="2fa-enabled">Authenticator app</Label>
                {state.twoFactorEnabled && (
                  <Badge variant="secondary" className="text-xs">
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    Enabled
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {state.twoFactorEnabled
                  ? "You'll need your authenticator app to unlock"
                  : "Use an authenticator app for additional security"}
              </p>
            </div>
            <Switch
              id="2fa-enabled"
              checked={state.twoFactorEnabled}
              onCheckedChange={handleToggle}
              disabled={!canEnable2fa && !state.twoFactorEnabled}
            />
          </div>

          {!canEnable2fa && !state.twoFactorEnabled && (
            <p className="text-sm text-muted-foreground">
              Enable app lock first to use two-factor authentication.
            </p>
          )}

          {state.twoFactorEnabled && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-green-500" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Two-factor authentication is active
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You will need to enter a code from your authenticator app
                    each time you unlock Clawdbrain.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TwoFactorSetupWizard
        open={showSetupWizard}
        onOpenChange={setShowSetupWizard}
      />

      <Disable2faDialog
        open={showDisable}
        onOpenChange={setShowDisable}
      />
    </>
  );
}

// =============================================================================
// Disable 2FA Dialog
// =============================================================================

function Disable2faDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const { key: inputKey, reset: resetInput } = useTwoFactorInputReset();

  const mutation = useDisable2fa();

  const form = useForm<{ password: string }>({
    resolver: zodResolver(disable2faParamsSchema.pick({ password: true })),
    defaultValues: {
      password: "",
    },
  });

  React.useEffect(() => {
    if (!open) {
      form.reset();
      setCodeError(null);
    }
  }, [open, form]);

  const handleCodeComplete = async (code: string) => {
    const currentPassword = form.getValues("password");
    if (!currentPassword) {
      form.setError("password", { message: "Password is required" });
      return;
    }

    setCodeError(null);

    try {
      await mutation.mutateAsync({ password: currentPassword, code });
      onOpenChange(false);
    } catch {
      setCodeError("Invalid code. Please try again.");
      resetInput();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldOff className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-center">Disable two-factor authentication</DialogTitle>
          <DialogDescription className="text-center">
            This will reduce your account security. Enter your password and a
            verification code to confirm.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <Label>Password</Label>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
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
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label>Verification code</Label>
              <TwoFactorInput
                key={inputKey}
                onComplete={handleCodeComplete}
                disabled={mutation.isPending}
                error={!!codeError}
              />
              {mutation.isPending && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Disabling...
                </div>
              )}
              {codeError && (
                <p className="text-center text-sm text-destructive">{codeError}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default TwoFactorSettings;
