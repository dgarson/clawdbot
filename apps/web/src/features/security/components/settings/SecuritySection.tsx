"use client";

import { cn } from "@/lib/utils";
import { LockSettings } from "./LockSettings";
import { TwoFactorSettings } from "./TwoFactorSettings";
import { UnlockHistoryList } from "./UnlockHistoryList";

interface SecuritySectionProps {
  className?: string;
}

/**
 * Main security settings section.
 * Contains lock settings, 2FA, and unlock history.
 */
export function SecuritySection({ className }: SecuritySectionProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <LockSettings />
      <TwoFactorSettings />
      <UnlockHistoryList />
    </div>
  );
}

export default SecuritySection;
