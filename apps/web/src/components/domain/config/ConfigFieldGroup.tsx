
import * as React from "react";
import { ChevronDown, Settings2 } from "lucide-react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ConfigField, ConfigFieldInline } from "./ConfigField";
import type { FieldGroup, ProcessedField } from "./schema-types";

export interface ConfigFieldGroupProps {
  /** Field group to render */
  group: FieldGroup;
  /** Current values object */
  values: Record<string, unknown>;
  /** Called when a field value changes */
  onChange: (path: string, value: unknown) => void;
  /** Whether all fields are disabled */
  disabled?: boolean;
  /** Use inline layout for boolean/simple fields */
  inlineSimpleFields?: boolean;
  /** Show advanced fields expanded by default */
  advancedExpandedByDefault?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Renders a group of related config fields with optional advanced section
 */
export function ConfigFieldGroup({
  group,
  values,
  onChange,
  disabled = false,
  inlineSimpleFields = true,
  advancedExpandedByDefault = false,
  className,
}: ConfigFieldGroupProps) {
  const [advancedOpen, setAdvancedOpen] = React.useState(advancedExpandedByDefault);

  const hasAdvanced = group.advancedFields.length > 0;
  const hasNormal = group.fields.length > 0;

  if (!hasNormal && !hasAdvanced) {
    return null;
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{group.label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Normal fields */}
        {hasNormal && (
          <div className="space-y-4">
            {group.fields.map((field) => (
              <FieldRenderer
                key={field.path}
                field={field}
                values={values}
                onChange={onChange}
                disabled={disabled}
                inline={inlineSimpleFields && isInlineableField(field)}
              />
            ))}
          </div>
        )}

        {/* Advanced fields section */}
        {hasAdvanced && (
          <>
            {hasNormal && <Separator />}
            <AdvancedFieldsSection
              fields={group.advancedFields}
              values={values}
              onChange={onChange}
              disabled={disabled}
              open={advancedOpen}
              onOpenChange={setAdvancedOpen}
              inlineSimpleFields={inlineSimpleFields}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Standalone component for advanced fields section
 */
export interface AdvancedFieldsSectionProps {
  /** Advanced fields to render */
  fields: ProcessedField[];
  /** Current values */
  values: Record<string, unknown>;
  /** Called when a field value changes */
  onChange: (path: string, value: unknown) => void;
  /** Whether all fields are disabled */
  disabled?: boolean;
  /** Whether section is expanded */
  open?: boolean;
  /** Called when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Use inline layout for boolean/simple fields */
  inlineSimpleFields?: boolean;
  /** Section title */
  title?: string;
  /** Additional className */
  className?: string;
}

export function AdvancedFieldsSection({
  fields,
  values,
  onChange,
  disabled = false,
  open = false,
  onOpenChange,
  inlineSimpleFields = true,
  title = "Advanced Settings",
  className,
}: AdvancedFieldsSectionProps) {
  const [isOpen, setIsOpen] = React.useState(open);

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  // Sync with external open state
  React.useEffect(() => {
    setIsOpen(open);
  }, [open]);

  if (fields.length === 0) {
    return null;
  }

  return (
    <Collapsible.Root
      open={isOpen}
      onOpenChange={handleOpenChange}
      className={className}
    >
      <Collapsible.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-muted-foreground hover:text-foreground -mx-2 px-2"
        >
          <span className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            {title}
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
              {fields.length}
            </span>
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </Button>
      </Collapsible.Trigger>

      <Collapsible.Content forceMount>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-4 pt-4">
                {fields.map((field) => (
                  <FieldRenderer
                    key={field.path}
                    field={field}
                    values={values}
                    onChange={onChange}
                    disabled={disabled}
                    inline={inlineSimpleFields && isInlineableField(field)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

/**
 * Renders a single field, choosing inline or stacked layout
 */
interface FieldRendererProps {
  field: ProcessedField;
  values: Record<string, unknown>;
  onChange: (path: string, value: unknown) => void;
  disabled?: boolean;
  inline?: boolean;
}

function FieldRenderer({
  field,
  values,
  onChange,
  disabled,
  inline,
}: FieldRendererProps) {
  const value = getNestedValue(values, field.path);

  if (inline) {
    return (
      <ConfigFieldInline
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  return (
    <ConfigField
      field={field}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

/**
 * Check if a field can be rendered inline (compact layout)
 */
function isInlineableField(field: ProcessedField): boolean {
  // Booleans and simple selects work well inline
  if (field.type === "boolean") {return true;}
  if (field.type === "select" && (field.schema.enum?.length ?? 0) <= 5) {return true;}
  // Check for explicit compact hint
  if (field.hint.compact === true) {return true;}
  if (field.hint.compact === false) {return false;}
  return false;
}

/**
 * Get nested value from object using dot path
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {return undefined;}
    if (typeof current !== "object") {return undefined;}
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export default ConfigFieldGroup;
