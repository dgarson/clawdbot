"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { Tool } from "./types";

export interface ToolPermissionRowProps {
  tool: Tool;
  onToggle: (toolId: string, enabled: boolean) => void;
  disabled?: boolean;
  index?: number;
}

export function ToolPermissionRow({
  tool,
  onToggle,
  disabled = false,
  index = 0,
}: ToolPermissionRowProps) {
  const Icon = tool.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className={cn(
        "flex items-center justify-between rounded-lg border p-4 transition-colors",
        tool.enabled
          ? "border-primary/30 bg-primary/5"
          : "border-border/50 bg-card/50",
        disabled && "opacity-60"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            tool.enabled
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">{tool.name}</h4>
            {tool.permissions && tool.permissions.length > 0 && (
              <div className="flex gap-1">
                {tool.permissions.map((perm) => (
                  <Badge
                    key={perm}
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {perm}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tool.description}
          </p>
        </div>
      </div>
      <Switch
        checked={tool.enabled}
        onCheckedChange={(checked) => onToggle(tool.id, checked)}
        disabled={disabled}
      />
    </motion.div>
  );
}

export default ToolPermissionRow;
