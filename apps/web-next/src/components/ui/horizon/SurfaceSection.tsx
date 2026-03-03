import type { ReactNode } from 'react';

interface SurfaceSectionProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SurfaceSection({ title, subtitle, action, children, className }: SurfaceSectionProps) {
  return (
    <section className={`rounded-xl border border-border bg-card p-4 ${className ?? ''}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
