import React from "react";
import { cn } from "../../lib/utils";

interface DialogShellProps {
  open: boolean;
  title: string;
  description?: string;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  tone?: "default" | "danger";
}

function DialogShell({
  open,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  confirmDisabled = false,
  tone = "default",
}: DialogShellProps) {
  if (!open) {return null;}

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onCancel}
        aria-label="Close dialog"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
        {description && <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{description}</p>}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              tone === "danger"
                ? "bg-rose-600/90 text-white hover:bg-rose-500"
                : "bg-primary text-white hover:bg-primary"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: "default" | "danger";
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel,
  onConfirm,
  onCancel,
  tone = "default",
}: ConfirmDialogProps) {
  return (
    <DialogShell
      open={open}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={onConfirm}
      onCancel={onCancel}
      tone={tone}
    />
  );
}

interface PromptDialogProps {
  open: boolean;
  title: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  required?: boolean;
}

export function PromptDialog({
  open,
  title,
  description,
  value,
  onChange,
  placeholder,
  confirmLabel = "Save",
  cancelLabel,
  onConfirm,
  onCancel,
  required = true,
}: PromptDialogProps) {
  const isDisabled = required && value.trim().length === 0;
  return (
    <DialogShell
      open={open}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={onConfirm}
      onCancel={onCancel}
      confirmDisabled={isDisabled}
    >
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoFocus
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-primary"
      />
    </DialogShell>
  );
}
