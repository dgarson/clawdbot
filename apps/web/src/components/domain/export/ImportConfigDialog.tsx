
import * as React from "react";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  parseImportFile,
  validateConfigurationImport,
  type ValidatedConfigurationExport,
} from "@/lib/validation";
import type { ExportSection } from "@/lib/export";

interface ImportConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  onImport: (data: ValidatedConfigurationExport, sections: ExportSection[], strategy: ImportStrategy) => Promise<void>;
}

type ImportStrategy = "merge" | "replace";

interface SectionPreview {
  id: ExportSection;
  label: string;
  summary: string;
  available: boolean;
}

export function ImportConfigDialog({
  open,
  onOpenChange,
  file,
  onImport,
}: ImportConfigDialogProps) {
  const [isValidating, setIsValidating] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [validationResult, setValidationResult] = React.useState<{
    valid: boolean;
    data?: ValidatedConfigurationExport;
    errors?: string[];
  } | null>(null);
  const [selectedSections, setSelectedSections] = React.useState<ExportSection[]>([]);
  const [strategy, setStrategy] = React.useState<ImportStrategy>("replace");

  // Validate file when it changes
  React.useEffect(() => {
    if (!file || !open) {
      setValidationResult(null);
      setSelectedSections([]);
      return;
    }

    const validate = async () => {
      setIsValidating(true);
      try {
        const parseResult = await parseImportFile(file);
        if (!parseResult.success) {
          setValidationResult({ valid: false, errors: parseResult.errors });
          return;
        }

        const validateResult = validateConfigurationImport(parseResult.data);
        if (!validateResult.success) {
          setValidationResult({ valid: false, errors: validateResult.errors });
          return;
        }
        if (!validateResult.data) {
          setValidationResult({ valid: false, errors: ["Validation returned no data"] });
          return;
        }

        setValidationResult({ valid: true, data: validateResult.data });
        // Select all available sections by default
        setSelectedSections(validateResult.data.sections);
      } catch {
        setValidationResult({ valid: false, errors: ["Failed to validate file"] });
      } finally {
        setIsValidating(false);
      }
    };

    validate();
  }, [file, open]);

  const sectionPreviews = React.useMemo((): SectionPreview[] => {
    const data = validationResult?.data;
    if (!data) {return [];}

    const previews: SectionPreview[] = [];

    if (data.sections.includes("profile")) {
      const profile = data.data.profile;
      previews.push({
        id: "profile",
        label: "Profile",
        summary: profile?.name ? `Name: "${profile.name}"` : "Empty profile",
        available: true,
      });
    }

    if (data.sections.includes("preferences")) {
      const prefs = data.data.preferences;
      previews.push({
        id: "preferences",
        label: "Preferences",
        summary: prefs?.timezone ? `Timezone: ${prefs.timezone}` : "Default preferences",
        available: true,
      });
    }

    if (data.sections.includes("uiSettings")) {
      const ui = data.data.uiSettings;
      const parts: string[] = [];
      if (ui?.theme) {parts.push(`Theme: ${ui.theme}`);}
      if (ui?.powerUserMode !== undefined) {parts.push(`Power User: ${ui.powerUserMode ? "enabled" : "disabled"}`);}
      previews.push({
        id: "uiSettings",
        label: "UI Settings",
        summary: parts.join(", ") || "Default UI settings",
        available: true,
      });
    }

    if (data.sections.includes("gatewayConfig")) {
      const gw = data.data.gatewayConfig;
      const agentCount = gw?.agents ? Object.keys(gw.agents).filter(k => k !== "default").length : 0;
      const channelCount = gw?.channels ? Object.keys(gw.channels).length : 0;
      previews.push({
        id: "gatewayConfig",
        label: "Gateway Config",
        summary: `${agentCount} agent${agentCount !== 1 ? "s" : ""}, ${channelCount} channel${channelCount !== 1 ? "s" : ""}`,
        available: true,
      });
    }

    if (data.sections.includes("toolsets")) {
      const toolsetsData = data.data.toolsets;
      const count = toolsetsData?.configs?.length ?? 0;
      previews.push({
        id: "toolsets",
        label: "Toolsets",
        summary: `${count} custom toolset${count !== 1 ? "s" : ""}${toolsetsData?.defaultToolsetId ? " (with default)" : ""}`,
        available: true,
      });
    }

    return previews;
  }, [validationResult?.data]);

  const toggleSection = (section: ExportSection) => {
    setSelectedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const handleImport = async () => {
    if (!validationResult?.data || selectedSections.length === 0) {return;}

    setIsImporting(true);
    try {
      await onImport(validationResult.data, selectedSections, strategy);
      toast.success("Configuration imported successfully");
      onOpenChange(false);
    } catch {
      toast.error("Failed to import configuration");
    } finally {
      setIsImporting(false);
    }
  };

  const exportedAt = validationResult?.data?.exportedAt
    ? new Date(validationResult.data.exportedAt).toLocaleString()
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Configuration</DialogTitle>
          <DialogDescription>
            Review and select what to import from this file.
          </DialogDescription>
        </DialogHeader>

        {isValidating ? (
          <div className="flex items-center justify-center py-8 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Validating file...</span>
          </div>
        ) : validationResult?.valid ? (
          <div className="space-y-4">
            {/* File info */}
            <div className="text-sm space-y-1">
              <p className="font-medium truncate">{file?.name}</p>
              {exportedAt && (
                <p className="text-muted-foreground">Exported: {exportedAt}</p>
              )}
            </div>

            {/* Validation status */}
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
              <CheckCircle2 className="h-4 w-4" />
              <span>All validation checks passed</span>
            </div>

            {/* Section selection */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Found in export:</p>
              {sectionPreviews.map((section) => (
                <label
                  key={section.id}
                  className="flex items-start gap-3 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedSections.includes(section.id)}
                    onCheckedChange={() => toggleSection(section.id)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium">{section.label}</span>
                    <p className="text-xs text-muted-foreground">
                      {section.summary}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {/* Import strategy */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Import strategy:</p>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="strategy"
                    value="merge"
                    checked={strategy === "merge"}
                    onChange={() => setStrategy("merge")}
                    className={cn(
                      "h-4 w-4 border border-input bg-background",
                      "focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      "checked:border-primary checked:bg-primary"
                    )}
                  />
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium">Merge</span>
                    <p className="text-xs text-muted-foreground">
                      Keep existing values, add/update from import
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="strategy"
                    value="replace"
                    checked={strategy === "replace"}
                    onChange={() => setStrategy("replace")}
                    className={cn(
                      "h-4 w-4 border border-input bg-background",
                      "focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      "checked:border-primary checked:bg-primary"
                    )}
                  />
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium">Replace</span>
                    <p className="text-xs text-muted-foreground">
                      Overwrite with imported values
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        ) : validationResult ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">Validation failed</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {validationResult.errors?.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!validationResult?.valid || selectedSections.length === 0 || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              `Import Selected (${selectedSections.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportConfigDialog;
