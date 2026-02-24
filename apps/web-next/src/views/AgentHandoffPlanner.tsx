import { SurfaceSection } from '../components/ui/horizon/SurfaceSection';
import { ProgressiveDisclosureTable, type ProgressiveRow } from '../components/ui/horizon/ProgressiveDisclosureTable';

const handoffRows: ProgressiveRow[] = [
  {
    id: 'h1',
    title: 'Luis → Harry',
    summary: 'UI QA queue transfer · readiness 82%',
    status: 'Recommended',
    detail: 'Transfer low-priority UI verification tasks to Harry and keep Luis on design-critical backlog.',
  },
  {
    id: 'h2',
    title: 'Xavier → Luis',
    summary: 'Architecture context transfer · readiness 68%',
    status: 'Needs prep',
    detail: 'Add decision summary and unresolved constraints to session notes before handoff to avoid churn.',
  },
  {
    id: 'h3',
    title: 'Harry → Xavier',
    summary: 'Incident postmortem package · readiness 91%',
    status: 'Ready',
    detail: 'Handoff can proceed now; include alert timeline and mitigation summary.',
  },
];

export default function AgentHandoffPlanner() {
  return (
    <div className="space-y-4">
      <SurfaceSection title="Agent Handoff Planner" subtitle="Reduce context loss during multi-agent transfer">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">Ready handoffs</p><p className="text-2xl font-semibold text-foreground">2</p></div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">Needs prep</p><p className="text-2xl font-semibold text-foreground">1</p></div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">Avg readiness</p><p className="text-2xl font-semibold text-foreground">80%</p></div>
        </div>
      </SurfaceSection>

      <SurfaceSection title="Handoff queue" subtitle="Expandable rows show transfer guidance and required context">
        <ProgressiveDisclosureTable rows={handoffRows} />
      </SurfaceSection>
    </div>
  );
}
