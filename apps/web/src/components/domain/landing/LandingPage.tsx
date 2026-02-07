"use client";

import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Brain,
  Shield,
  Zap,
  CheckCircle2,
  ArrowRight,
  Bot,
  ListTodo,
  Eye,
  Clock,
  Lock,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const FEATURES = [
  {
    icon: Bot,
    title: "Agents that act on your behalf",
    description:
      "Define agents with clear roles, connect your tools, and let them handle multi-step work autonomously.",
  },
  {
    icon: Shield,
    title: "Approval gates you control",
    description:
      "Sensitive actions pause for your review. You decide what runs automatically and what needs a sign-off.",
  },
  {
    icon: ListTodo,
    title: "Workstreams, not chat threads",
    description:
      "Track ongoing projects with structured progress, not endless message histories.",
  },
  {
    icon: Brain,
    title: "Memory that compounds",
    description:
      "Your agents learn preferences, context, and patterns over time so you repeat yourself less.",
  },
  {
    icon: Zap,
    title: "Automations on a schedule",
    description:
      "Set up recurring tasks -- research, reports, monitoring -- that run on your schedule without manual triggers.",
  },
  {
    icon: Eye,
    title: "Full visibility into what happened",
    description:
      "Every action is logged with reasoning. Audit, replay, and understand exactly what your agents did and why.",
  },
] as const;

const TRUST_POINTS = [
  {
    icon: Lock,
    text: "Approval gates for sensitive actions",
  },
  {
    icon: Clock,
    text: "A clear history of what happened and why",
  },
  {
    icon: Pause,
    text: "Pause or stop automation at any time",
  },
] as const;

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav bar */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              S
            </div>
            <span className="font-semibold text-foreground">Clawdbrain</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/unlock">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/onboarding">
                Get started
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <motion.section
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="mx-auto max-w-4xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28 sm:pb-20"
      >
        <motion.div variants={fadeUp}>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Your second brain,
            <br />
            <span className="text-primary">always working</span>
          </h1>
        </motion.div>
        <motion.p
          variants={fadeUp}
          className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
        >
          Clawdbrain is an AI-powered agent platform that handles research,
          drafts, planning, and automation -- with approval gates that keep you
          in control.
        </motion.p>
        <motion.div
          variants={fadeUp}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <Button size="lg" asChild>
            <Link to="/onboarding">
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link to="/unlock">Open console</Link>
          </Button>
        </motion.div>
      </motion.section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((feature) => (
            <motion.div key={feature.title} variants={fadeUp}>
              <Card className="h-full border-border/50 bg-card/50 transition-colors hover:border-primary/20 hover:bg-card">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="size-5 text-primary" />
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Trust section */}
      <section className="border-t border-border/40 bg-muted/30">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20"
        >
          <motion.h2
            variants={fadeUp}
            className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            Built for trust, not just speed
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-xl text-muted-foreground"
          >
            Automation should not mean losing oversight. Every action your agents
            take is transparent, auditable, and under your control.
          </motion.p>
          <motion.div
            variants={stagger}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-8"
          >
            {TRUST_POINTS.map((point) => (
              <motion.div
                key={point.text}
                variants={fadeUp}
                className="flex items-center gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <point.icon className="size-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {point.text}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Set up your Gateway, configure your first agent, and let Clawdbrain
            handle the rest.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" asChild>
              <Link to="/onboarding">
                Start setup
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="lg" asChild>
              <Link to="/unlock">I already have a Gateway</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/20">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground text-[10px] font-bold">
              S
            </div>
            <span>Clawdbrain</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <a
              href="https://docs.clawdbrain.bot"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Documentation
            </a>
            <CheckCircle2 className="size-3" />
            <span>Self-hosted. Your data stays yours.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
