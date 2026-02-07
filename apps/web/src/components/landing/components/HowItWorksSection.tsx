import { useState } from "react";
import { LandingSection } from "./LandingSection";
import { LandingSectionHeader } from "./LandingSectionHeader";
import { LandingCard } from "./LandingCard";
import { Link2, ShieldCheck, Send, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepCard {
  icon: React.ElementType;
  title: string;
  description: string;
  advanced: {
    label: string;
    items: string[];
  };
}

const STEPS: StepCard[] = [
  {
    icon: Link2,
    title: "Connect",
    description:
      "Link the places you already work — files, messages, tools.",
    advanced: {
      label: "Integrations and scopes",
      items: [
        "Google Workspace, Slack, GitHub, and more",
        "Fine-grained credential scopes",
        "Per-integration enable/disable",
      ],
    },
  },
  {
    icon: ShieldCheck,
    title: "Set guardrails",
    description:
      "Choose what needs approval and what can run automatically.",
    advanced: {
      label: "Rule examples and presets",
      items: [
        "Conservative, Standard, or Autopilot presets",
        "Custom rules per action type",
        "Category-based approval groups",
      ],
    },
  },
  {
    icon: Send,
    title: "Review and ship",
    description:
      "Get drafts and decisions ready to send, publish, or schedule.",
    advanced: {
      label: "Approvals and audit",
      items: [
        "Centralized approvals inbox",
        "Full audit trail for every action",
        "One-click approve, edit, or reject",
      ],
    },
  },
];

/** "How it works" section with 3-step cards and progressive disclosure. */
export function HowItWorksSection() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <LandingSection id="how-it-works" alternate>
      <LandingSectionHeader
        label="How it works"
        headline="Three steps to useful automation"
        subhead="Set up once, benefit continuously. Each step takes minutes."
      />

      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6"
        data-reveal-stagger=""
      >
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isExpanded = expanded === i;

          return (
            <LandingCard
              key={step.title}
              variant="elevated"
              className="flex flex-col gap-4"
              data-reveal=""
            >
              <div
                style={{ "--reveal-index": i } as React.CSSProperties}
              />
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Step {i + 1}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>

              {/* Progressive disclosure */}
              <button
                className="mt-auto flex items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                onClick={() => setExpanded(isExpanded ? null : i)}
                aria-expanded={isExpanded}
              >
                See advanced options
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform duration-200",
                    isExpanded && "rotate-180"
                  )}
                />
              </button>

              <div
                className={cn(
                  "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
                  isExpanded
                    ? "max-h-48 opacity-100"
                    : "max-h-0 opacity-0"
                )}
                role="region"
                aria-hidden={!isExpanded}
              >
                <div className="border-t border-border pt-3 mt-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {step.advanced.label}
                  </span>
                  <ul className="mt-2 space-y-1.5">
                    {step.advanced.items.map((item) => (
                      <li
                        key={item}
                        className="text-xs text-muted-foreground flex items-start gap-2"
                      >
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary/50" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </LandingCard>
          );
        })}
      </div>
    </LandingSection>
  );
}
