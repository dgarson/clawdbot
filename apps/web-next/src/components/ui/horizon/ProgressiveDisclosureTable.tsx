import { cn } from '../../../lib/utils';
import { useState } from 'react';

export interface ProgressiveRow {
  id: string;
  title: string;
  summary: string;
  status?: string;
  detail: string;
}

export function ProgressiveDisclosureTable({
  rows,
  emptyMessage = 'No rows available.',
}: {
  rows: ProgressiveRow[];
  emptyMessage?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(rows[0]?.id ?? null);

  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {rows.map((row) => {
        const open = openId === row.id;
        return (
          <div key={row.id} className="border-b border-border last:border-b-0">
            <button
              onClick={() => setOpenId((prev) => (prev === row.id ? null : row.id))}
              className={cn(
                'flex w-full items-start gap-3 px-3 py-3 text-left transition-colors',
                open ? 'bg-secondary/30' : 'hover:bg-secondary/20'
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
                <p className="truncate text-xs text-muted-foreground">{row.summary}</p>
              </div>
              {row.status && <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{row.status}</span>}
            </button>
            {open && <div className="border-t border-border bg-card px-3 py-3 text-xs text-muted-foreground">{row.detail}</div>}
          </div>
        );
      })}
    </div>
  );
}
