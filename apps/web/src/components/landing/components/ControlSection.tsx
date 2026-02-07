import { LandingSection } from "./LandingSection";
import { LandingSectionHeader } from "./LandingSectionHeader";
import { LandingCard } from "./LandingCard";
import {
  Lock,
  Pause,
  FileText,
  ShieldCheck,
  MessageSquare,
  CreditCard,
} from "lucide-react";

const APPROVAL_GATES = [
  { icon: MessageSquare, label: "Send external messages" },
  { icon: CreditCard, label: "Financial actions" },
  { icon: FileText, label: "Publish or delete content" },
];

const ACTIVITY_LOG = [
  { time: "10:42 AM", action: "Drafted weekly summary", scope: "Internal only" },
  { time: "10:38 AM", action: "Reviewed 12 source documents", scope: "Read-only" },
  { time: "10:15 AM", action: "Created task breakdown", scope: "Internal only" },
];

/** Section demonstrating control, approvals, and audit capabilities. */
export function ControlSection() {
  return (
    <LandingSection id="safety" belowFold>
      <LandingSectionHeader
        label="Safety and control"
        headline="It can run on its own—without acting silently"
        subhead="Decide what requires approval. Pause automation instantly. Review what happened, when, and why."
      />

      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6"
        data-reveal-stagger=""
      >
        {/* Approval gates */}
        <LandingCard
          variant="elevated"
          className="flex flex-col gap-4"
          data-reveal=""
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Approval gates
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            These actions are blocked until you approve them.
          </p>
          <div className="space-y-2">
            {APPROVAL_GATES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2"
              >
                <Lock className="h-3 w-3 text-warning" />
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-foreground">{label}</span>
              </div>
            ))}
          </div>
        </LandingCard>

        {/* Pause/stop controls */}
        <LandingCard
          variant="elevated"
          className="flex flex-col gap-4"
          data-reveal=""
        >
          <div className="flex items-center gap-2">
            <Pause className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">
              Pause and stop
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            One toggle to pause all automation instantly.
          </p>

          {/* Mock toggle */}
          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-4 mt-auto">
            <div>
              <div className="text-sm font-medium text-foreground">
                Automation
              </div>
              <div className="text-xs text-muted-foreground">
                All agents and workflows
              </div>
            </div>
            {/* Visual-only toggle (not interactive) */}
            <div className="h-6 w-11 rounded-full bg-success/80 p-0.5" aria-hidden="true">
              <div className="h-5 w-5 rounded-full bg-white translate-x-5 transition-transform" />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Available in console header and settings
          </p>
        </LandingCard>

        {/* Activity history */}
        <LandingCard
          variant="elevated"
          className="flex flex-col gap-4"
          data-reveal=""
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Activity history
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Every action includes what, when, why, and scope.
          </p>
          <div className="space-y-2 mt-auto">
            {ACTIVITY_LOG.map((entry) => (
              <div
                key={entry.time}
                className="rounded-lg bg-muted/40 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    {entry.action}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {entry.time}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {entry.scope}
                </span>
              </div>
            ))}
          </div>
        </LandingCard>
      </div>
    </LandingSection>
  );
}
