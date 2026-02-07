"use client";

import * as React from "react";
import { AlertCircle, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUserPreferences } from "@/hooks/queries";
import { useUpdateNotification } from "@/hooks/mutations";
import { useNotificationSettings, useUpdateNotificationSettings } from "@/hooks/queries/useUserSettings";

interface NotificationsSectionProps {
  className?: string;
}

const digestFrequencies = [
  { value: "immediately", label: "Immediately" },
  { value: "daily", label: "Daily digest" },
  { value: "weekly", label: "Weekly digest" },
];

export function NotificationsSection({ className }: NotificationsSectionProps) {
  const { data: preferences, isLoading, error } = useUserPreferences();
  const { data: settings } = useNotificationSettings();
  const updateNotificationMutation = useUpdateNotification();
  const updateSettingsMutation = useUpdateNotificationSettings();
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const handleNotificationToggle = (id: string, currentEnabled: boolean) => {
    updateNotificationMutation.mutate({
      id,
      enabled: !currentEnabled,
    });
  };

  const handleSettingToggle = (field: "emailEnabled" | "soundEnabled" | "pauseDuringQuietHours") => {
    updateSettingsMutation.mutate({ [field]: !settings?.[field] });
  };

  const handleDigestFrequencyChange = (value: string) => {
    updateSettingsMutation.mutate({
      digestFrequency: value as "immediately" | "daily" | "weekly",
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Configure how and when you receive notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn("", className)}>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Configure how and when you receive notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load notification settings. Please try refreshing the page.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const isSaving = updateNotificationMutation.isPending || updateSettingsMutation.isPending;

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          Configure how and when you receive notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Notification Types */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-1">Notification Types</h4>
            <p className="text-sm text-muted-foreground">
              Choose which notifications you want to receive.
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

        {/* Delivery Settings */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-1">Delivery</h4>
            <p className="text-sm text-muted-foreground">
              How should notifications be delivered?
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="email-notifications" className="cursor-pointer">
                  Also send to email
                </Label>
                <p className="text-xs text-muted-foreground">
                  Receive important notifications via email
                </p>
              </div>
              <Switch
                id="email-notifications"
                checked={settings?.emailEnabled ?? false}
                disabled={isSaving}
                onCheckedChange={() => handleSettingToggle("emailEnabled")}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="sound-notifications" className="cursor-pointer">
                  Play sounds
                </Label>
                <p className="text-xs text-muted-foreground">
                  Play a sound when notifications arrive
                </p>
              </div>
              <Switch
                id="sound-notifications"
                checked={settings?.soundEnabled ?? true}
                disabled={isSaving}
                onCheckedChange={() => handleSettingToggle("soundEnabled")}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="quiet-hours" className="cursor-pointer">
                  Pause during quiet hours
                </Label>
                <p className="text-xs text-muted-foreground">
                  Don't show notifications during your quiet hours
                </p>
              </div>
              <Switch
                id="quiet-hours"
                checked={settings?.pauseDuringQuietHours ?? false}
                disabled={isSaving}
                onCheckedChange={() => handleSettingToggle("pauseDuringQuietHours")}
              />
            </div>
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
              <div className="space-y-2">
                <Label>Summary Frequency</Label>
                <Select
                  value={settings?.digestFrequency || "immediately"}
                  onValueChange={handleDigestFrequencyChange}
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {digestFrequencies.map((freq) => (
                      <SelectItem key={freq.value} value={freq.value}>
                        {freq.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How often to receive notification summaries
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default NotificationsSection;
