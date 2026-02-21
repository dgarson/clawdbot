"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { create } from "zustand";

// ---------------------------------------------------------------------------
// Toast Store
// ---------------------------------------------------------------------------

type ToastVariant = "default" | "success" | "error" | "warning" | "info";

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
  createdAt: number;
};

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastStore = {
  toasts: Toast[];
  add: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

let toastId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  add: (input) => {
    const id = `toast-${++toastId}`;
    const toast: Toast = {
      id,
      title: input.title,
      description: input.description,
      variant: input.variant ?? "default",
      duration: input.duration ?? 4000,
      createdAt: Date.now(),
    };

    set((s) => ({ toasts: [...s.toasts, toast] }));

    // Auto-dismiss
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, toast.duration);

    return id;
  },

  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  clear: () => set({ toasts: [] }),
}));

/** Convenience hook */
export function useToast() {
  const add = useToastStore((s) => s.add);
  return {
    toast: add,
    success: (title: string, description?: string) =>
      add({ title, description, variant: "success" }),
    error: (title: string, description?: string) =>
      add({ title, description, variant: "error" }),
    warning: (title: string, description?: string) =>
      add({ title, description, variant: "warning" }),
    info: (title: string, description?: string) =>
      add({ title, description, variant: "info" }),
  };
}

// ---------------------------------------------------------------------------
// Toast Viewport Component
// ---------------------------------------------------------------------------

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: "bg-card border-border",
  success: "bg-card border-l-4 border-l-success border-border",
  error: "bg-card border-l-4 border-l-destructive border-border",
  warning: "bg-card border-l-4 border-l-warning border-border",
  info: "bg-card border-l-4 border-l-primary border-border",
};

const VARIANT_ICONS: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const VARIANT_ICON_COLORS: Record<ToastVariant, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  error: "text-destructive",
  warning: "text-warning",
  info: "text-primary",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = VARIANT_ICONS[toast.variant];
  const [exiting, setExiting] = React.useState(false);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(onDismiss, 200);
  };

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all duration-200",
        VARIANT_STYLES[toast.variant],
        exiting
          ? "opacity-0 translate-x-4"
          : "opacity-100 translate-x-0 animate-in slide-in-from-right-full fade-in-0"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", VARIANT_ICON_COLORS[toast.variant])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) {return null;}

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-h-[50vh] overflow-hidden pointer-events-none lg:bottom-6 lg:right-6">
      {toasts.slice(-5).map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={() => dismiss(toast.id)} />
        </div>
      ))}
    </div>
  );
}
