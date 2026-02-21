
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { RitualCard, type Ritual, type RitualFrequency } from "./RitualCard";
import type { RitualAssignPayload } from "./RitualAssignDialog";
import { RefreshCw, Calendar, Clock } from "lucide-react";

interface RitualListProps {
  rituals: Ritual[];
  variant?: "expanded" | "compact";
  onToggle?: (ritual: Ritual) => void;
  onSettings?: (ritual: Ritual) => void;
  onAgentClick?: (ritual: Ritual) => void;
  onAssign?: (ritual: Ritual, payload: RitualAssignPayload) => void;
  agents?: Array<{
    id: string;
    name: string;
    role?: string;
    status?: string;
    description?: string;
    tags?: string[];
    currentTask?: string;
  }>;
  className?: string;
}

const frequencyOrder: RitualFrequency[] = ["hourly", "daily", "weekly", "monthly", "custom"];

const sectionConfig: Record<RitualFrequency, { title: string; icon: typeof RefreshCw; description: string }> = {
  hourly: {
    title: "Hourly Rituals",
    icon: Clock,
    description: "Runs every hour"
  },
  daily: {
    title: "Daily Rituals",
    icon: RefreshCw,
    description: "Runs every day at the scheduled time"
  },
  weekly: {
    title: "Weekly Rituals",
    icon: Calendar,
    description: "Runs once per week"
  },
  monthly: {
    title: "Monthly Rituals",
    icon: Calendar,
    description: "Runs once per month"
  },
  custom: {
    title: "Custom Rituals",
    icon: Clock,
    description: "Custom schedule configurations"
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut" as const,
    },
  },
};

export function RitualList({
  rituals,
  variant = "expanded",
  onToggle,
  onSettings,
  onAgentClick,
  onAssign,
  agents,
  className,
}: RitualListProps) {
  // Group rituals by frequency
  const grouped = rituals.reduce<Record<RitualFrequency, Ritual[]>>(
    (acc, ritual) => {
      if (!acc[ritual.frequency]) {
        acc[ritual.frequency] = [];
      }
      acc[ritual.frequency].push(ritual);
      return acc;
    },
    { hourly: [], daily: [], weekly: [], monthly: [], custom: [] }
  );

  // Filter out empty groups and sort by frequency order
  const sections = frequencyOrder
    .filter((freq) => grouped[freq].length > 0)
    .map((freq) => ({
      frequency: freq,
      rituals: grouped[freq].toSorted((a, b) => a.time.localeCompare(b.time)),
      ...sectionConfig[freq],
    }));

  if (rituals.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card/50 p-12 text-center",
          className
        )}
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <RefreshCw className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">No rituals yet</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Create your first ritual to automate recurring tasks with your agents.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn("space-y-8", className)}
    >
      {sections.map((section) => {
        const SectionIcon = section.icon;

        return (
          <motion.section key={section.frequency} variants={itemVariants}>
            {/* Section header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <SectionIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </div>
              <div className="ml-auto rounded-full bg-secondary px-3 py-1">
                <span className="text-sm font-medium text-muted-foreground">
                  {section.rituals.length} ritual{section.rituals.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Ritual cards grid */}
            <div className={cn(
              "grid gap-4",
              variant === "expanded"
                ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            )}>
              {section.rituals.map((ritual, index) => (
                <motion.div
                  key={ritual.id}
                  variants={itemVariants}
                  custom={index}
                >
                  <RitualCard
                    ritual={ritual}
                    variant={variant}
                    onToggle={() => onToggle?.(ritual)}
                    onSettings={() => onSettings?.(ritual)}
                    onAgentClick={() => onAgentClick?.(ritual)}
                    onAssign={(payload) => onAssign?.(ritual, payload)}
                    agents={agents}
                  />
                </motion.div>
              ))}
            </div>
          </motion.section>
        );
      })}
    </motion.div>
  );
}

export default RitualList;
