import { SurfaceSection } from '../components/ui/horizon/SurfaceSection';

const MODELS = [
  {
    id: 'operator',
    title: 'Operator lens',
    focus: 'Immediate execution and queue throughput',
    shows: ['Now lane items', 'Blocking errors', 'Fast remediation actions'],
  },
  {
    id: 'manager',
    title: 'Manager lens',
    focus: 'Stability, ownership, and escalation readiness',
    shows: ['Health and SLA pressure', 'Ownership gaps', 'Cross-team blockers'],
  },
  {
    id: 'builder',
    title: 'Builder lens',
    focus: 'Workflow composition and feature delivery',
    shows: ['Configuration deltas', 'Wizard completion', 'Build/deploy constraints'],
  },
];

export default function CompareModesDiffView() {
  return (
    <div className="space-y-4">
      <SurfaceSection title="Compare Modes Diff" subtitle="Evaluate what each lens surfaces and suppresses">
        <div className="grid gap-3 lg:grid-cols-3">
          {MODELS.map((model) => (
            <div key={model.id} className="rounded-lg border border-border bg-secondary/20 p-3">
              <h3 className="text-sm font-medium text-foreground">{model.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{model.focus}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-foreground">
                {model.shows.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </SurfaceSection>

      <SurfaceSection title="Delta snapshot" subtitle="How visible workload changes by lens">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Operator visible items</p><p className="text-2xl font-semibold text-foreground">12</p></div>
          <div className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Manager visible items</p><p className="text-2xl font-semibold text-foreground">9</p></div>
          <div className="rounded-lg border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Builder visible items</p><p className="text-2xl font-semibold text-foreground">7</p></div>
        </div>
      </SurfaceSection>
    </div>
  );
}
