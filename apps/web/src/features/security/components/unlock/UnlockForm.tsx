"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { unlockParamsSchema, type UnlockParams } from "../../lib/security-schemas";
import { useUnlock } from "../../hooks/useSecurityMutations";
import type { UnlockFailureReason } from "../../types";

interface UnlockFormProps {
  /** Callback when unlock succeeds */
  onSuccess?: () => void;
  /** Whether 2FA is required */
  requires2fa?: boolean;
  /** Callback when user needs to enter 2FA */
  onRequires2fa?: () => void;
}

/**
 * Password unlock form.
 * Handles password entry and initial unlock attempt.
 */
export function UnlockForm({
  onSuccess,
  onRequires2fa,
}: UnlockFormProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [failureMessage, setFailureMessage] = React.useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = React.useState<number | null>(null);

  const unlockMutation = useUnlock();

  const form = useForm<UnlockParams>({
    resolver: zodResolver(unlockParamsSchema),
    defaultValues: {
      password: "",
    },
  });

  const onSubmit = async (data: UnlockParams) => {
    setFailureMessage(null);

    try {
      const result = await unlockMutation.mutateAsync(data);

      if (result.success) {
        onSuccess?.();
        return;
      }

      if (result.requires2fa) {
        onRequires2fa?.();
        return;
      }

      // Handle failure
      setAttemptsRemaining(result.attemptsRemaining ?? null);
      setFailureMessage(getFailureMessage(result.failureReason));
      form.setValue("password", "");
    } catch {
      setFailureMessage("An error occurred. Please try again.");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <Label htmlFor="password" className="sr-only">
                Password
              </Label>
              <FormControl>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    autoFocus
                    className="pl-10 pr-10"
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
                    <span className="sr-only">
                      {showPassword ? "Hide password" : "Show password"}
                    </span>
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {failureMessage && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {failureMessage}
            {attemptsRemaining !== null && attemptsRemaining > 0 && (
              <span className="block mt-1 text-xs">
                {attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining
              </span>
            )}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={unlockMutation.isPending}
        >
          {unlockMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Unlocking...
            </>
          ) : (
            "Unlock"
          )}
        </Button>
      </form>
    </Form>
  );
}

function getFailureMessage(reason?: UnlockFailureReason): string {
  switch (reason) {
    case "wrong_password":
      return "Incorrect password. Please try again.";
    case "wrong_2fa":
      return "Incorrect verification code. Please try again.";
    case "invalid_recovery_code":
      return "Invalid recovery code. Please try again.";
    case "locked_out":
      return "Too many failed attempts. Please try again later.";
    case "session_expired":
      return "Your session has expired. Please unlock again.";
    default:
      return "Unlock failed. Please try again.";
  }
}

export default UnlockForm;
