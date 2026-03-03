import type { ReactNode } from 'react';

interface SlideOverPanelProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function SlideOverPanel({ open, title, onClose, children }: SlideOverPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40">
      <button className="absolute inset-0 bg-black/55" onClick={onClose} aria-label="Close detail panel" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l border-border bg-card p-4 shadow-2xl sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <button className="rounded px-2 py-1 text-muted-foreground hover:bg-secondary" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="space-y-3">{children}</div>
      </aside>
    </div>
  );
}
