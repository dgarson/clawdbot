
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ToolCategorySection } from "./ToolCategorySection";
import {
  getSortedCategories,
  groupToolsByCategory,
  countEnabledTools,
} from "./tool-data";
import type { Tool } from "./types";

export interface ToolAccessConfigProps {
  tools: Tool[];
  onToolsChange: (tools: Tool[]) => void;
  readOnly?: boolean;
  showAddCustomTool?: boolean;
  showHeader?: boolean;
}

export function ToolAccessConfig({
  tools,
  onToolsChange,
  readOnly = false,
  showAddCustomTool = false,
  showHeader = true,
}: ToolAccessConfigProps) {
  const handleToolToggle = React.useCallback(
    (toolId: string, enabled: boolean) => {
      if (readOnly) {return;}
      onToolsChange(
        tools.map((tool) => (tool.id === toolId ? { ...tool, enabled } : tool))
      );
    },
    [tools, onToolsChange, readOnly]
  );

  const toolsByCategory = React.useMemo(
    () => groupToolsByCategory(tools),
    [tools]
  );
  const sortedCategories = React.useMemo(() => getSortedCategories(), []);
  const { enabled, total } = countEnabledTools(tools);

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Tool Access</h3>
            <p className="text-sm text-muted-foreground">
              {enabled} of {total} tools enabled
            </p>
          </div>
          {showAddCustomTool && (
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Custom Tool
            </Button>
          )}
        </div>
      )}

      {sortedCategories.map((categoryConfig) => {
        const categoryTools = toolsByCategory[categoryConfig.id];
        if (!categoryTools || categoryTools.length === 0) {return null;}

        return (
          <ToolCategorySection
            key={categoryConfig.id}
            category={categoryConfig.id}
            tools={categoryTools}
            defaultExpanded={categoryConfig.defaultExpanded}
            onToolToggle={handleToolToggle}
            disabled={readOnly}
          />
        );
      })}
    </div>
  );
}

export default ToolAccessConfig;
