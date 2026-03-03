import { SurfaceSection } from '../components/ui/horizon/SurfaceSection';
import { ProgressiveDisclosureTable, type ProgressiveRow } from '../components/ui/horizon/ProgressiveDisclosureTable';

const capacityRows: ProgressiveRow[] = [
  {
    id: 'c1',
    title: 'Luis · UX pipeline',
    summary: 'Utilization 88% · handoff risk medium',
    status: 'Near limit',
    detail: 'Offload lower-priority design QA tasks to a support agent to avoid response-time degradation.',
  },
  {
    id: 'c2',
    title: 'Xavier · architecture reviews',
    summary: 'Utilization 64% · stable throughput',
    status: 'Healthy',
    detail: 'Can absorb one additional review stream without impacting average turnaround.',
  },
  {
    id: 'c3',
    title: 'Harry · queue ops',
    summary: 'Utilization 41% · available capacity',
    status: 'Available',
    detail: 'Candidate for temporary assignment to cost-optimization and incident follow-up workloads.',
  },
];

export default function AgentCapacityPlanner() {
  return (
    <div className="space-y-4">
      <SurfaceSection title="Agent Capacity Planner" subtitle="Plan assignments before overload impacts output">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">Average utilization</p><p className="text-2xl font-semibold text-foreground">64%</p></div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">Handoff friction</p><p className="text-2xl font-semibold text-foreground">Low</p></div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">Rebalance opportunities</p><p className="text-2xl font-semibold text-foreground">2</p></div>
        </div>
      </SurfaceSection>

      <SurfaceSection title="Capacity detail" subtitle="Expand rows for reallocation guidance">
        <ProgressiveDisclosureTable rows={capacityRows} />
      </SurfaceSection>
    </div>
  );
}
