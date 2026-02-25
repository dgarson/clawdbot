import React from "react";
import { cn } from "../../lib/utils";
import type { AlertRuleStatItem } from "./AlertRuleCardPrimitives";
import { AlertRuleStatsRail, AlertTargetPills } from "./AlertRuleCardPrimitives";

export function AlertRuleCard({
  id,
  title,
  titleBadges,
  targets,
  description,
  stats,
  leadingControl,
  headerActions,
  footerActions,
  onClick,
  className,
}: {
  id?: string;
  title: string;
  titleBadges?: React.ReactNode;
  targets?: string[];
  description?: React.ReactNode;
  stats: AlertRuleStatItem[];
  leadingControl?: React.ReactNode;
  headerActions?: React.ReactNode;
  footerActions?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <article
      id={id}
      onClick={onClick}
      className={cn("rounded-xl border border-tok-border bg-surface-0/60 p-4", className, onClick ? "cursor-pointer" : "")}
    >
      <div className="flex items-start gap-4">
        {leadingControl}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-fg-primary">{title}</h3>
              {titleBadges}
            </div>
            {headerActions}
          </div>

          {targets && targets.length > 0 ? <AlertTargetPills targets={targets} /> : null}
          {description ? <div className="text-xs text-fg-muted mt-2">{description}</div> : null}
          {footerActions ? <div className="mt-3 flex flex-wrap items-center gap-2">{footerActions}</div> : null}
        </div>
        <AlertRuleStatsRail stats={stats} />
      </div>
    </article>
  );
}
