import * as React from "react";
import { usePersonaStore, type PersonaTier } from "@/stores/usePersonaStore";

const TIER_ORDER: PersonaTier[] = ["casual", "engaged", "expert"];

interface FeatureGateProps {
  minTier: PersonaTier;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({ minTier, children, fallback = null }: FeatureGateProps) {
  const { tier } = usePersonaStore();
  const currentIndex = TIER_ORDER.indexOf(tier);
  const requiredIndex = TIER_ORDER.indexOf(minTier);
  if (currentIndex >= requiredIndex) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}
