"use client";

import { motion } from "framer-motion";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface TerminalStatusIconProps {
  connected: boolean;
  onClick: () => void;
  className?: string;
}

export function TerminalStatusIcon({ connected, onClick, className }: TerminalStatusIconProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          type="button"
          onClick={onClick}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "fixed bottom-4 right-4 z-40 flex h-10 w-10 items-center justify-center",
            "rounded-full border border-border/60 bg-card shadow-lg",
            "hover:bg-accent transition-colors",
            className
          )}
        >
          <Terminal className="h-4.5 w-4.5 text-foreground" />
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
              connected ? "bg-green-500" : "bg-muted-foreground/50"
            )}
          />
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="left">
        {connected ? "Terminal connected" : "Terminal disconnected"} &mdash; Click to open
      </TooltipContent>
    </Tooltip>
  );
}

export default TerminalStatusIcon;
