
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Terminal, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type ToolCallStatus = "pending" | "running" | "success" | "error";

export interface ToolCall {
  id: string;
  name: string;
  status: ToolCallStatus;
  duration?: number;
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
}

interface ToolCallCardProps {
  toolCall: ToolCall;
  defaultExpanded?: boolean;
  className?: string;
}

const statusConfig: Record<ToolCallStatus, { icon: React.ReactNode; color: string; label: string }> = {
  pending: {
    icon: <div className="h-3 w-3 rounded-full bg-gray-400" />,
    color: "text-muted-foreground",
    label: "Pending",
  },
  running: {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />,
    color: "text-blue-500",
    label: "Running",
  },
  success: {
    icon: <Check className="h-3.5 w-3.5 text-green-500" />,
    color: "text-green-500",
    label: "Success",
  },
  error: {
    icon: <X className="h-3.5 w-3.5 text-red-500" />,
    color: "text-red-500",
    label: "Error",
  },
};

export function ToolCallCard({
  toolCall,
  defaultExpanded = false,
  className,
}: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const status = statusConfig[toolCall.status];

  const formatDuration = (ms: number) => {
    if (ms < 1000) {return `${ms}ms`;}
    return `${(ms / 1000).toFixed(2)}s`;
  };

  /**
   * Strip security wrappers from external content.
   * These wrappers are meant for LLM context only, not user display.
   */
  const stripSecurityWrappers = (content: string): string => {
    let cleaned = content;

    // Remove security wrapper boundaries
    cleaned = cleaned.replace(/<<<EXTERNAL_UNTRUSTED_CONTENT>>>/g, '');
    cleaned = cleaned.replace(/<<<END_EXTERNAL_UNTRUSTED_CONTENT>>>/g, '');

    // Remove security warning block (multi-line warning about untrusted content)
    const warningPattern = /SECURITY NOTICE:[\s\S]*?(?=Source:|$)/;
    cleaned = cleaned.replace(warningPattern, '');

    // Remove metadata lines that are part of the wrapper
    cleaned = cleaned.replace(/^Source: (Email|Webhook|API|Web Search|Web Fetch|External)\s*\n/gm, '');
    cleaned = cleaned.replace(/^From: .*\n/gm, '');
    cleaned = cleaned.replace(/^Subject: .*\n/gm, '');
    cleaned = cleaned.replace(/^---\s*\n/gm, '');

    return cleaned.trim();
  };

  const formatJson = (value: unknown): string => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const stripWrappersFromValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return stripSecurityWrappers(value);
    }
    if (Array.isArray(value)) {
      return value.map(stripWrappersFromValue);
    }
    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = stripWrappersFromValue(val);
      }
      return result;
    }
    return value;
  };

  const formatOutput = (value: unknown): string => {
    // Strip security wrappers from the value structure first, then format
    const cleaned = stripWrappersFromValue(value);
    return formatJson(cleaned);
  };

  return (
    <Card
      className={cn(
        "border-border/50 bg-secondary/30 overflow-hidden",
        className
      )}
    >
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full h-auto p-3 rounded-none justify-start hover:bg-secondary/50"
      >
        <div className="flex items-center gap-3 w-full">
          {/* Expand icon */}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}

          {/* Tool icon */}
          <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />

          {/* Tool name */}
          <span className="font-mono text-sm font-medium text-foreground truncate">
            {toolCall.name}
          </span>

          {/* Status indicator */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {toolCall.duration && toolCall.status !== "running" && (
              <span className="text-xs text-muted-foreground">
                {formatDuration(toolCall.duration)}
              </span>
            )}
            <Badge variant="secondary" className="gap-1.5">
              {status.icon}
              <span className={cn("text-xs", status.color)}>
                {status.label}
              </span>
            </Badge>
          </div>
        </div>
      </Button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="p-3 pt-0 space-y-3">
              {/* Input */}
              {toolCall.input && Object.keys(toolCall.input).length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Input
                  </span>
                  <pre className="p-2 rounded-md bg-background/50 text-xs font-mono text-foreground overflow-x-auto max-h-40">
                    {formatJson(toolCall.input)}
                  </pre>
                </div>
              )}

              {/* Output */}
              {toolCall.output !== undefined && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Output
                  </span>
                  <pre className="p-2 rounded-md bg-background/50 text-xs font-mono text-foreground overflow-x-auto max-h-40">
                    {formatOutput(toolCall.output)}
                  </pre>
                </div>
              )}

              {/* Error */}
              {toolCall.error && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-red-500 uppercase tracking-wide">
                    Error
                  </span>
                  <pre className="p-2 rounded-md bg-red-500/10 text-xs font-mono text-red-500 overflow-x-auto max-h-40">
                    {toolCall.error}
                  </pre>
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default ToolCallCard;
