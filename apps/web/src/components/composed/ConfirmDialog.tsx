"use client";

import * as React from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  resource?: {
    title: string;
    subtitle?: string;
    meta?: string;
    icon?: React.ReactNode;
  };
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  resource,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const Icon = variant === "destructive" ? Trash2 : AlertTriangle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader className="sm:text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Icon
              className={cn(
                "h-6 w-6",
                variant === "destructive" ? "text-destructive" : "text-warning"
              )}
            />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          {resource && (
            <div className="mt-3 rounded-xl border border-border/60 bg-secondary/30 p-3 text-left">
              <div className="flex items-center gap-3">
                {resource.icon ? (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background text-foreground">
                    {resource.icon}
                  </div>
                ) : null}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{resource.title}</div>
                  {resource.subtitle && (
                    <div className="text-xs text-muted-foreground truncate">{resource.subtitle}</div>
                  )}
                  {resource.meta && (
                    <div className="text-xs text-muted-foreground/80">{resource.meta}</div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? "..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Convenience hook for managing confirm dialog state
export function useConfirmDialog() {
  const [state, setState] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    variant?: "default" | "destructive";
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const confirm = (options: {
    title: string;
    description: string;
    confirmLabel?: string;
    variant?: "default" | "destructive";
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        ...options,
        open: true,
        onConfirm: () => resolve(true),
      });
    });
  };

  const dialogProps: ConfirmDialogProps = {
    ...state,
    onOpenChange: (open) => {
      if (!open) {
        setState((prev) => ({ ...prev, open: false }));
      }
    },
    onCancel: () => {
      setState((prev) => ({ ...prev, open: false }));
    },
  };

  return { confirm, dialogProps, ConfirmDialog };
}
