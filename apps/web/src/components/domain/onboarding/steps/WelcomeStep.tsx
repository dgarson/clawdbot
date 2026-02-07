"use client";

import { motion } from "framer-motion";
import { Sparkles, Brain, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeStepProps {
  onContinue: () => void;
}

const features = [
  {
    icon: Brain,
    title: "Smart Agents",
    description: "AI assistants that learn and adapt to your needs",
  },
  {
    icon: Zap,
    title: "Powerful Workflows",
    description: "Automate tasks and boost your productivity",
  },
  {
    icon: Shield,
    title: "Secure by Design",
    description: "Your data stays private and under your control",
  },
];

export function WelcomeStep({ onContinue }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4">
      {/* Logo/Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.6 }}
        className="mb-8"
      >
        <div className="relative">
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-xl">
            <Sparkles className="h-12 w-12 text-primary-foreground" />
          </div>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -inset-2 rounded-3xl bg-primary/20 -z-10 blur-xl"
          />
        </div>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3 mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Welcome to Clawdbrain
        </h1>
        <p className="text-lg text-muted-foreground max-w-md">
          Your personal AI-powered second brain. Let us help you get set up in just a few steps.
        </p>
      </motion.div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 w-full max-w-2xl"
      >
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="flex flex-col items-center p-4 rounded-xl bg-muted/30"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-medium text-sm">{feature.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {feature.description}
              </p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <Button size="lg" onClick={onContinue} className="px-8">
          Get Started
          <Sparkles className="h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
}

export default WelcomeStep;
