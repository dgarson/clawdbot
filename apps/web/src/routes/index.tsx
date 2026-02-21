"use client";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Calendar, Sun, Moon, Sunrise, Sunset } from "lucide-react";

import {
  QuickChatBox,
  TeamAgentGrid,
  ActiveWorkstreamsSection,
  UpcomingRitualsPanel,
  GoalProgressPanel,
  RecentMemoriesPanel,
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

  const handleQuickChatSend = (message: string, agentId: string) => {
    // Navigate to new session with agent, passing the message
    const sessionKey = `session-${Date.now()}`;
    navigate({
      to: "/agents/$agentId/session/$sessionKey",
      params: { agentId, sessionKey },
      search: { newSession: true, initialMessage: message },
    });
  };

  const handleChatWithAgent = (agentId: string) => {
    // Navigate to the current session for the agent
    navigate({
      to: "/agents/$agentId/session/$sessionKey",
      params: { agentId, sessionKey: "current" },
      search: { newSession: false },
    });
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
        {/* Header Section */}
        <motion.header variants={itemVariants} className="mb-8">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <GreetingIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {greeting.text}, User!
                </h1>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate()}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Quick Chat - Full width on small, 1 col on larger */}
          <motion.div variants={itemVariants} className="lg:col-span-1">
            <QuickChatBox onSend={handleQuickChatSend} />
          </motion.div>

          {/* Team Agents - Takes 2 columns on large screens */}
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

          {/* Recent Memories - Full width on medium, 2 cols on large */}
          <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-2">
            <RecentMemoriesPanel maxMemories={5} />
          </motion.div>

          {/* Additional space for future widgets */}
          <motion.div variants={itemVariants} className="lg:col-span-1">
            {/* Placeholder for future widget - could be activity feed, notifications, etc. */}
          </motion.div>
        </div>
    </motion.div>
  );
}
