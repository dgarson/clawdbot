"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type CheckboxProps = Omit<React.ComponentPropsWithoutRef<"input">, "type"> & {
  onCheckedChange?: (checked: boolean) => void;
};

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, defaultChecked, onCheckedChange, onChange, ...props }, ref) => {
    return (
      <span className={cn("relative inline-flex items-center", className)}>
        <input
          ref={ref}
          type="checkbox"
          className={cn(
            "peer size-4 shrink-0 rounded-[4px] border border-input bg-background shadow-xs outline-none transition-shadow",
            "focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
            "checked:border-primary checked:bg-primary"
          )}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={(e) => {
            onChange?.(e);
            onCheckedChange?.(e.target.checked);
          }}
          {...props}
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-primary-foreground opacity-0 peer-checked:opacity-100">
          <CheckIcon className="size-3.5" />
        </span>
      </span>
    );
  }
);

Checkbox.displayName = "Checkbox";
