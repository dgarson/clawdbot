"use client";

import { createFileRoute } from "@tanstack/react-router";
import { UnlockScreen } from "@/features/security/components/unlock/UnlockScreen";

export const Route = createFileRoute("/unlock/")({
  component: UnlockPage,
});

function UnlockPage() {
  return <UnlockScreen />;
}
