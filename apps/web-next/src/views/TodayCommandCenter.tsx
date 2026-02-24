import { useState } from 'react';
import { SurfaceSection } from '../components/ui/horizon/SurfaceSection';
import { ProgressiveDisclosureTable, type ProgressiveRow } from '../components/ui/horizon/ProgressiveDisclosureTable';
import { useHorizonOps } from '../hooks/useHorizonOps';

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
  const [openBrief, setOpenBrief] = useState(false);
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<{ title: string; summary: string; bullets: string[] } | null>(null);
  const { composeBrief } = useHorizonOps();

  const handleCompose = async () => {
    setLoading(true);
    const nextBrief = await composeBrief();
    setBrief(nextBrief);
    setOpenBrief(true);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <SurfaceSection
        title="Today Command Center"
        subtitle="A high-signal operating brief for the day"
        action={(
          <button onClick={handleCompose} className="rounded-md border border-border bg-secondary/30 px-3 py-1.5 text-xs text-foreground">
            {loading ? 'Composing…' : 'Compose brief'}
          </button>
        )}
      >
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

      {openBrief && brief && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
          <div className="w-full max-w-xl rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">{brief.title}</h3>
              <button onClick={() => setOpenBrief(false)} className="rounded px-2 py-1 text-muted-foreground hover:bg-secondary">✕</button>
            </div>
            <p className="text-sm text-muted-foreground">{brief.summary}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground">
              {brief.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
