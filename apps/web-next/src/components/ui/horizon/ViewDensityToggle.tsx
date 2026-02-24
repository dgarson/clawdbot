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
            'rounded px-2 py-1 text-[11px] capitalize transition-colors',
            value === density
              ? 'bg-[var(--color-pill-active-bg)] text-[var(--color-pill-active-text)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
          )}
        >
          {density}
        </button>
      ))}
    </div>
  );
}
