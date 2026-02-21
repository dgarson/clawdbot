"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { PartyPopper, ArrowRight, Rocket, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuccessStepProps {
  onGoToDashboard: () => void;
  onStartChat: () => void;
}

// Confetti particle component
function ConfettiParticle({
  delay,
  x,
  drift,
  color,
}: {
  delay: number;
  x: number;
  drift: number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ y: -20, x, opacity: 1, rotate: 0 }}
      animate={{
        y: 400,
        opacity: 0,
        rotate: 360,
        x: x + drift,
      }}
      transition={{
        duration: 2.5,
        delay,
        ease: "easeOut",
      }}
      className="absolute top-0 pointer-events-none"
      style={{ left: "50%" }}
    >
      <div
        className="w-3 h-3 rounded-sm"
        style={{ backgroundColor: color }}
      />
    </motion.div>
  );
}

const confettiColors = [
  "#22c55e", // green
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#06b6d4", // cyan
];

export function SuccessStep({ onGoToDashboard, onStartChat }: SuccessStepProps) {
  const [showConfetti, setShowConfetti] = React.useState(true);
  const [confettiParticles] = React.useState(() =>
    Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      delay: i * 0.05,
      x: (Math.random() - 0.5) * 300,
      drift: (Math.random() - 0.5) * 100,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
    }))
  );

  React.useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          {confettiParticles.map((particle) => (
            <ConfettiParticle
              key={particle.id}
              delay={particle.delay}
              x={particle.x}
              drift={particle.drift}
              color={particle.color}
            />
          ))}
        </div>
      )}

      {/* Success Icon */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", duration: 0.8 }}
        className="mb-8 relative"
      >
        <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-xl">
          <PartyPopper className="h-12 w-12 text-white" />
        </div>
        <motion.div
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: 3, duration: 0.5, delay: 0.5 }}
          className="absolute -inset-3 rounded-3xl bg-green-500/30 -z-10 blur-xl"
        />
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-3 mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          You're All Set!
        </h1>
        <p className="text-lg text-muted-foreground max-w-md">
          Clawdbrain is ready to help you be more productive. Let's get started!
        </p>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-2 gap-4 mb-10 w-full max-w-sm"
      >
        <div className="p-4 rounded-xl bg-muted/30 text-center">
          <div className="text-2xl font-bold text-foreground">1</div>
          <div className="text-xs text-muted-foreground">Agent Ready</div>
        </div>
        <div className="p-4 rounded-xl bg-muted/30 text-center">
          <div className="text-2xl font-bold text-foreground">Unlimited</div>
          <div className="text-xs text-muted-foreground">Possibilities</div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <Button size="lg" onClick={onGoToDashboard} className="px-6">
          <Rocket className="h-4 w-4" />
          Go to Dashboard
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={onStartChat}
          className="px-6"
        >
          <MessageSquare className="h-4 w-4" />
          Start a Conversation
        </Button>
      </motion.div>

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-10 text-sm text-muted-foreground"
      >
        <p>
          Tip: Use <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Cmd+K</kbd> to quickly access commands
        </p>
      </motion.div>
    </div>
  );
}

export default SuccessStep;
