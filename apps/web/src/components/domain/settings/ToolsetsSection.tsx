"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Plus,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Wrench,
  Lock,
  Star,
} from "lucide-react";
import { ToolsetEditor } from "./ToolsetEditor";
import { DEFAULT_TOOLS, type ToolsetConfig } from "@/components/domain/tools";
import { useToolsetsStore } from "@/stores/useToolsetsStore";
import { getAllToolsets } from "./toolsets-utils";

function getToolsetStats(toolset: ToolsetConfig): { enabled: number; total: number } {
  const enabledCount = toolset.tools.filter((t) => t.enabled).length;
  return { enabled: enabledCount, total: DEFAULT_TOOLS.length };
}

interface ToolsetCardProps {
  toolset: ToolsetConfig;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

function ToolsetCard({
  toolset,
  onEdit,
  onDuplicate,
  onDelete,
}: ToolsetCardProps) {
  const stats = getToolsetStats(toolset);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      layout
    >
      <Card className="border-border/50 hover:border-border transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wrench className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{toolset.name}</h4>
                  {toolset.isBuiltIn && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Lock className="h-2.5 w-2.5" />
                      Built-in
                    </Badge>
                  )}
                </div>
                {toolset.description && (
                  <p className="text-sm text-muted-foreground">
                    {toolset.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {stats.enabled} of {stats.total} tools enabled
                </p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!toolset.isBuiltIn && onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDuplicate && (
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                )}
                {!toolset.isBuiltIn && onDelete && (
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ToolsetsSection() {
  // Use persistent store
  const {
    toolsets,
    defaultToolsetId,
    createToolset,
    updateToolset,
    deleteToolset,
    setDefaultToolsetId,
  } = useToolsetsStore();

  const [editingToolset, setEditingToolset] = React.useState<
    ToolsetConfig | "new" | null
  >(null);

  const handleCreateToolset = (
    data: Omit<ToolsetConfig, "id" | "createdAt" | "updatedAt">
  ) => {
    createToolset(data);
    setEditingToolset(null);
  };

  const handleUpdateToolset = (
    id: string,
    data: Omit<ToolsetConfig, "id" | "createdAt" | "updatedAt">
  ) => {
    updateToolset(id, data);
    setEditingToolset(null);
  };

  const handleDuplicateToolset = (toolset: ToolsetConfig) => {
    createToolset({
      name: `${toolset.name} (Copy)`,
      description: toolset.description,
      tools: toolset.tools.map((t) => ({ ...t })),
      isBuiltIn: false,
    });
  };

  const handleDeleteToolset = (id: string) => {
    deleteToolset(id);
  };

  const allToolsets = getAllToolsets(toolsets);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Toolsets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Create reusable tool permission configurations that can be applied
            to multiple agents. Toolsets define which tools are available and
            their access levels.
          </p>
          <Button
            onClick={() => setEditingToolset("new")}
            className="gap-2"
            disabled={editingToolset !== null}
          >
            <Plus className="h-4 w-4" />
            Create Toolset
          </Button>
        </CardContent>
      </Card>

      {/* Default Toolset Setting */}
      <Card className="border-border/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 shrink-0">
              <Star className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="default-toolset">Default Toolset for New Agents</Label>
                <p className="text-sm text-muted-foreground">
                  New agents will use this toolset by default. You can override this per-agent.
                </p>
              </div>
              <Select
                value={defaultToolsetId ?? "custom"}
                onValueChange={(value) => setDefaultToolsetId(value === "custom" ? null : value)}
              >
                <SelectTrigger id="default-toolset" className="w-full max-w-xs">
                  <SelectValue placeholder="Select default toolset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">
                    Custom (no default)
                  </SelectItem>
                  {allToolsets.map((toolset) => (
                    <SelectItem key={toolset.id} value={toolset.id}>
                      <div className="flex items-center gap-2">
                        {toolset.name}
                        {toolset.isBuiltIn && (
                          <Badge variant="secondary" className="text-[10px]">
                            Built-in
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      <AnimatePresence mode="wait">
        {editingToolset && (
          <ToolsetEditor
            key={editingToolset === "new" ? "new" : editingToolset.id}
            toolset={editingToolset === "new" ? undefined : editingToolset}
            onSave={(data) => {
              if (editingToolset === "new") {
                handleCreateToolset(data);
              } else {
                handleUpdateToolset(editingToolset.id, data);
              }
            }}
            onCancel={() => setEditingToolset(null)}
          />
        )}
      </AnimatePresence>

      {/* Toolset List */}
      {!editingToolset && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground px-1">
            Available Toolsets ({allToolsets.length})
          </h3>
          <AnimatePresence mode="popLayout">
            {allToolsets.map((toolset) => (
              <ToolsetCard
                key={toolset.id}
                toolset={toolset}
                onEdit={
                  !toolset.isBuiltIn
                    ? () => setEditingToolset(toolset)
                    : undefined
                }
                onDuplicate={() => handleDuplicateToolset(toolset)}
                onDelete={
                  !toolset.isBuiltIn
                    ? () => handleDeleteToolset(toolset.id)
                    : undefined
                }
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export default ToolsetsSection;
