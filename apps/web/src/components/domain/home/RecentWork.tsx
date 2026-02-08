"use client";

import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Clock, ArrowRight, MessageCircle, ListTodo } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkstreams } from "@/hooks/queries";
import { useConversations } from "@/hooks/queries";
import { cn } from "@/lib/utils";

interface RecentItem {
  id: string;
  title: string;
  type: "workstream" | "conversation";
  updatedAt: string;
  status?: string;
  href: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface RecentWorkProps {
  maxItems?: number;
  className?: string;
}

/**
 * Shows 3 most recent workstreams/conversations with Resume actions.
 */
export function RecentWork({ maxItems = 3, className }: RecentWorkProps) {
  const { data: workstreams } = useWorkstreams();
  const { data: conversations } = useConversations();

  // Merge and sort by updatedAt
  const items: RecentItem[] = [];

  if (workstreams) {
    for (const ws of workstreams) {
      items.push({
        id: ws.id,
        title: ws.name,
        type: "workstream",
        updatedAt: ws.updatedAt,
        status: ws.status,
        href: `/workstreams/${ws.id}`,
      });
    }
  }

  if (conversations) {
    for (const conv of conversations) {
      items.push({
        id: conv.id,
        title: conv.title,
        type: "conversation",
        updatedAt: conv.updatedAt,
        href: `/conversations/${conv.id}`,
      });
    }
  }

  items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const recent = items.slice(0, maxItems);

  if (recent.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Recent work
        </h3>
        <Button variant="ghost" size="xs" asChild>
          <Link to="/workstreams">
            View all
            <ArrowRight className="size-3" />
          </Link>
        </Button>
      </div>
      <div className="space-y-2">
        {recent.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link to={item.href as string}>
              <Card className="cursor-pointer border-border/50 transition-all hover:border-primary/20 hover:bg-muted/30">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    {item.type === "workstream" ? (
                      <ListTodo className="size-4 text-muted-foreground" />
                    ) : (
                      <MessageCircle className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="size-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(item.updatedAt)}
                      </span>
                      {item.status && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {item.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="xs" className="shrink-0">
                    Resume
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
