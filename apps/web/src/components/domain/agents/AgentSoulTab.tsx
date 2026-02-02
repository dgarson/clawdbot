"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Brain,
  Sparkles,
  Heart,
  Lightbulb,
  Save,
  RotateCcw,
  Code,
  Eye,
} from "lucide-react";

interface AgentSoulTabProps {
  agentId: string;
}

interface PersonalityState {
  formality: number;
  verbosity: number;
  tone: number;
  creativity: number;
  coreValues: string[];
  backgroundContext: string;
}

const CORE_VALUES = [
  "Accuracy",
  "Creativity",
  "Efficiency",
  "Empathy",
  "Humor",
  "Thoroughness",
  "Brevity",
  "Curiosity",
  "Patience",
  "Proactivity",
  "Clarity",
  "Innovation",
] as const;

export function AgentSoulTab({ agentId }: AgentSoulTabProps) {
  void agentId;
  const [showRaw, setShowRaw] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);

  const [personality, setPersonality] = React.useState<PersonalityState>({
    formality: 50,
    verbosity: 60,
    tone: 40,
    creativity: 70,
    coreValues: ["Accuracy", "Efficiency", "Clarity"],
    backgroundContext: `You are a helpful AI assistant focused on research and analysis.

Key behaviors:
- Always cite sources when providing information
- Ask clarifying questions when requests are ambiguous
- Break down complex topics into understandable parts
- Proactively suggest related topics of interest`,
  });

  const handleSliderChange = (key: keyof PersonalityState, value: number[]) => {
    setPersonality((prev) => ({ ...prev, [key]: value[0] }));
    setHasChanges(true);
  };

  const toggleCoreValue = (value: string) => {
    setPersonality((prev) => ({
      ...prev,
      coreValues: prev.coreValues.includes(value)
        ? prev.coreValues.filter((v) => v !== value)
        : [...prev.coreValues, value],
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // Save personality settings
    setHasChanges(false);
  };

  const handleReset = () => {
    setPersonality({
      formality: 50,
      verbosity: 60,
      tone: 40,
      creativity: 70,
      coreValues: ["Accuracy", "Efficiency", "Clarity"],
      backgroundContext: "",
    });
    setHasChanges(true);
  };

  const getSliderLabel = (value: number, lowLabel: string, highLabel: string) => {
    if (value < 35) {return lowLabel;}
    if (value > 65) {return highLabel;}
    return "Balanced";
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Personality Editor</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Personality Sliders */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Communication Style
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Formality Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Formality</Label>
              <Badge variant="secondary" className="text-xs">
                {getSliderLabel(personality.formality, "Formal", "Casual")}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Formal</span>
                <span>Casual</span>
              </div>
              <Slider
                value={[personality.formality]}
                onValueChange={(v) => handleSliderChange("formality", v)}
                max={100}
                step={1}
              />
            </div>
          </div>

          {/* Verbosity Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Detail Level</Label>
              <Badge variant="secondary" className="text-xs">
                {getSliderLabel(personality.verbosity, "Concise", "Detailed")}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Concise</span>
                <span>Detailed</span>
              </div>
              <Slider
                value={[personality.verbosity]}
                onValueChange={(v) => handleSliderChange("verbosity", v)}
                max={100}
                step={1}
              />
            </div>
          </div>

          {/* Tone Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Tone</Label>
              <Badge variant="secondary" className="text-xs">
                {getSliderLabel(personality.tone, "Serious", "Playful")}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Serious</span>
                <span>Playful</span>
              </div>
              <Slider
                value={[personality.tone]}
                onValueChange={(v) => handleSliderChange("tone", v)}
                max={100}
                step={1}
              />
            </div>
          </div>

          {/* Creativity Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Creativity</Label>
              <Badge variant="secondary" className="text-xs">
                {getSliderLabel(personality.creativity, "Conservative", "Creative")}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Conservative</span>
                <span>Creative</span>
              </div>
              <Slider
                value={[personality.creativity]}
                onValueChange={(v) => handleSliderChange("creativity", v)}
                max={100}
                step={1}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core Values */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="h-4 w-4 text-primary" />
            Core Values
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Select the values that guide this agent's behavior and decision-making.
          </p>
          <div className="flex flex-wrap gap-2">
            {CORE_VALUES.map((value) => (
              <motion.div
                key={value}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Badge
                  variant={
                    personality.coreValues.includes(value) ? "default" : "outline"
                  }
                  className={cn(
                    "cursor-pointer transition-all px-3 py-1",
                    personality.coreValues.includes(value) &&
                      "bg-primary hover:bg-primary/90"
                  )}
                  onClick={() => toggleCoreValue(value)}
                >
                  {value}
                </Badge>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Background Context */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-primary" />
              Background Context
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="raw-toggle" className="text-xs text-muted-foreground">
                Raw Markdown
              </Label>
              <Switch
                id="raw-toggle"
                checked={showRaw}
                onCheckedChange={setShowRaw}
                size="sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Provide additional context, instructions, and behavioral guidelines for
            the agent.
          </p>
          {showRaw ? (
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <Badge variant="secondary" className="text-xs gap-1">
                  <Code className="h-3 w-3" />
                  Markdown
                </Badge>
              </div>
              <Textarea
                value={personality.backgroundContext}
                onChange={(e) => {
                  setPersonality((prev) => ({
                    ...prev,
                    backgroundContext: e.target.value,
                  }));
                  setHasChanges(true);
                }}
                placeholder="Enter background context and instructions..."
                rows={12}
                className="font-mono text-sm"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <Textarea
                value={personality.backgroundContext}
                onChange={(e) => {
                  setPersonality((prev) => ({
                    ...prev,
                    backgroundContext: e.target.value,
                  }));
                  setHasChanges(true);
                }}
                placeholder="Enter background context and instructions..."
                rows={8}
              />
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Preview
                  </span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-foreground/80 bg-transparent p-0 m-0">
                    {personality.backgroundContext || "No context provided yet."}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AgentSoulTab;
