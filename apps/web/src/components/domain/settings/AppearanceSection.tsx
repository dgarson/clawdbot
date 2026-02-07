"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/composed/ThemeToggle";
import { useAppearance, useUpdateAppearance } from "@/hooks/queries/useUserSettings";

interface AppearanceSectionProps {
  className?: string;
}

const dateFormats = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (12/31/2024)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/12/2024)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2024-12-31)" },
];

const timeFormats = [
  { value: "12h", label: "12-hour (2:30 PM)" },
  { value: "24h", label: "24-hour (14:30)" },
];

export function AppearanceSection({ className }: AppearanceSectionProps) {
  const { data: appearance } = useAppearance();
  const updateMutation = useUpdateAppearance();

  const handleSidebarDefaultChange = (checked: boolean) => {
    updateMutation.mutate({ sidebarCollapsedDefault: checked });
  };

  const handleDateFormatChange = (value: string) => {
    updateMutation.mutate({
      dateFormat: value as "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD",
    });
  };

  const handleTimeFormatChange = (value: string) => {
    updateMutation.mutate({ timeFormat: value as "12h" | "24h" });
  };

  const isSaving = updateMutation.isPending;

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize how the application looks and displays information.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-1">Theme</h4>
            <p className="text-sm text-muted-foreground">
              Choose how the application looks on your device.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Label>Color Mode</Label>
            <ThemeToggle variant="buttons" />
          </div>
        </div>

        <Separator />

        {/* Layout */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-1">Layout</h4>
            <p className="text-sm text-muted-foreground">
              Configure the default layout behavior.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="sidebar-collapsed" className="cursor-pointer">
                Start with sidebar collapsed
              </Label>
              <p className="text-xs text-muted-foreground">
                Sidebar will be collapsed by default when you open the app
              </p>
            </div>
            <Switch
              id="sidebar-collapsed"
              checked={appearance?.sidebarCollapsedDefault ?? false}
              disabled={isSaving}
              onCheckedChange={handleSidebarDefaultChange}
            />
          </div>
        </div>

        <Separator />

        {/* Date & Time Format */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-1">Date & Time</h4>
            <p className="text-sm text-muted-foreground">
              Set your preferred date and time display formats.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Date Format</Label>
              <Select
                value={appearance?.dateFormat || "MM/DD/YYYY"}
                onValueChange={handleDateFormatChange}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {dateFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time Format</Label>
              <Select
                value={appearance?.timeFormat || "12h"}
                onValueChange={handleTimeFormatChange}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {timeFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AppearanceSection;
