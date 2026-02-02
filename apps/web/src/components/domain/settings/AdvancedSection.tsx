"use client";

import * as React from "react";
import { AlertTriangle, Keyboard, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useUIStore } from "@/stores/useUIStore";
import { useToolsetsStore } from "@/stores/useToolsetsStore";
import {
  ExportConfigSection,
  ExportConversationsDialog,
  ImportConfigDialog,
  ImportDropzone,
} from "@/components/domain/export";
import { type ValidatedConfigurationExport } from "@/lib/validation";
import { type ExportSection } from "@/lib/export";
import { useUpdateProfile, useUpdatePreferences } from "@/hooks/mutations/useUserSettingsMutations";

interface AdvancedSectionProps {
  className?: string;
  onOpenShortcuts?: () => void;
}

export function AdvancedSection({ className, onOpenShortcuts }: AdvancedSectionProps) {
  const { powerUserMode, setPowerUserMode, setTheme } = useUIStore();
  const [showConversationsDialog, setShowConversationsDialog] = React.useState(false);
  const [showImportDialog, setShowImportDialog] = React.useState(false);
  const [importFile, setImportFile] = React.useState<File | null>(null);

  const updateProfile = useUpdateProfile();
  const updatePreferences = useUpdatePreferences();

  const handlePowerUserToggle = (enabled: boolean) => {
    setPowerUserMode(enabled);
    toast.success(
      enabled ? "Power User Mode enabled" : "Power User Mode disabled"
    );
  };

  const handleFileSelect = (file: File) => {
    setImportFile(file);
    setShowImportDialog(true);
  };

  const handleImport = async (
    data: ValidatedConfigurationExport,
    sections: ExportSection[],
    strategy: "merge" | "replace"
  ) => {
    // Note: strategy will be used for merge logic when gateway API supports it
    void strategy;
    // Apply profile settings
    if (sections.includes("profile") && data.data.profile) {
      const profile = data.data.profile;
      await updateProfile.mutateAsync({
        name: profile.name,
        email: profile.email,
        avatar: profile.avatar,
        bio: profile.bio,
      });
    }

    // Apply preferences
    if (sections.includes("preferences") && data.data.preferences) {
      const prefs = data.data.preferences;
      await updatePreferences.mutateAsync({
        timezone: prefs.timezone,
        language: prefs.language,
        defaultAgentId: prefs.defaultAgentId,
        notifications: prefs.notifications,
      });
    }

    // Apply UI settings
    if (sections.includes("uiSettings") && data.data.uiSettings) {
      const ui = data.data.uiSettings;
      if (ui.theme) {setTheme(ui.theme);}
      if (ui.powerUserMode !== undefined) {setPowerUserMode(ui.powerUserMode);}
      // Note: sidebarCollapsed is also available but typically not imported
    }

    // Gateway config would be applied via gateway API in the future
    // For now, we just acknowledge it was selected
    if (sections.includes("gatewayConfig") && data.data.gatewayConfig) {
      // TODO: Implement gateway config import via gateway API
      toast.info("Gateway configuration noted - apply via CLI for now");
    }

    // Apply toolsets
    if (sections.includes("toolsets") && data.data.toolsets) {
      const { importToolsets, setDefaultToolsetId } = useToolsetsStore.getState();
      importToolsets(data.data.toolsets.configs, strategy === "merge");
      if (data.data.toolsets.defaultToolsetId) {
        setDefaultToolsetId(data.data.toolsets.defaultToolsetId);
      }
    }

    // Reset import state
    setImportFile(null);
  };

  return (
    <>
      <Card className={cn("", className)}>
        <CardHeader>
          <CardTitle>Advanced</CardTitle>
          <CardDescription>
            Power user features, data management, and keyboard shortcuts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Power User Mode */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 flex-1">
                <Label htmlFor="power-user" className="text-base font-medium">
                  Power User Mode
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable advanced features like Debug, Filesystem, Jobs, and Nodes.
                </p>
              </div>
              <Switch
                id="power-user"
                checked={powerUserMode}
                onCheckedChange={handlePowerUserToggle}
              />
            </div>

            {/* Warning/Info box */}
            <div className="flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-4">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Power User Features</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li><strong>Debug Panel</strong> - View system logs and agent internals</li>
                  <li><strong>Filesystem</strong> - Browse and manage agent files</li>
                  <li><strong>Jobs</strong> - Monitor background tasks and queues</li>
                  <li><strong>Nodes</strong> - Visualize agent architecture and connections</li>
                </ul>
              </div>
            </div>
          </div>

          <Separator />

          {/* Export Configuration */}
          <ExportConfigSection />

          <Separator />

          {/* Import Configuration */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-1">Import Configuration</h4>
              <p className="text-sm text-muted-foreground">
                Restore settings from a previous export.
              </p>
            </div>
            <ImportDropzone onFileSelect={handleFileSelect} />
          </div>

          <Separator />

          {/* Export Conversations */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-1">Export Conversations</h4>
              <p className="text-sm text-muted-foreground">
                Download your conversation history.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowConversationsDialog(true)}
            >
              <MessageSquare className="h-4 w-4" />
              Export Conversations...
            </Button>
          </div>

          <Separator />

          {/* Keyboard Shortcuts */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-1">Keyboard Shortcuts</h4>
              <p className="text-sm text-muted-foreground">
                View all available keyboard shortcuts for faster navigation.
              </p>
            </div>
            <Button variant="outline" onClick={onOpenShortcuts}>
              <Keyboard className="h-4 w-4" />
              View All Shortcuts
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ExportConversationsDialog
        open={showConversationsDialog}
        onOpenChange={setShowConversationsDialog}
      />

      <ImportConfigDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        file={importFile}
        onImport={handleImport}
      />
    </>
  );
}

export default AdvancedSection;
