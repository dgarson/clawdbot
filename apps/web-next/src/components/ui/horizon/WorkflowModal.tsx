import type { ReactNode } from 'react';

interface WorkflowModalProps {
  open: boolean;
  title: string;
  subtitle: string;
  step: number;
  totalSteps: number;
  nextLabel: string;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  children: ReactNode;
}

export function WorkflowModal({
  open,
  title,
  subtitle,
  step,
  totalSteps,
  nextLabel,
  onClose,
  onBack,
  onNext,
  children,
}: WorkflowModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <button onClick={onClose} className="rounded px-2 py-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground" aria-label="Close dialog">
            ✕
          </button>
        </div>
        <div className="px-4 py-4">
          <p className="mb-3 text-xs text-muted-foreground">Step {step} of {totalSteps}</p>
          {children}
          <div className="mt-4 flex justify-between">
            <button disabled={step === 1} onClick={onBack} className="rounded border border-border px-3 py-2 text-xs disabled:opacity-40">
              Back
            </button>
            <button onClick={onNext} className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground">
              {nextLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
