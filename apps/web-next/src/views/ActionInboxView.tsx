import { useMemo, useState } from 'react';
import { SurfaceSection } from '../components/ui/horizon/SurfaceSection';
import { ProgressiveDisclosureTable, type ProgressiveRow } from '../components/ui/horizon/ProgressiveDisclosureTable';

type SlaLane = 'due-soon' | 'overdue' | 'blocked';

type InboxItem = ProgressiveRow & { lane: SlaLane };

const allInboxRows: InboxItem[] = [
  {
    id: 'a1',
    title: 'Approval needed: deploy canary',
    summary: 'Release pipeline is waiting for reviewer action',
    status: 'Approval',
    detail: 'Approve or reject canary promotion. Includes diff summary, rollback plan, and affected channels.',
    lane: 'due-soon',
  },
  {
    id: 'a2',
    title: 'Expiring API key in 3 days',
    summary: 'Provider auth key nearing expiry window',
    status: 'Security',
    detail: 'Rotate key and run connection probe before expiry to avoid workflow interruptions.',
    lane: 'due-soon',
  },
  {
    id: 'a3',
    title: 'Stale session needs triage',
    summary: 'Session has been idle after error state for 2 hours',
    status: 'Ops',
    detail: 'Inspect transcript and tool logs, then either resume with context or archive as unresolved.',
    lane: 'overdue',
  },
  {
    id: 'a4',
    title: 'Policy decision waiting on legal',
    summary: 'Compliance gate cannot proceed without approval',
    status: 'Policy',
    detail: 'Escalate to policy owner and unblock downstream release actions.',
    lane: 'blocked',
  },
];

export default function ActionInboxView() {
  const [lane, setLane] = useState<SlaLane>('due-soon');
  const rows = useMemo(() => allInboxRows.filter((item) => item.lane === lane), [lane]);

  const counts = {
    'due-soon': allInboxRows.filter((item) => item.lane === 'due-soon').length,
    overdue: allInboxRows.filter((item) => item.lane === 'overdue').length,
    blocked: allInboxRows.filter((item) => item.lane === 'blocked').length,
  };

  return (
    <div className="space-y-4">
      <SurfaceSection title="Action Inbox" subtitle="Unified queue for approvals, risks, and blockers">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">Needs approval</p><p className="text-xl font-semibold text-foreground">4</p></div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">Security actions</p><p className="text-xl font-semibold text-foreground">2</p></div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">Ops triage</p><p className="text-xl font-semibold text-foreground">5</p></div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">Expired SLA</p><p className="text-xl font-semibold text-foreground">1</p></div>
        </div>
      </SurfaceSection>

      <SurfaceSection title="SLA lanes" subtitle="Triage by due-soon, overdue, or blocked state">
        <div className="mb-3 flex flex-wrap gap-2">
          {([
            ['due-soon', 'Due soon'],
            ['overdue', 'Overdue'],
            ['blocked', 'Blocked'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setLane(id)}
              className={`rounded-lg border px-3 py-1.5 text-xs ${lane === id ? 'border-primary/60 bg-primary/15 text-primary' : 'border-border bg-secondary/20 text-muted-foreground'}`}
            >
              {label} ({counts[id]})
            </button>
          ))}
        </div>
        <ProgressiveDisclosureTable rows={rows} emptyMessage="No actions in this SLA lane." />
      </SurfaceSection>
    </div>
  );
}
