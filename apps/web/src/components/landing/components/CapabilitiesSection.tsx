import { LandingSection } from "./LandingSection";
import { LandingSectionHeader } from "./LandingSectionHeader";
import { LandingCard } from "./LandingCard";
import {
  Search,
  PenLine,
  ListChecks,
  Brain,
  Zap,
  Plug,
} from "lucide-react";

interface CapabilityTile {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
}

const CAPABILITIES: CapabilityTile[] = [
  {
    icon: Search,
    title: "Research and compare",
    description:
      "Get summaries with citations. Compare options side-by-side with clear recommendations.",
    href: "/",
  },
  {
    icon: PenLine,
    title: "Draft and refine",
    description:
      "Emails, proposals, posts, and PRDs — drafted in your voice, ready for review.",
    href: "/",
  },
  {
    icon: ListChecks,
    title: "Plan and break down work",
    description:
      "Tasks, milestones, and schedules created from a single description.",
    href: "/goals",
  },
  {
    icon: Brain,
    title: "Keep context",
    description:
      "Notes, memory, and decision history that grow smarter over time.",
    href: "/memories",
  },
  {
    icon: Zap,
    title: "Automate safe chores",
    description:
      "Status checks, reminders, and follow-ups that run on schedule.",
    href: "/automations",
  },
  {
    icon: Plug,
    title: "Integrate where you work",
    description:
      "Connect tools and channels you already use. No context switching.",
    href: "/settings",
  },
];

/** Bento grid showing outcome-oriented capabilities. */
export function CapabilitiesSection() {
  return (
    <LandingSection id="capabilities" alternate belowFold>
      <LandingSectionHeader
        label="Capabilities"
        headline="What it can do today"
        subhead="Each capability maps to a concrete outcome, not a feature checkbox."
      />

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
        data-reveal-stagger=""
      >
        {CAPABILITIES.map((cap, i) => {
          const Icon = cap.icon;
          return (
            <a
              key={cap.title}
              href={cap.href}
              className="group focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 rounded-xl"
              style={{ "--reveal-index": i } as React.CSSProperties}
              data-reveal=""
            >
              <LandingCard
                variant="standard"
                className="h-full flex flex-col gap-3 transition-colors duration-150 group-hover:border-primary/40"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {cap.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {cap.description}
                </p>
              </LandingCard>
            </a>
          );
        })}
      </div>
    </LandingSection>
  );
}
