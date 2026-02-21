"use client";

import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/composed/ThemeToggle";
import { useAgentStore } from "@/stores/useAgentStore";
import { useUserPreferences } from "@/hooks/queries";
import { useUpdatePreferences, useUpdateNotification } from "@/hooks/mutations";

interface PreferencesSectionProps {
  className?: string;
}

const timezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Central European Time (CET)" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST)" },
  { value: "Asia/Shanghai", label: "China Standard Time (CST)" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AET)" },
];

const languages = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
];

export function PreferencesSection({ className }: PreferencesSectionProps) {
  const { agents } = useAgentStore();
  const { data: preferences, isLoading, error } = useUserPreferences();
  const updatePreferencesMutation = useUpdatePreferences();
  const updateNotificationMutation = useUpdateNotification();

  const handleNotificationToggle = (id: string, currentEnabled: boolean) => {
    updateNotificationMutation.mutate({
      id,
      enabled: !currentEnabled,
    });
  };

  const handleTimezoneChange = (value: string) => {
    updatePreferencesMutation.mutate({ timezone: value });
  };

  const handleLanguageChange = (value: string) => {
    updatePreferencesMutation.mutate({ language: value });
  };

  const handleDefaultAgentChange = (value: string) => {
    updatePreferencesMutation.mutate({ defaultAgentId: value });
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Customize your experience with theme, notifications, and other settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Theme Section Skeleton */}
          <div className="space-y-4">
            <div>
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>

          <Separator />

          {/* Notifications Section Skeleton */}
          <div className="space-y-4">
            <div>
              <Skeleton className="h-4 w-28 mb-1" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                  <Skeleton className="h-6 w-11 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Default Agent Section Skeleton */}
          <div className="space-y-4">
            <div>
              <Skeleton className="h-4 w-28 mb-1" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-64" />
          </div>

          <Separator />

          {/* Regional Settings Skeleton */}
          <div className="space-y-4">
            <div>
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-4 w-56" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn("", className)}>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Customize your experience with theme, notifications, and other settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load preferences. Please try refreshing the page.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const isSaving = updatePreferencesMutation.isPending || updateNotificationMutation.isPending;

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>
          Customize your experience with theme, notifications, and other settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Theme Section */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-1">Appearance</h4>
            <p className="text-sm text-muted-foreground">
              Choose how the application looks on your device.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Label>Theme</Label>
            <ThemeToggle variant="buttons" />
          </div>
        </div>

        <Separator />

        {/* Notifications Section */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-1">Notifications</h4>
            <p className="text-sm text-muted-foreground">
              Configure how and when you receive notifications.
            </p>
          </div>
          <div className="space-y-4">
            {preferences?.notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex items-center justify-between gap-4"
              >
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor={notification.id} className="cursor-pointer">
                    {notification.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {notification.description}
                  </p>
                </div>
                <Switch
                  id={notification.id}
                  checked={notification.enabled}
                  disabled={isSaving}
                  onCheckedChange={() => handleNotificationToggle(notification.id, notification.enabled)}
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Default Agent Section */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-1">Default Agent</h4>
            <p className="text-sm text-muted-foreground">
              Select which agent to use for new conversations by default.
            </p>
          </div>
          <Select
            value={preferences?.defaultAgentId || ""}
            onValueChange={handleDefaultAgentChange}
            disabled={isSaving}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Select default agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.length === 0 ? (
                <SelectItem value="none" disabled>
                  No agents available
                </SelectItem>
              ) : (
                agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Timezone Section */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-1">Regional Settings</h4>
            <p className="text-sm text-muted-foreground">
              Set your timezone and language preferences.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={preferences?.timezone || "America/Los_Angeles"}
                onValueChange={handleTimezoneChange}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={preferences?.language || "en"}
                onValueChange={handleLanguageChange}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                More languages coming soon.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PreferencesSection;
