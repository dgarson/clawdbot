import { LandingSection } from "./LandingSection";
import { LandingSectionHeader } from "./LandingSectionHeader";
import { LandingCard } from "./LandingCard";
import { StatusChip } from "./StatusChip";

interface TimelineEntry {
  time: string;
  title: string;
  status: "done" | "in-progress" | "waiting";
  statusLabel: string;
}

const TIMELINE: TimelineEntry[] = [
  {
    time: "9:15 AM",
    title: "Competitor pricing research completed",
    status: "done",
    statusLabel: "Done",
  },
  {
    time: "10:02 AM",
    title: "Weekly status brief drafted",
    status: "done",
    statusLabel: "Done",
  },
  {
    time: "10:45 AM",
    title: "Stakeholder email being refined",
    status: "in-progress",
    statusLabel: "In progress",
  },
  {
    time: "11:00 AM",
    title: "Budget proposal requires your approval",
    status: "waiting",
    statusLabel: "Waiting for you",
  },
];

/** Section demonstrating continuous background work with a timeline mock. */
export function AlwaysOnSection() {
  return (
    <LandingSection alternate belowFold>
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
        {/* Timeline mock (on left for visual variety) */}
        <div data-reveal="">
          <LandingCard variant="elevated" className="max-w-md mx-auto lg:mx-0">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Activity today
            </div>
            <div className="space-y-0">
              {TIMELINE.map((entry, i) => (
                <div
                  key={entry.time}
                  className="flex gap-3 py-3 border-b border-border/50 last:border-b-0"
                >
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center pt-1">
                    <div className="h-2 w-2 rounded-full bg-border" />
                    {i < TIMELINE.length - 1 && (
                      <div className="w-px flex-1 bg-border/50 mt-1" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-xs text-muted-foreground">
                        {entry.time}
                      </span>
                      <StatusChip
                        variant={entry.status}
                        label={entry.statusLabel}
                      />
                    </div>
                    <p className="text-sm text-foreground">{entry.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </LandingCard>
        </div>

        {/* Copy */}
        <div data-reveal="">
          <LandingSectionHeader
            headline="It keeps the work moving"
            subhead="Research, drafts, and next steps arrive ready for your review. One item is always waiting for you — because you are always in control."
            align="left"
          />
          <a
            href="/"
            className="text-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            View activity history
          </a>
        </div>
      </div>
    </LandingSection>
  );
}
