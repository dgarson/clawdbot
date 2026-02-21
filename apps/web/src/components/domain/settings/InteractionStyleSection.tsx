"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInteractionStyle, useUpdateInteractionStyle } from "@/hooks/queries/useUserSettings";

interface InteractionStyleSectionProps {
  className?: string;
}

export function InteractionStyleSection({ className }: InteractionStyleSectionProps) {
  const { data: interactionStyle } = useInteractionStyle();
  const updateMutation = useUpdateInteractionStyle();
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const handleToneChange = (value: string) => {
    updateMutation.mutate({ tone: value as "casual" | "balanced" | "professional" });
  };

  const handleVerbosityChange = (value: string) => {
    updateMutation.mutate({ verbosity: value as "brief" | "balanced" | "detailed" });
  };

  const handleToggle = (field: "useAnalogies" | "proactive") => {
    updateMutation.mutate({ [field]: !interactionStyle?.[field] });
  };

  const handleTechnicalLevelChange = (value: number[]) => {
    updateMutation.mutate({ technicalLevel: value[0] });
  };

  const isSaving = updateMutation.isPending;

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle>Interaction Style</CardTitle>
        <CardDescription>Customize how your agents communicate with you.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Conversation Tone */}
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Conversation Tone</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              How formal should your agents be?
            </p>
          </div>
          <Tabs
            value={interactionStyle?.tone || "balanced"}
            onValueChange={handleToneChange}
          >
            <TabsList className="w-full">
              <TabsTrigger value="casual" className="flex-1" disabled={isSaving}>
                Casual
              </TabsTrigger>
              <TabsTrigger value="balanced" className="flex-1" disabled={isSaving}>
                Balanced
              </TabsTrigger>
              <TabsTrigger value="professional" className="flex-1" disabled={isSaving}>
                Professional
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Response Detail */}
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Response Detail</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              How much detail should responses include?
            </p>
          </div>
          <Tabs
            value={interactionStyle?.verbosity || "balanced"}
            onValueChange={handleVerbosityChange}
          >
            <TabsList className="w-full">
              <TabsTrigger value="brief" className="flex-1" disabled={isSaving}>
                Brief
              </TabsTrigger>
              <TabsTrigger value="balanced" className="flex-1" disabled={isSaving}>
                Balanced
              </TabsTrigger>
              <TabsTrigger value="detailed" className="flex-1" disabled={isSaving}>
                Detailed
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="use-analogies" className="cursor-pointer">
                Explain with examples
              </Label>
              <p className="text-xs text-muted-foreground">
                Use analogies and examples to explain complex concepts
              </p>
            </div>
            <Switch
              id="use-analogies"
              checked={interactionStyle?.useAnalogies ?? true}
              disabled={isSaving}
              onCheckedChange={() => handleToggle("useAnalogies")}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="proactive" className="cursor-pointer">
                Offer suggestions
              </Label>
              <p className="text-xs text-muted-foreground">
                Proactively suggest next steps and related tasks
              </p>
            </div>
            <Switch
              id="proactive"
              checked={interactionStyle?.proactive ?? true}
              disabled={isSaving}
              onCheckedChange={() => handleToggle("proactive")}
            />
          </div>
        </div>

        {/* Advanced Section */}
        <div className="border-t pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                showAdvanced && "rotate-180"
              )}
            />
            Advanced Settings
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Technical Level</Label>
                  <span className="text-xs text-muted-foreground">
                    {interactionStyle?.technicalLevel ?? 50}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Adjust the technical depth of explanations
                </p>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground shrink-0">Simple</span>
                  <Slider
                    value={[interactionStyle?.technicalLevel ?? 50]}
                    onValueChange={handleTechnicalLevelChange}
                    max={100}
                    step={5}
                    disabled={isSaving}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">Technical</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default InteractionStyleSection;
