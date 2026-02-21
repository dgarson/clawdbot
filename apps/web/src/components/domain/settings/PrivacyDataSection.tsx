"use client";

import { Shield } from "lucide-react";

import { ComingSoonSection } from "./ComingSoonSection";

interface PrivacyDataSectionProps {
  className?: string;
}

export function PrivacyDataSection({ className }: PrivacyDataSectionProps) {
  return (
    <ComingSoonSection
      title="Privacy & Data"
      description="Manage your data and privacy settings."
      icon={Shield}
      features={[
        "Control agent memory and context retention",
        "Set how long memories are kept",
        "Export all your data",
        "Clear memories or delete your account",
      ]}
      className={className}
    />
  );
}

export default PrivacyDataSection;
