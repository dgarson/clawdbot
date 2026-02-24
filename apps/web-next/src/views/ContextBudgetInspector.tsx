import { useEffect, useState } from 'react';
import { SurfaceSection } from '../components/ui/horizon/SurfaceSection';
import { useHorizonOps, type HorizonContextBudget } from '../hooks/useHorizonOps';

const riskClasses: Record<HorizonContextBudget['risk'], string> = {
  low: 'text-green-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
};

export default function ContextBudgetInspector() {
  const { getContextBudgets } = useHorizonOps();
  const [rows, setRows] = useState<HorizonContextBudget[]>([]);

  useEffect(() => {
    getContextBudgets().then(setRows).catch(() => setRows([]));
  }, [getContextBudgets]);

  return (
    <div className="space-y-4">
      <SurfaceSection title="Context Budget Inspector" subtitle="Track token/context risk before sessions fail">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">Tracked sessions</p><p className="text-2xl font-semibold text-foreground">{rows.length}</p></div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">High risk</p><p className="text-2xl font-semibold text-foreground">{rows.filter((r) => r.risk === 'high').length}</p></div>
          <div className="rounded-lg border border-border bg-secondary/20 p-3"><p className="text-xs text-muted-foreground">Avg budget used</p><p className="text-2xl font-semibold text-foreground">{rows.length ? Math.round(rows.reduce((a, r) => a + (r.usedTokens / r.maxTokens), 0) / rows.length * 100) : 0}%</p></div>
        </div>
      </SurfaceSection>

      <SurfaceSection title="Session budget detail" subtitle="Use this to proactively trim context before hard limits">
        <div className="space-y-2">
          {rows.map((row) => {
            const usedPct = Math.round((row.usedTokens / row.maxTokens) * 100);
            return (
              <div key={row.session} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm text-foreground">{row.session}</p>
                  <p className={`text-xs uppercase ${riskClasses[row.risk]}`}>{row.risk}</p>
                </div>
                <p className="text-xs text-muted-foreground">{row.usedTokens.toLocaleString()} / {row.maxTokens.toLocaleString()} tokens ({usedPct}%)</p>
                <div className="mt-2 h-2 rounded bg-secondary">
                  <div className="h-2 rounded bg-primary" style={{ width: `${Math.min(usedPct, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </SurfaceSection>
    </div>
  );
}
