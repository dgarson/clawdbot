"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wrench, Info } from "lucide-react";
import {
  ToolAccessConfig,
  DEFAULT_TOOLS,
  type Tool,
  type ToolsetConfig,
} from "@/components/domain/tools";
import {
  getAllToolsets,
  getToolsetById,
} from "@/components/domain/settings/toolsets-utils";
import { useToolsetsStore } from "@/stores";

interface AgentToolsTabProps {
  agentId: string;
}

function applyToolsetToTools(
  toolset: ToolsetConfig | null,
  defaultTools: Tool[]
): Tool[] {
  if (!toolset) {
    return defaultTools.map((t) => ({ ...t }));
  }

  return defaultTools.map((defaultTool) => {
    const permission = toolset.tools.find((t) => t.toolId === defaultTool.id);
    return permission
      ? {
          ...defaultTool,
          enabled: permission.enabled,
          permissions: permission.permissions ?? defaultTool.permissions,
        }
      : { ...defaultTool, enabled: false };
  });
}

export function AgentToolsTab({ agentId }: AgentToolsTabProps) {
  void agentId;

  // Get toolsets from persistent store
  const { toolsets: customToolsets, defaultToolsetId } = useToolsetsStore();
  const allToolsets = getAllToolsets(customToolsets);

  // Toolset selection: "custom" means agent-specific, otherwise it's a toolset ID
  // Default to the store's defaultToolsetId if set
  const [selectedToolsetId, setSelectedToolsetId] = React.useState<string>(
    defaultToolsetId ?? "custom"
  );

  // Tools state - initialized from defaults
  const [tools, setTools] = React.useState<Tool[]>(() =>
    DEFAULT_TOOLS.map((t) => ({ ...t }))
  );

  // Find the selected toolset
  const selectedToolset = React.useMemo(() => {
    if (selectedToolsetId === "custom") {return null;}
    return getToolsetById(selectedToolsetId, customToolsets) ?? null;
  }, [selectedToolsetId, customToolsets]);

  // When toolset changes, apply its settings
  React.useEffect(() => {
    if (selectedToolset) {
      setTools(applyToolsetToTools(selectedToolset, DEFAULT_TOOLS));
    }
  }, [selectedToolset]);

  const handleToolsetChange = (value: string) => {
    setSelectedToolsetId(value);
    if (value === "custom") {
      // Reset to defaults when switching to custom
      setTools(DEFAULT_TOOLS.map((t) => ({ ...t })));
    }
  };

  const isReadOnly = selectedToolsetId !== "custom";

  return (
    <div className="space-y-6">
      {/* Toolset Selection */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Wrench className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="toolset-select">Tool Configuration</Label>
                <p className="text-sm text-muted-foreground">
                  Choose a predefined toolset or customize tools for this agent.
                </p>
              </div>
              <Select value={selectedToolsetId} onValueChange={handleToolsetChange}>
                <SelectTrigger id="toolset-select" className="w-full max-w-xs">
                  <SelectValue placeholder="Select toolset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">
                    <div className="flex items-center gap-2">
                      Custom Configuration
                    </div>
                  </SelectItem>
                  {allToolsets.map((toolset) => (
                    <SelectItem key={toolset.id} value={toolset.id}>
                      <div className="flex items-center gap-2">
                        {toolset.name}
                        <Badge variant="secondary" className="text-[10px]">
                          {toolset.tools.filter((t) => t.enabled).length} tools
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedToolset && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">
                      Using <span className="font-medium text-foreground">{selectedToolset.name}</span> toolset.{" "}
                      {selectedToolset.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Switch to "Custom Configuration" to modify individual tools.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tool Access Configuration */}
      <ToolAccessConfig
        tools={tools}
        onToolsChange={setTools}
        readOnly={isReadOnly}
        showAddCustomTool={!isReadOnly}
      />
    </div>
  );
}

export default AgentToolsTab;
