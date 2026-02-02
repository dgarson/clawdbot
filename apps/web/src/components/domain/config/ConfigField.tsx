"use client";

import * as React from "react";
import { HelpCircle, Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
	import type { ProcessedField } from "./schema-types";

export interface ConfigFieldProps {
  /** Processed field definition */
  field: ProcessedField;
  /** Current value */
  value: unknown;
  /** Called when value changes */
  onChange: (path: string, value: unknown) => void;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Renders a single config field based on its type and UI hints
 */
export function ConfigField({
  field,
  value,
  onChange,
  disabled = false,
  className,
}: ConfigFieldProps) {
  const label = field.hint.label ?? formatLabel(field.key);
  const help = field.hint.help;
  const placeholder = field.hint.placeholder;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Label
          htmlFor={field.path}
          className={cn(
            "text-sm font-medium",
            field.required && "after:content-['*'] after:ml-0.5 after:text-destructive"
          )}
        >
          {label}
        </Label>
        {help && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-sm">{help}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <FieldInput
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
}

/**
 * Renders a compact inline version of the config field
 */
export function ConfigFieldInline({
  field,
  value,
  onChange,
  disabled = false,
  className,
}: ConfigFieldProps) {
  const label = field.hint.label ?? formatLabel(field.key);
  const help = field.hint.help;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-2",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Label
          htmlFor={field.path}
          className={cn(
            "text-sm font-medium cursor-pointer",
            field.required && "after:content-['*'] after:ml-0.5 after:text-destructive"
          )}
        >
          {label}
        </Label>
        {help && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-sm">{help}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="shrink-0">
        <FieldInput
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
          compact
        />
      </div>
    </div>
  );
}

interface FieldInputProps {
  field: ProcessedField;
  value: unknown;
  onChange: (path: string, value: unknown) => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
}

/**
 * Renders the appropriate input component based on field type
 */
function FieldInput({
  field,
  value,
  onChange,
  disabled,
  placeholder,
  compact = false,
}: FieldInputProps) {
  const handleChange = (newValue: unknown) => {
    onChange(field.path, newValue);
  };

  switch (field.type) {
    case "boolean":
      return (
        <BooleanField
          id={field.path}
          value={value as boolean | undefined}
          onChange={handleChange}
          disabled={disabled}
          compact={compact}
        />
      );

    case "password":
      return (
        <PasswordField
          id={field.path}
          value={value as string | undefined}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          compact={compact}
        />
      );

    case "select":
      return (
        <SelectField
          id={field.path}
          value={value as string | undefined}
          onChange={handleChange}
          options={field.schema.enum as (string | number)[]}
          disabled={disabled}
          placeholder={placeholder}
          compact={compact}
        />
      );

    case "slider":
      return (
        <SliderField
          id={field.path}
          value={value as number | undefined}
          onChange={handleChange}
          min={field.schema.minimum ?? 0}
          max={field.schema.maximum ?? 100}
          disabled={disabled}
          compact={compact}
        />
      );

    case "stepper":
    case "number":
      return (
        <NumberField
          id={field.path}
          value={value as number | undefined}
          onChange={handleChange}
          min={field.schema.minimum}
          max={field.schema.maximum}
          disabled={disabled}
          placeholder={placeholder}
          compact={compact}
        />
      );

    case "textarea":
      return (
        <TextareaField
          id={field.path}
          value={value as string | undefined}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
        />
      );

    case "text":
    default:
      return (
        <TextField
          id={field.path}
          value={value as string | undefined}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          compact={compact}
        />
      );
  }
}

// Individual field components

function BooleanField({
  id,
  value,
  onChange,
  disabled,
  compact,
}: {
  id: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <Switch
      id={id}
      checked={value ?? false}
      onCheckedChange={onChange}
      disabled={disabled}
      size={compact ? "sm" : "default"}
    />
  );
}

function PasswordField({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  compact,
}: {
  id: string;
  value: string | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "pr-10 font-mono text-sm",
          compact && "h-8 w-48"
        )}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute right-2 top-1/2 -translate-y-1/2"
        onClick={() => setVisible(!visible)}
        tabIndex={-1}
      >
        {visible ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

function SelectField({
  id,
  value,
  onChange,
  options,
  disabled,
  placeholder,
  compact,
}: {
  id: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: (string | number)[];
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  return (
    <Select
      value={value ?? ""}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        size={compact ? "sm" : "default"}
        className={cn(compact && "w-40")}
      >
        <SelectValue placeholder={placeholder ?? "Select..."} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={String(option)} value={String(option)}>
            {formatOptionLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SliderField({
  id,
  value,
  onChange,
  min,
  max,
  disabled,
  compact,
}: {
  id: string;
  value: number | undefined;
  onChange: (value: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
  compact?: boolean;
}) {
  const currentValue = value ?? min;

  return (
    <div className={cn("flex items-center gap-4", compact ? "w-48" : "w-full")}>
      <Slider
        id={id}
        value={[currentValue]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        className="flex-1"
      />
      <span className="text-sm text-muted-foreground w-12 text-right tabular-nums">
        {currentValue}
      </span>
    </div>
  );
}

function NumberField({
  id,
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder,
  compact,
}: {
  id: string;
  value: number | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  return (
    <Input
      id={id}
      type="number"
      value={value ?? ""}
      onChange={(e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {onChange(val);}
      }}
      min={min}
      max={max}
      disabled={disabled}
      placeholder={placeholder}
      className={cn("tabular-nums", compact && "h-8 w-24")}
    />
  );
}

function TextareaField({
  id,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  id: string;
  value: string | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Textarea
      id={id}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      rows={4}
      className="resize-y"
    />
  );
}

function TextField({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  compact,
}: {
  id: string;
  value: string | undefined;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  return (
    <Input
      id={id}
      type="text"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(compact && "h-8 w-48")}
    />
  );
}

// Helper functions

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[._-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function formatOptionLabel(option: string | number): string {
  if (typeof option === "number") {return String(option);}
  return option
    .replace(/([A-Z])/g, " $1")
    .replace(/[._-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

export default ConfigField;
