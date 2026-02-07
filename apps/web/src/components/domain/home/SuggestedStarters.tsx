"use client";

import { motion } from "framer-motion";
import {
  Search,
  FileText,
  CalendarDays,
  Zap,
  CheckSquare,
  BookOpen,
  Lightbulb,
  BarChart3,
  Mail,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StarterTile {
  icon: typeof Search;
  label: string;
  description: string;
  prompt: string;
}

const STARTERS: StarterTile[] = [
  {
    icon: Search,
    label: "Research",
    description: "Find and summarize information",
    prompt: "Research the following topic and provide a summary:",
  },
  {
    icon: FileText,
    label: "Draft",
    description: "Write a document or message",
    prompt: "Draft the following:",
  },
  {
    icon: CalendarDays,
    label: "Plan",
    description: "Create a structured plan",
    prompt: "Create a plan for:",
  },
  {
    icon: Zap,
    label: "Automate",
    description: "Set up a recurring task",
    prompt: "Set up automation for:",
  },
  {
    icon: CheckSquare,
    label: "Review",
    description: "Analyze and give feedback",
    prompt: "Review the following and provide feedback:",
  },
  {
    icon: BookOpen,
    label: "Summarize",
    description: "Condense long content",
    prompt: "Summarize the following:",
  },
  {
    icon: Lightbulb,
    label: "Brainstorm",
    description: "Generate ideas and options",
    prompt: "Brainstorm ideas for:",
  },
  {
    icon: BarChart3,
    label: "Analyze",
    description: "Break down data or trends",
    prompt: "Analyze the following:",
  },
  {
    icon: Mail,
    label: "Compose",
    description: "Write an email or message",
    prompt: "Compose a message for:",
  },
];

interface SuggestedStartersProps {
  onSelect?: (prompt: string) => void;
  className?: string;
}

const tileVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Outcome-oriented starter tiles for the home page.
 * Each tile pre-fills the composer with a guided prompt.
 */
export function SuggestedStarters({ onSelect, className }: SuggestedStartersProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-sm font-medium text-muted-foreground">
        Start with a template
      </h3>
      <motion.div
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.04 }}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {STARTERS.map((starter) => (
          <motion.div key={starter.label} variants={tileVariants}>
            <Card
              className="cursor-pointer border-border/50 bg-card/50 transition-all hover:border-primary/30 hover:bg-card hover:shadow-sm"
              onClick={() => onSelect?.(starter.prompt)}
            >
              <CardContent className="flex items-start gap-3 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <starter.icon className="size-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {starter.label}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {starter.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
