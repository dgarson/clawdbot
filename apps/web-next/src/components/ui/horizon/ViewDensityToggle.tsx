import { cn } from '../../../lib/utils';

type ViewDensity = 'comfortable' | 'compact';

interface ViewDensityToggleProps {
  value: ViewDensity;
  onChange: (value: ViewDensity) => void;
}

export function ViewDensityToggle({ value, onChange }: ViewDensityToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-secondary/20 p-1">
      {(['comfortable', 'compact'] as const).map((density) => (
        <button
          key={density}
          onClick={() => onChange(density)}
          className={cn(
            'rounded px-2 py-1 text-[11px] capitalize transition-colors',
            value === density ? 'bg-primary/20 text-primary' : 'text-muted-foreground'
          )}
        >
          {density}
        </button>
      ))}
    </div>
  );
}
