"use client";

import * as React from "react";
import { Download, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  exportConfiguration,
  downloadFile,
  formatExportFilename,
  type ExportSection,
} from "@/lib/export";
import { useUserProfile, useUserPreferences } from "@/hooks/queries/useUserSettings";
import { useUIStore } from "@/stores/useUIStore";
import { useToolsetsStore } from "@/stores/useToolsetsStore";
import { useConfig } from "@/hooks/queries/useConfig";

interface ExportConfigSectionProps {
  className?: string;
}

const EXPORT_SECTIONS: { id: ExportSection; label: string; description: string }[] = [
  {
    id: "profile",
    label: "Profile",
    description: "Name, email, avatar, bio",
  },
  {
    id: "preferences",
    label: "Preferences",
    description: "Timezone, language, notifications",
  },
  {
    id: "uiSettings",
    label: "UI Settings",
    description: "Theme, sidebar state, power mode",
  },
  {
    id: "gatewayConfig",
    label: "Agents & Channels",
    description: "Gateway configuration (no API keys)",
  },
  {
    id: "toolsets",
    label: "Toolsets",
    description: "Custom tool permission configurations",
  },
];

export function ExportConfigSection({ className }: ExportConfigSectionProps) {
  const [selectedSections, setSelectedSections] = React.useState<ExportSection[]>([
    "profile",
    "preferences",
    "uiSettings",
    "gatewayConfig",
    "toolsets",
  ]);
  const [isExporting, setIsExporting] = React.useState(false);

  const { data: profile } = useUserProfile();
  const { data: preferences } = useUserPreferences();
  const { data: configSnapshot } = useConfig();
  const uiState = useUIStore();
  const { toolsets, defaultToolsetId } = useToolsetsStore();

  const toggleSection = (section: ExportSection) => {
    setSelectedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const handleExport = async () => {
    if (selectedSections.length === 0) {
      toast.error("Please select at least one section to export");
      return;
    }

    setIsExporting(true);
    try {
      const exportData = exportConfiguration({
        sections: selectedSections,
        profile,
        preferences,
        uiState: {
          theme: uiState.theme,
          sidebarCollapsed: uiState.sidebarCollapsed,
          powerUserMode: uiState.powerUserMode,
          useLiveGateway: uiState.useLiveGateway,
          attentionSnoozeUntilMs: uiState.attentionSnoozeUntilMs,
        },
        gatewayConfig: configSnapshot?.config,
        toolsets: {
          configs: toolsets,
          defaultToolsetId,
        },
      });

      const filename = formatExportFilename("clawdbrain-config");
      downloadFile(exportData, filename);

      toast.success("Configuration exported successfully");
    } catch {
      toast.error("Failed to export configuration");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <h4 className="text-sm font-medium mb-1">Export Configuration</h4>
        <p className="text-sm text-muted-foreground">
          Backup your settings to restore later or transfer to another device.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Select what to export:</p>

        {EXPORT_SECTIONS.map((section) => (
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
                {section.description}
              </p>
            </div>
          </label>
        ))}

        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 mt-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>API keys and authentication credentials are never exported for security.</span>
        </div>
      </div>

      <Button
        variant="outline"
        onClick={handleExport}
        disabled={isExporting || selectedSections.length === 0}
      >
        {isExporting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Export Configuration
          </>
        )}
      </Button>
    </div>
  );
}

export default ExportConfigSection;
