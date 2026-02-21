"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TwoFactorInput, useTwoFactorInputReset } from "./TwoFactorInput";
import { useUnlock } from "../../hooks/useSecurityMutations";

interface TwoFactorVerifyProps {
  /** Password already verified (passed along with 2FA) */
  password?: string;
  /** Callback when verification succeeds */
  onSuccess?: () => void;
  /** Show recovery code option */
  showRecoveryOption?: boolean;
  /** Callback when user wants to use recovery code */
  onUseRecoveryCode?: () => void;
}

/**
 * 2FA verification form for unlock flow.
 * Shows 6-digit code input with auto-submit.
 */
export function TwoFactorVerify({
  password = "",
  onSuccess,
  showRecoveryOption = true,
  onUseRecoveryCode,
}: TwoFactorVerifyProps) {
  const [error, setError] = React.useState<string | null>(null);
  const { key, reset } = useTwoFactorInputReset();

  const unlockMutation = useUnlock();

  const handleComplete = async (code: string) => {
    setError(null);

    try {
      const result = await unlockMutation.mutateAsync({
        password,
        totpCode: code,
      });

      if (result.success) {
        onSuccess?.();
      } else {
        setError("Invalid code. Please try again.");
        reset();
      }
    } catch {
      setError("Verification failed. Please try again.");
      reset();
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <TwoFactorInput
          key={key}
          onComplete={handleComplete}
          disabled={unlockMutation.isPending}
          error={!!error}
          autoFocus
        />

        {unlockMutation.isPending && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying...
          </div>
        )}

        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}
      </div>

      {showRecoveryOption && (
        <div className="text-center">
          <Button
            type="button"
            variant="link"
            className="text-sm"
            onClick={onUseRecoveryCode}
          >
            Lost access to your authenticator? Use a recovery code
          </Button>
        </div>
      )}
    </div>
  );
}

export default TwoFactorVerify;
