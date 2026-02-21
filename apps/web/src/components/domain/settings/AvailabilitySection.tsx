"use client";

import { Clock } from "lucide-react";

import { ComingSoonSection } from "./ComingSoonSection";

interface AvailabilitySectionProps {
  className?: string;
}

export function AvailabilitySection({ className }: AvailabilitySectionProps) {
  return (
    <ComingSoonSection
      title="Availability & Quiet Hours"
      description="Control when and how agents can reach you."
      icon={Clock}
      features={[
        "Set your availability status (Available, Busy, Away)",
        "Configure quiet hours to pause notifications",
        "Set your timezone for accurate scheduling",
        "Enable auto-reply when you're unavailable",
      ]}
      className={className}
    />
  );
}

export default AvailabilitySection;
