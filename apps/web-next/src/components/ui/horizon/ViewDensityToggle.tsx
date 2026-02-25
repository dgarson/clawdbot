import { cn } from '../../../lib/utils';

type ViewDensity = 'comfortable' | 'compact';

interface ViewDensityToggleProps {
  value: ViewDensity;
  onChange: (value: ViewDensity) => void;
}

export function ViewDensityToggle({ value, onChange }: ViewDensityToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--color-pill-border)] bg-[var(--color-surface-2)] p-1">
      {(['comfortable', 'compact'] as const).map((density) => (
        <button
          key={density}
          onClick={() => onChange(density)}
          className={cn(
            'rounded border px-2 py-1 text-[11px] capitalize transition-colors',
            value === density
              ? 'border-violet-300/70 bg-primary text-white shadow-[0_0_0_1px_rgba(196,181,253,0.35)]'
              : 'border-transparent text-foreground/85 hover:text-foreground hover:bg-secondary/45'
          )}
        >
          {density}
        </button>
      ))}
    </div>
  );
}
