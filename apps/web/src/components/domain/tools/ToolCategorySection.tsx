"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { ToolPermissionRow } from "./ToolPermissionRow";
import { getCategoryConfig, countEnabledTools } from "./tool-data";
import type { Tool, ToolCategory } from "./types";

export interface ToolCategorySectionProps {
  category: ToolCategory;
  tools: Tool[];
  defaultExpanded?: boolean;
  onToolToggle: (toolId: string, enabled: boolean) => void;
  disabled?: boolean;
}

export function ToolCategorySection({
  category,
  tools,
  defaultExpanded,
  onToolToggle,
  disabled = false,
}: ToolCategorySectionProps) {
  const config = getCategoryConfig(category);
  const [isExpanded, setIsExpanded] = React.useState(
    defaultExpanded ?? config.defaultExpanded
  );

  const { enabled, total } = countEnabledTools(tools);
  const CategoryIcon = config.icon;

  if (tools.length === 0) return null;

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader
        className={cn(
          "pb-4 cursor-pointer select-none transition-colors hover:bg-muted/50",
          !isExpanded && "pb-4"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <CategoryIcon className="h-4 w-4 text-primary" />
            {config.label}
            <Badge variant="secondary" className="text-xs font-normal">
              {enabled}/{total}
            </Badge>
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </CardTitle>
      </CardHeader>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <CardContent className="space-y-3 pt-3">
              {tools.map((tool, index) => (
                <ToolPermissionRow
                  key={tool.id}
                  tool={tool}
                  onToggle={onToolToggle}
                  disabled={disabled}
                  index={index}
                />
              ))}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default ToolCategorySection;
