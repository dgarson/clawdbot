
import * as React from "react";
import { RefreshCw, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfig, useConfigSchema } from "@/hooks/queries/useConfig";
import { usePatchConfig } from "@/hooks/mutations/useConfigMutations";
import { DynamicConfigForm } from "./DynamicConfigForm";
import { useDynamicConfigForm } from "./useDynamicConfigForm";
import type { ConfigSchemaResponse } from "./schema-types";

export interface DynamicConfigSectionProps {
  /** Section title */
  title: string;
  /** Section description */
  description?: string;
  /** Config path prefix to filter fields (e.g., "gateway", "channels.telegram") */
  sectionPrefix: string;
  /** Icon to show in header */
  icon?: React.ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * A complete config section that fetches schema and config from gateway
 * and renders a dynamic form for a specific config section.
 */
export function DynamicConfigSection({
  title,
  description,
  sectionPrefix,
  icon,
  className,
}: DynamicConfigSectionProps) {
  // Query hooks
  const {
    data: config,
    isLoading: configLoading,
    error: configError,
    refetch: refetchConfig,
  } = useConfig();

  const {
    data: schemaData,
    isLoading: schemaLoading,
    error: schemaError,
  } = useConfigSchema();

  // Mutation hook
  const patchConfig = usePatchConfig();

  // Form state
  const { values, setValues, initialize } = useDynamicConfigForm();

  // Initialize values when config loads
  React.useEffect(() => {
    if (config?.config) {
      initialize(config.config as Record<string, unknown>);
    }
  }, [config?.config, initialize]);

  // Handle form submit
  const handleSubmit = async (formValues: Record<string, unknown>) => {
    if (!config?.hash) {
      console.error("No config hash available");
      return;
    }

    try {
      await patchConfig.mutateAsync({
        baseHash: config.hash,
        raw: JSON.stringify(formValues),
        note: `Update ${sectionPrefix} settings`,
      });
      // Refetch to get latest values
      refetchConfig();
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  };

  // Combined loading state
  const isLoading = configLoading || schemaLoading;
  const error = configError || schemaError;

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <CardTitle>{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Failed to load configuration</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "Unknown error occurred"}
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchConfig()}
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-3">
            {icon && <Skeleton className="h-10 w-10 rounded-lg" />}
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              {description && <Skeleton className="h-4 w-64" />}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-3">
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              {icon}
            </div>
          )}
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DynamicConfigForm
          schemaResponse={schemaData as ConfigSchemaResponse | undefined}
          values={values}
          onChange={setValues}
          onSubmit={handleSubmit}
          isSaving={patchConfig.isPending}
          sectionPrefix={sectionPrefix}
          groupAsCards={false}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Minimal version that just renders the form without the card wrapper
 */
export interface DynamicConfigFormConnectedProps {
  /** Config path prefix to filter fields */
  sectionPrefix?: string;
  /** Whether to group fields as cards */
  groupAsCards?: boolean;
  /** Additional className */
  className?: string;
}

export function DynamicConfigFormConnected({
  sectionPrefix,
  groupAsCards = true,
  className,
}: DynamicConfigFormConnectedProps) {
  // Query hooks
  const { data: config, isLoading: configLoading, error: configError, refetch } = useConfig();
  const { data: schemaData, isLoading: schemaLoading, error: schemaError } = useConfigSchema();

  // Mutation hook
  const patchConfig = usePatchConfig();

  // Form state
  const { values, setValues, initialize } = useDynamicConfigForm();

  // Initialize values when config loads
  React.useEffect(() => {
    if (config?.config) {
      initialize(config.config as Record<string, unknown>);
    }
  }, [config?.config, initialize]);

  // Handle form submit
  const handleSubmit = async (formValues: Record<string, unknown>) => {
    if (!config?.hash) {return;}

    try {
      await patchConfig.mutateAsync({
        baseHash: config.hash,
        raw: JSON.stringify(formValues),
        note: sectionPrefix ? `Update ${sectionPrefix} settings` : "Update configuration",
      });
      refetch();
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  };

  const isLoading = configLoading || schemaLoading;
  const error = configError || schemaError;

  return (
    <DynamicConfigForm
      schemaResponse={schemaData as ConfigSchemaResponse | undefined}
      values={values}
      onChange={setValues}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      isSaving={patchConfig.isPending}
      error={error ? (error instanceof Error ? error.message : "Unknown error") : null}
      sectionPrefix={sectionPrefix}
      groupAsCards={groupAsCards}
      className={className}
    />
  );
}

export default DynamicConfigSection;
