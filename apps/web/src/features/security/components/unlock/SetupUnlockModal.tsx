"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Shield, Check } from "lucide-react";
import { z } from "zod";
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
import { useSetupPassword } from "../../hooks/useSecurityMutations";

// Schema with password confirmation
const setupPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SetupPasswordFormData = z.infer<typeof setupPasswordSchema>;

interface SetupUnlockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Modal for initial password setup.
 * Shown to users who want to enable app lock.
 */
export function SetupUnlockModal({
  open,
  onOpenChange,
  onSuccess,
}: SetupUnlockModalProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const setupMutation = useSetupPassword();

  const form = useForm<SetupPasswordFormData>({
    resolver: zodResolver(setupPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: SetupPasswordFormData) => {
    try {
      await setupMutation.mutateAsync({ password: data.password });
      onOpenChange(false);
      form.reset();
      onSuccess?.();
    } catch {
      // Error handled by mutation
    }
  };

  const password = useWatch({ control: form.control, name: "password" });
  const passwordStrength = getPasswordStrength(password);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Set up app lock</DialogTitle>
          <DialogDescription className="text-center">
            Protect your Clawdbrain with a password. You'll need to enter this
            password to access the app.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="setup-password">Password</Label>
                  <FormControl>
                    <div className="relative">
                      <Input
                        id="setup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter a strong password"
                        autoComplete="new-password"
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
                  {password && (
                    <PasswordStrengthIndicator strength={passwordStrength} />
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <FormControl>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirm ? "text" : "password"}
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowConfirm(!showConfirm)}
                        tabIndex={-1}
                      >
                        {showConfirm ? (
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

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={setupMutation.isPending}>
                {setupMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Enable app lock
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Password strength types
type PasswordStrength = "weak" | "fair" | "good" | "strong";

function getPasswordStrength(password: string): PasswordStrength {
  if (!password || password.length < 8) {return "weak";}

  let score = 0;

  // Length bonus
  if (password.length >= 12) {score += 1;}
  if (password.length >= 16) {score += 1;}

  // Character variety
  if (/[a-z]/.test(password)) {score += 1;}
  if (/[A-Z]/.test(password)) {score += 1;}
  if (/[0-9]/.test(password)) {score += 1;}
  if (/[^a-zA-Z0-9]/.test(password)) {score += 1;}

  if (score <= 2) {return "weak";}
  if (score <= 4) {return "fair";}
  if (score <= 5) {return "good";}
  return "strong";
}

function PasswordStrengthIndicator({ strength }: { strength: PasswordStrength }) {
  const config = {
    weak: { label: "Weak", color: "bg-destructive", width: "w-1/4" },
    fair: { label: "Fair", color: "bg-yellow-500", width: "w-2/4" },
    good: { label: "Good", color: "bg-blue-500", width: "w-3/4" },
    strong: { label: "Strong", color: "bg-green-500", width: "w-full" },
  };

  const { label, color, width } = config[strength];

  return (
    <div className="space-y-1">
      <div className="h-1 w-full rounded-full bg-muted">
        <div
          className={`h-1 rounded-full transition-all ${color} ${width}`}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Password strength: <span className="font-medium">{label}</span>
      </p>
    </div>
  );
}

export default SetupUnlockModal;
