import { useState } from "react";
import { LandingSection } from "./LandingSection";
import { LandingSectionHeader } from "./LandingSectionHeader";
import { DeliverablePreviewCard } from "./DeliverablePreviewCard";
import { LandingButton } from "./LandingButton";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Example {
  title: string;
  status: "done" | "waiting";
  statusLabel: string;
  metadata: string;
  sections: { heading: string; bullets: string[] }[];
  explanation: string;
}

const EXAMPLES: Example[] = [
  {
    title: "Competitive summary",
    status: "done",
    statusLabel: "Ready for review",
    metadata: "Sources reviewed: 47  ·  Last updated 4 min ago",
    sections: [
      {
        heading: "Positioning",
        bullets: [
          "Three direct competitors launched similar features this quarter",
          "Key differentiator: integration depth and approval controls",
        ],
      },
      {
        heading: "Recommended next steps",
        bullets: [
          "Prioritize integration depth as differentiator",
          "Schedule stakeholder review before Thursday",
        ],
      },
    ],
    explanation:
      "This was created by the research agent, which reviewed 47 sources, extracted key themes, and structured findings using your preferred format (bullet summary). It ran for 12 minutes while you were in a meeting.",
  },
  {
    title: "Draft ready to send",
    status: "waiting",
    statusLabel: "Approval required",
    metadata: "Recipient: stakeholder group  ·  3 tone options",
    sections: [
      {
        heading: "Subject line options",
        bullets: [
          "Q1 update: progress, priorities, and next steps",
          "Weekly sync: here is where we stand",
        ],
      },
      {
        heading: "Why this wording",
        bullets: [
          "Matches your preferred tone (concise, direct)",
          "Follows the structure from your last 5 similar emails",
        ],
      },
    ],
    explanation:
      "The drafting agent prepared this based on your recent activity, past email patterns, and the context from your current workstream. It is waiting for your approval before sending.",
  },
  {
    title: "Weekly status brief",
    status: "done",
    statusLabel: "Ready for review",
    metadata: "Covers: Mon–Fri  ·  Auto-updated daily",
    sections: [
      {
        heading: "What changed",
        bullets: [
          "Design review completed ahead of schedule",
          "API integration moved to testing phase",
        ],
      },
      {
        heading: "Needs a decision",
        bullets: [
          "Feature scope for v2 launch — expand or hold?",
          "Budget allocation for Q2 tooling",
        ],
      },
    ],
    explanation:
      "The status agent aggregated updates from your connected tools (project tracker, code repository, messaging channels) and summarized them using your preferred weekly format.",
  },
];

/** Example deliverables section with expandable explanations. */
export function ExamplesSection() {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <LandingSection id="examples" belowFold>
      <LandingSectionHeader
        label="Examples"
        headline="Real deliverables, not lorem ipsum"
        subhead="Each example shows work the system can produce — structured, sourced, and ready for review."
      />

      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6"
        data-reveal-stagger=""
      >
        {EXAMPLES.map((ex, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <div
              key={ex.title}
              className="flex flex-col"
              style={{ "--reveal-index": i } as React.CSSProperties}
              data-reveal=""
            >
              <DeliverablePreviewCard
                title={ex.title}
                status={ex.status}
                statusLabel={ex.statusLabel}
                metadata={ex.metadata}
                sections={ex.sections}
                actions={
                  <LandingButton variant="ghost" size="sm" asChild>
                    <a href="/">Open Console</a>
                  </LandingButton>
                }
                className="flex-1"
              />

              {/* Expandable explanation */}
              <button
                className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 self-start"
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                aria-expanded={isExpanded}
              >
                See how this is made
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
                  isExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
                )}
                role="region"
                aria-hidden={!isExpanded}
              >
                <p className="text-xs text-muted-foreground leading-relaxed pt-2">
                  {ex.explanation}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </LandingSection>
  );
}
