"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Save } from "lucide-react";
import {
  ToolAccessConfig,
  DEFAULT_TOOLS,
  type Tool,
  type ToolsetConfig,
} from "@/components/domain/tools";

export interface ToolsetEditorProps {
  toolset?: ToolsetConfig;
  onSave: (toolset: Omit<ToolsetConfig, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}

export function ToolsetEditor({
  toolset,
  onSave,
  onCancel,
}: ToolsetEditorProps) {
  const [name, setName] = React.useState(toolset?.name ?? "");
  const [description, setDescription] = React.useState(
    toolset?.description ?? ""
  );

  // Initialize tools from toolset or defaults
  const [tools, setTools] = React.useState<Tool[]>(() => {
    if (toolset) {
      // Merge toolset permissions with default tools
      return DEFAULT_TOOLS.map((defaultTool) => {
        const permission = toolset.tools.find(
          (t) => t.toolId === defaultTool.id
        );
        return permission
          ? {
              ...defaultTool,
              enabled: permission.enabled,
              permissions: permission.permissions ?? defaultTool.permissions,
            }
          : defaultTool;
      });
    }
    return DEFAULT_TOOLS.map((t) => ({ ...t }));
  });

  const isValid = name.trim().length > 0;

  const handleSave = () => {
    if (!isValid) {return;}

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      tools: tools.map((tool) => ({
        toolId: tool.id,
        enabled: tool.enabled,
        permissions: tool.permissions,
      })),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-primary/30">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between text-lg">
            {toolset ? "Edit Toolset" : "Create Toolset"}
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name & Description */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="toolset-name">Name *</Label>
              <Input
                id="toolset-name"
                placeholder="e.g., Research Mode, Developer Tools"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toolset-description">Description</Label>
              <Textarea
                id="toolset-description"
                placeholder="Optional description of this toolset..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Tool Configuration */}
          <div className="border-t pt-6">
            <ToolAccessConfig
              tools={tools}
              onToolsChange={setTools}
              showHeader={false}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isValid} className="gap-2">
              <Save className="h-4 w-4" />
              {toolset ? "Save Changes" : "Create Toolset"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default ToolsetEditor;
