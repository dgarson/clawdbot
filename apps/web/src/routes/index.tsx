
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
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
import { AgentActivityFeed } from "@/components/domain/home/AgentActivityFeed";
import { useUserProfile } from "@/hooks/queries/useUserSettings";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function getGreetingKey(): { key: string; icon: typeof Sun } {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return { key: "home.goodMorning", icon: Sunrise };
  } else if (hour >= 12 && hour < 17) {
    return { key: "home.goodAfternoon", icon: Sun };
  } else if (hour >= 17 && hour < 21) {
    return { key: "home.goodEvening", icon: Sunset };
  } else {
    return { key: "home.goodNight", icon: Moon };
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const greeting = getGreetingKey();
  const GreetingIcon = greeting.icon;
  const { data: profile } = useUserProfile();
  const displayName = profile?.name || "there";

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
                  {t(greeting.key)}, {displayName}!
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

          {/* Agent Activity Feed — real-time view of what agents are doing */}
          <motion.div variants={itemVariants} className="lg:col-span-1">
            <AgentActivityFeed maxItems={8} />
          </motion.div>
        </div>
    </motion.div>
  );
}
