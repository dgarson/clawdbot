"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMemories } from "@/hooks/queries";
import { Brain, ArrowRight, Loader2, Tag, Calendar } from "lucide-react";

interface RecentMemoriesPanelProps {
  maxMemories?: number;
  className?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

function truncateContent(content: string, maxLength: number = 80): string {
  if (content.length <= maxLength) {return content;}
  return content.slice(0, maxLength).trim() + "...";
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {return "Today";}
  if (days === 1) {return "Yesterday";}
  if (days < 7) {return `${days}d ago`;}

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const typeColors: Record<string, string> = {
  note: "bg-blue-500/20 text-blue-600",
  document: "bg-purple-500/20 text-purple-600",
  link: "bg-green-500/20 text-green-600",
  image: "bg-orange-500/20 text-orange-600",
  conversation: "bg-pink-500/20 text-pink-600",
  insight: "bg-yellow-500/20 text-yellow-600",
};

export function RecentMemoriesPanel({
  maxMemories = 4,
  className,
}: RecentMemoriesPanelProps) {
  const { data: memories, isLoading, error } = useMemories();

  // Sort by most recent
  const recentMemories = React.useMemo(() => {
    if (!memories) {return [];}
    return [...memories]
      .toSorted(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .slice(0, maxMemories);
  }, [memories, maxMemories]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.25 }}
      className={cn("", className)}
    >
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/10">
              <Brain className="h-4 w-4 text-pink-500" />
            </div>
            <CardTitle className="text-lg">Recent Memories</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/memories">
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Failed to load memories
            </div>
          ) : recentMemories.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No memories yet
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {recentMemories.map((memory) => (
                <motion.div
                  key={memory.id}
                  variants={itemVariants}
                  className="group rounded-lg border border-border/50 bg-secondary/30 p-3 transition-all duration-200 hover:border-primary/30 hover:bg-secondary/50 cursor-pointer"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h4 className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {memory.title}
                    </h4>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "shrink-0 text-xs capitalize",
                        typeColors[memory.type] || typeColors.note
                      )}
                    >
                      {memory.type}
                    </Badge>
                  </div>

                  <p className="mb-3 text-xs text-muted-foreground line-clamp-2">
                    {truncateContent(memory.content)}
                  </p>

                  <div className="flex items-center justify-between">
                    {/* Tags */}
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      {memory.tags.length > 0 && (
                        <>
                          <Tag className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <div className="flex gap-1 overflow-hidden">
                            {memory.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                            {memory.tags.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{memory.tags.length - 3}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Date */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 ml-2">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(memory.updatedAt)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default RecentMemoriesPanel;
