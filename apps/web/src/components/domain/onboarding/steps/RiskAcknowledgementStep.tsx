"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ExternalLink, Shield, Zap, UserCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

interface RiskAcknowledgementStepProps {
  accepted: boolean;
  onAcceptChange: (accepted: boolean) => void;
}

const riskPoints = [
  {
    icon: Zap,
    text: "AI agents can execute actions on your behalf, including modifying files and accessing external services.",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
  {
    icon: Shield,
    text: "While we implement safeguards, AI responses may occasionally be inaccurate or unexpected.",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
  },
  {
    icon: UserCheck,
    text: "You retain full control and responsibility for the actions performed by your agents.",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20",
  },
];

export function RiskAcknowledgementStep({
  accepted,
  onAcceptChange,
}: RiskAcknowledgementStepProps) {
  return (
    <div className="flex flex-col items-center">
      {/* Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="mb-4 lg:mb-6"
      >
        <div className="h-14 w-14 lg:h-16 lg:w-16 rounded-2xl bg-warning/10 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 lg:h-8 lg:w-8 text-warning" />
        </div>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center space-y-1.5 lg:space-y-2 mb-4 lg:mb-6"
      >
        <h2 className="text-2xl lg:text-3xl font-bold tracking-tight">
          Before We Begin
        </h2>
        <p className="text-sm lg:text-base text-muted-foreground max-w-md lg:max-w-xl">
          Please review and acknowledge the following to continue.
        </p>
      </motion.div>

      {/* Risk Points - Individual mini-cards with icons */}
      <div className="w-full max-w-lg lg:max-w-2xl mb-4 lg:mb-5 space-y-2 lg:space-y-3">
        {riskPoints.map((point, index) => {
          const Icon = point.icon;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
            >
              <Card className={`border-2 ${point.borderColor} ${point.bgColor} backdrop-blur-sm`}>
                <CardContent className="p-3 lg:p-4">
                  <div className="flex gap-3 items-start">
                    <div className={`h-9 w-9 lg:h-10 lg:w-10 rounded-lg ${point.bgColor} border ${point.borderColor} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 lg:h-5 lg:w-5 ${point.color}`} />
                    </div>
                    <div className="flex-1 pt-0.5 lg:pt-1">
                      <p className="text-sm lg:text-base text-foreground leading-snug font-medium">
                        {point.text}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Acknowledgement Checkbox */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="w-full max-w-lg lg:max-w-2xl"
      >
        <label
          className="flex items-start gap-3 p-3 lg:p-4 rounded-lg border border-border bg-card cursor-pointer hover:bg-accent/5 transition-colors"
        >
          <Checkbox
            id="acknowledge"
            checked={accepted}
            onCheckedChange={onAcceptChange}
            className="mt-0.5"
          />
          <div className="space-y-0.5 lg:space-y-1">
            <Label htmlFor="acknowledge" className="text-sm lg:text-base font-medium cursor-pointer">
              I understand and accept these terms
            </Label>
            <p className="text-xs lg:text-sm text-muted-foreground">
              By checking this box, you acknowledge the nature of AI-assisted operations.
            </p>
          </div>
        </label>
      </motion.div>

      {/* Learn More Link */}
      <motion.a
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        href="#"
        className="mt-4 lg:mt-5 text-xs lg:text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
      >
        Learn more about AI safety
        <ExternalLink className="h-3 w-3" />
      </motion.a>
    </div>
  );
}

export default RiskAcknowledgementStep;
