"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Tag, Calendar, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Memory {
  id: string;
  content: string;
  source: string;
  timestamp: string;
  tags: string[];
  workspace?: string;
}

interface MemoryCardProps {
  memory: Memory;
  variant?: "expanded" | "compact";
  onEdit?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
  className?: string;
}

const sourceColors: Record<string, string> = {
  agent: "bg-primary/20 text-primary",
  manual: "bg-blue-500/20 text-blue-600",
  import: "bg-purple-500/20 text-purple-600",
  conversation: "bg-green-500/20 text-green-600",
};

function truncateContent(content: string, maxLength: number = 150): string {
  if (content.length <= maxLength) {return content;}
  return content.slice(0, maxLength).trim() + "...";
}

export function MemoryCard({
  memory,
  variant = "expanded",
  onEdit,
  onDelete,
  onClick,
  className,
}: MemoryCardProps) {
  const sourceColorClass = sourceColors[memory.source.toLowerCase()] || "bg-secondary text-secondary-foreground";

  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        whileHover={{ scale: 1.01 }}
        role="button"
        tabIndex={0}
        className={cn("group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg", className)}
        onClick={onClick}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && onClick) {
            e.preventDefault();
            onClick();
          }
        }}
      >
        <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="shrink-0 p-2 rounded-lg bg-secondary/50">
              <Brain className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground line-clamp-2">
                {truncateContent(memory.content, 100)}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className={cn("text-xs", sourceColorClass)}>
                  {memory.source}
                </Badge>
                <span className="text-xs text-muted-foreground">{memory.timestamp}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      role="button"
      tabIndex={0}
      className={cn("group relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl", className)}
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <Card className="relative overflow-hidden rounded-2xl border-border/50 bg-gradient-to-br from-card via-card to-card/80 backdrop-blur-sm transition-all duration-500 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
        {/* Gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-accent to-primary opacity-60" />

        {/* Glow effect on hover */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        <CardContent className="relative p-6">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/50">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <Badge variant="secondary" className={cn("text-xs", sourceColorClass)}>
                {memory.source}
              </Badge>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          <p className="mb-4 text-sm text-foreground line-clamp-3">
            {truncateContent(memory.content)}
          </p>

          {/* Tags */}
          {memory.tags && memory.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {memory.tags.map((tag, index) => (
                <motion.span
                  key={tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary/80 px-2.5 py-1 text-xs font-medium text-secondary-foreground border border-border/50 transition-all duration-200 hover:bg-secondary hover:border-primary/30"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                </motion.span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>{memory.timestamp}</span>
            </div>
            {memory.workspace && (
              <span className="text-muted-foreground/70">
                {memory.workspace}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default MemoryCard;
