"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccessibility, useUpdateAccessibility } from "@/hooks/queries/useUserSettings";

interface AccessibilitySectionProps {
  className?: string;
}

export function AccessibilitySection({ className }: AccessibilitySectionProps) {
  const { data: accessibility } = useAccessibility();
  const updateMutation = useUpdateAccessibility();
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const handleToggle = (field: "reduceMotion" | "highContrast" | "showKeyboardHints" | "screenReaderOptimized") => {
    updateMutation.mutate({ [field]: !accessibility?.[field] });
  };

  const handleFontSizeChange = (value: string) => {
    updateMutation.mutate({
      fontSize: value as "default" | "large" | "extra-large",
    });
  };

  const isSaving = updateMutation.isPending;

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle>Accessibility</CardTitle>
        <CardDescription>
          Customize the interface to work better for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reduce Motion */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5 flex-1">
            <Label htmlFor="reduce-motion" className="cursor-pointer">
              Reduce motion
            </Label>
            <p className="text-xs text-muted-foreground">
              Minimize animations and transitions throughout the interface
            </p>
          </div>
          <Switch
            id="reduce-motion"
            checked={accessibility?.reduceMotion ?? false}
            disabled={isSaving}
            onCheckedChange={() => handleToggle("reduceMotion")}
          />
        </div>

        {/* High Contrast */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5 flex-1">
            <Label htmlFor="high-contrast" className="cursor-pointer">
              Increase contrast
            </Label>
            <p className="text-xs text-muted-foreground">
              Use higher contrast colors for better visibility
            </p>
          </div>
          <Switch
            id="high-contrast"
            checked={accessibility?.highContrast ?? false}
            disabled={isSaving}
            onCheckedChange={() => handleToggle("highContrast")}
          />
        </div>

        {/* Font Size */}
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Text Size</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Adjust the size of text throughout the interface
            </p>
          </div>
          <Tabs
            value={accessibility?.fontSize || "default"}
            onValueChange={handleFontSizeChange}
          >
            <TabsList className="w-full">
              <TabsTrigger value="default" className="flex-1" disabled={isSaving}>
                Default
              </TabsTrigger>
              <TabsTrigger value="large" className="flex-1" disabled={isSaving}>
                Large
              </TabsTrigger>
              <TabsTrigger value="extra-large" className="flex-1" disabled={isSaving}>
                Extra Large
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Keyboard Hints */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5 flex-1">
            <Label htmlFor="keyboard-hints" className="cursor-pointer">
              Show keyboard shortcuts
            </Label>
            <p className="text-xs text-muted-foreground">
              Display keyboard shortcut hints in menus and tooltips
            </p>
          </div>
          <Switch
            id="keyboard-hints"
            checked={accessibility?.showKeyboardHints ?? true}
            disabled={isSaving}
            onCheckedChange={() => handleToggle("showKeyboardHints")}
          />
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
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="screen-reader" className="cursor-pointer">
                    Optimize for screen readers
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Add additional context and landmarks for assistive technology
                  </p>
                </div>
                <Switch
                  id="screen-reader"
                  checked={accessibility?.screenReaderOptimized ?? false}
                  disabled={isSaving}
                  onCheckedChange={() => handleToggle("screenReaderOptimized")}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default AccessibilitySection;
