import { SurfaceSection } from '../components/ui/horizon/SurfaceSection';
import { ProgressiveDisclosureTable, type ProgressiveRow } from '../components/ui/horizon/ProgressiveDisclosureTable';

const morningPriorities: ProgressiveRow[] = [
  {
    id: 'p1',
    title: 'Stabilize gateway reliability',
    summary: '2 warning-level alerts in last 24h',
    status: 'High',
    detail: 'Investigate reconnect spikes and verify automatic recovery behavior on all active channels.',
  },
  {
    id: 'p2',
    title: 'Finalize Horizon operator workflows',
    summary: '3 wizard flows pending QA signoff',
    status: 'Medium',
    detail: 'Validate all modal workflows for keyboard accessibility and mobile tap targets before promoting.',
  },
  {
    id: 'p3',
    title: 'Trim excess token burn',
    summary: 'Cost trend is up 6% week-over-week',
    status: 'Medium',
    detail: 'Review outlier sessions and apply routing guardrails for costly model routes.',
  },
];

export default function TodayCommandCenter() {
  return (
    <div className="space-y-4">
      <SurfaceSection title="Today Command Center" subtitle="A high-signal operating brief for the day">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-xs text-muted-foreground">Critical actions</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">3</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-xs text-muted-foreground">Blocked workflows</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">1</p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3">
            <p className="text-xs text-muted-foreground">Decisions needed</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">2</p>
          </div>
        </div>
      </SurfaceSection>

      <SurfaceSection title="Priority stack" subtitle="Top items sorted by impact and urgency">
        <ProgressiveDisclosureTable rows={morningPriorities} />
      </SurfaceSection>
    </div>
  );
}
