import { SurfaceSection } from '../components/ui/horizon/SurfaceSection';
import { ProgressiveDisclosureTable, type ProgressiveRow } from '../components/ui/horizon/ProgressiveDisclosureTable';

const inboxRows: ProgressiveRow[] = [
  {
    id: 'a1',
    title: 'Approval needed: deploy canary',
    summary: 'Release pipeline is waiting for reviewer action',
    status: 'Approval',
    detail: 'Approve or reject canary promotion. Includes diff summary, rollback plan, and affected channels.',
  },
  {
    id: 'a2',
    title: 'Expiring API key in 3 days',
    summary: 'Provider auth key nearing expiry window',
    status: 'Security',
    detail: 'Rotate key and run connection probe before expiry to avoid workflow interruptions.',
  },
  {
    id: 'a3',
    title: 'Stale session needs triage',
    summary: 'Session has been idle after error state for 2 hours',
    status: 'Ops',
    detail: 'Inspect transcript and tool logs, then either resume with context or archive as unresolved.',
  },
];

export default function ActionInboxView() {
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

      <SurfaceSection title="Inbox queue" subtitle="Expanded rows reveal only the context you need">
        <ProgressiveDisclosureTable rows={inboxRows} />
      </SurfaceSection>
    </div>
  );
}
