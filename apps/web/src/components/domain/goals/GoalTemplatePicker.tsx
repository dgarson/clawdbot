"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import {
  GOAL_TEMPLATE_CATEGORIES,
  GOAL_TEMPLATES,
  type GoalTemplate,
  type GoalTemplateCategory,
} from "./goal-templates";

interface GoalTemplatePickerProps {
  onSelect: (template: GoalTemplate) => void;
  onSkip: () => void;
  className?: string;
}

export function GoalTemplatePicker({
  onSelect,
  onSkip,
  className,
}: GoalTemplatePickerProps) {
  const [selectedCategory, setSelectedCategory] =
    React.useState<GoalTemplateCategory>("development");

  const filteredTemplates = React.useMemo(
    () => GOAL_TEMPLATES.filter((t) => t.category === selectedCategory),
    [selectedCategory]
  );

  return (
    <div className={cn("space-y-5", className)}>
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {GOAL_TEMPLATE_CATEGORIES.map((cat) => (
          <Button
            key={cat.id}
            type="button"
            variant={selectedCategory === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              "h-9 rounded-lg gap-1.5 transition-all",
              selectedCategory === cat.id
                ? "shadow-sm"
                : "hover:bg-accent/50"
            )}
          >
            <span className="text-sm">{cat.icon}</span>
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Template Cards */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={selectedCategory}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="grid gap-3 sm:grid-cols-2"
        >
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={() => onSelect(template)}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Skip option */}
      <div className="flex justify-center pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSkip}
          className="text-muted-foreground hover:text-foreground gap-2"
        >
          <FileText className="h-4 w-4" />
          Start from scratch
        </Button>
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  onSelect,
}: {
  template: GoalTemplate;
  onSelect: () => void;
}) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card
        className={cn(
          "cursor-pointer overflow-hidden border-border/50 bg-card/80",
          "transition-all duration-200",
          "hover:border-primary/30 hover:bg-accent/5 hover:shadow-md",
          isHovered && "ring-1 ring-primary/20"
        )}
        onClick={onSelect}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5">
              {template.icon}
            </span>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-medium text-foreground">
                {template.name}
              </h4>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {template.description}
              </p>
              {/* Milestone count badge */}
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-1.5 py-0.5">
                  {template.milestones.length} milestones
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default GoalTemplatePicker;
