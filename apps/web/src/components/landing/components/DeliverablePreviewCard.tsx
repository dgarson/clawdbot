import { LandingCard } from "./LandingCard";
import { StatusChip } from "./StatusChip";
import { cn } from "@/lib/utils";

interface DeliverablePreviewCardProps {
  title: string;
  sections: { heading: string; bullets: string[] }[];
  metadata: string;
  status: "done" | "in-progress" | "waiting";
  statusLabel: string;
  actions?: React.ReactNode;
  className?: string;
}

/** Realistic product artifact card used as proof in Hero and Examples. */
export function DeliverablePreviewCard({
  title,
  sections,
  metadata,
  status,
  statusLabel,
  actions,
  className,
}: DeliverablePreviewCardProps) {
  return (
    <LandingCard variant="glass" className={cn("max-w-lg", className)}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <StatusChip variant={status} label={statusLabel} />
      </div>

      <div className="space-y-3 mb-4">
        {sections.map((section) => (
          <div key={section.heading}>
            <h4 className="text-sm font-medium text-foreground mb-1">
              {section.heading}
            </h4>
            <ul className="space-y-0.5">
              {section.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="text-sm text-muted-foreground flex items-start gap-2"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">{metadata}</span>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </LandingCard>
  );
}
