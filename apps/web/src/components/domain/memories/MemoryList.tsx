"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MemoryCard, type Memory } from "./MemoryCard";
import { Brain } from "lucide-react";

interface MemoryListProps {
  memories: Memory[];
  variant?: "grid" | "list";
  onMemoryClick?: (memory: Memory) => void;
  onMemoryEdit?: (memory: Memory) => void;
  onMemoryDelete?: (memory: Memory) => void;
  className?: string;
  emptyMessage?: string;
}

export function MemoryList({
  memories,
  variant = "grid",
  onMemoryClick,
  onMemoryEdit,
  onMemoryDelete,
  className,
  emptyMessage = "No memories found. Your knowledge base is empty.",
}: MemoryListProps) {
  if (memories.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "flex flex-col items-center justify-center py-16 text-center",
          className
        )}
      >
        <div className="mb-4 rounded-full bg-secondary/50 p-4">
          <Brain className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-sm max-w-sm">
          {emptyMessage}
        </p>
      </motion.div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: "easeOut" as const,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.2,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        variant === "grid"
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          : "flex flex-col gap-3",
        className
      )}
    >
      <AnimatePresence mode="popLayout">
        {memories.map((memory) => (
          <motion.div
            key={memory.id}
            variants={itemVariants}
            layout
            exit="exit"
          >
            <MemoryCard
              memory={memory}
              variant={variant === "list" ? "compact" : "expanded"}
              onClick={() => onMemoryClick?.(memory)}
              onEdit={() => onMemoryEdit?.(memory)}
              onDelete={() => onMemoryDelete?.(memory)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

export default MemoryList;
