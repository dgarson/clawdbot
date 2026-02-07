"use client";

import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Calendar, Sun, Moon, Sunrise, Sunset } from "lucide-react";
import { useUIStore } from "@/stores/useUIStore";
import { ModeToggle } from "@/components/composed/ModeToggle";
import {
  QuickChatBox,
  TeamAgentGrid,
  ActiveWorkstreamsSection,
  UpcomingRitualsPanel,
  GoalProgressPanel,
  RecentMemoriesPanel,
  SuggestedStarters,
  RecentWork,
  ApprovalsInbox,
  StatusIndicator,
} from "@/components/domain/home";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function getGreeting(): { text: string; icon: typeof Sun } {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return { text: "Good morning", icon: Sunrise };
  } else if (hour >= 12 && hour < 17) {
    return { text: "Good afternoon", icon: Sun };
  } else if (hour >= 17 && hour < 21) {
    return { text: "Good evening", icon: Sunset };
  } else {
    return { text: "Good night", icon: Moon };
  }
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function HomePage() {
  const navigate = useNavigate();
  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;
  const powerUserMode = useUIStore((s) => s.powerUserMode);
  const [, setComposerValue] = React.useState("");

  const handleQuickChatSend = (message: string, agentId: string) => {
    const sessionKey = `session-${Date.now()}`;
    navigate({
      to: "/agents/$agentId/session/$sessionKey",
      params: { agentId, sessionKey },
      search: { newSession: true, initialMessage: message },
    });
  };

  const handleChatWithAgent = (agentId: string) => {
    navigate({
      to: "/agents/$agentId/session/$sessionKey",
      params: { agentId, sessionKey: "current" },
      search: { newSession: false },
    });
  };

  const handleStarterSelect = (prompt: string) => {
    setComposerValue(prompt);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header Section */}
      <motion.header variants={itemVariants} className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <GreetingIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {greeting.text}
              </h1>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate()}</span>
                </div>
                <StatusIndicator />
              </div>
            </div>
          </div>
          <ModeToggle />
        </div>
      </motion.header>

      {/* Approvals inbox - prominent when there are pending approvals */}
      <motion.div variants={itemVariants} className="mb-6">
        <ApprovalsInbox />
      </motion.div>

      {/* Primary action: "Start a task" composer */}
      <motion.div variants={itemVariants} className="mb-6">
        <QuickChatBox onSend={handleQuickChatSend} />
      </motion.div>

      {/* Suggested starters (always visible, more useful in Simple mode) */}
      {!powerUserMode && (
        <motion.div variants={itemVariants} className="mb-8">
          <SuggestedStarters onSelect={handleStarterSelect} />
        </motion.div>
      )}

      {/* Recent work */}
      <motion.div variants={itemVariants} className="mb-8">
        <RecentWork maxItems={3} />
      </motion.div>

      {/* Advanced mode: full dashboard panels */}
      {powerUserMode && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Team Agents */}
          <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-2">
            <TeamAgentGrid
              maxAgents={6}
              onChatWithAgent={handleChatWithAgent}
            />
          </motion.div>

          {/* Active Workstreams */}
          <motion.div variants={itemVariants} className="lg:col-span-1">
            <ActiveWorkstreamsSection maxWorkstreams={4} />
          </motion.div>

          {/* Goal Progress */}
          <motion.div variants={itemVariants} className="lg:col-span-1">
            <GoalProgressPanel maxGoals={4} />
          </motion.div>

          {/* Upcoming Rituals */}
          <motion.div variants={itemVariants} className="lg:col-span-1">
            <UpcomingRitualsPanel maxRituals={4} />
          </motion.div>

          {/* Recent Memories */}
          <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-2">
            <RecentMemoriesPanel maxMemories={5} />
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
