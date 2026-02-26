import React from "react";
import { Button } from "@/components/ui/button";
import { useInheritanceStore } from "@/stores/useInheritanceStore";
import { InheritanceBadge } from "@/components/composed/InheritanceBadge";

interface InheritableFieldProps<T> {
  agentId: string;
  field: string;
  defaultValue: T;
  customValue: T | undefined;
  onValueChange: (value: T | undefined) => void;
  children: (props: {
    value: T;
    onChange: (v: T) => void;
    isCustom: boolean;
  }) => React.ReactNode;
}

export function InheritableField<T>({
  agentId,
  field,
  defaultValue,
  customValue,
  onValueChange,
  children,
}: InheritableFieldProps<T>) {
  const setOverride = useInheritanceStore((state) => state.setOverride);

  const isCustom = customValue !== undefined;
  const currentValue = isCustom ? customValue : defaultValue;

  const handleChange = (v: T) => {
    setOverride(agentId, field, true);
    onValueChange(v);
  };

  const handleToggle = () => {
    if (isCustom) {
      setOverride(agentId, field, false);
      onValueChange(undefined);
    } else {
      setOverride(agentId, field, true);
      onValueChange(defaultValue);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <InheritanceBadge agentId={agentId} field={field} />
        <Button variant="ghost" size="xs" onClick={handleToggle}>
          {isCustom ? "Use Default" : "Customize"}
        </Button>
      </div>
      {children({ value: currentValue, onChange: handleChange, isCustom })}
    </div>
  );
}
