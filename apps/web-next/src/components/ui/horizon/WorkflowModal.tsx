import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  // Esc key handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      {/* Click-outside backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workflow-modal-title"
        className="relative w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-4 py-3">
          <div>
            <h3 id="workflow-modal-title" className="text-base font-semibold text-foreground">{title}</h3>
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
    </div>,
    document.body
  );
}
