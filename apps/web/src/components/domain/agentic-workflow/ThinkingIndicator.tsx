"use client";

import { Card } from "@/components/ui/card";
import { Bot, Sparkles } from "lucide-react";

export function ThinkingIndicator({ thought }: { thought?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
        <Bot className="size-4 text-primary-foreground" />
      </div>
      <Card className="flex-1 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-[color:var(--warning)]" />
          <span className="text-xs font-semibold text-[color:var(--warning)]">
            Thinking…
          </span>
        </div>
        {thought ? (
          <div className="mt-2 text-xs text-muted-foreground italic">{thought}</div>
        ) : null}
        <div className="mt-3 flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-2 rounded-full bg-[color:var(--warning)] animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
