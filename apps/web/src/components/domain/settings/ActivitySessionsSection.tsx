"use client";

import * as React from "react";
import {
  Activity,
  Monitor,
  Smartphone,
  Tablet,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ActivitySessionsSectionProps {
  className?: string;
}

// Mock session data
const mockSessions = [
  {
    id: "1",
    device: "Chrome on MacOS",
    icon: Monitor,
    location: "San Francisco, CA",
    lastActive: new Date(),
    isCurrent: true,
  },
  {
    id: "2",
    device: "Safari on iPhone",
    icon: Smartphone,
    location: "San Francisco, CA",
    lastActive: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    isCurrent: false,
  },
  {
    id: "3",
    device: "Chrome on iPad",
    icon: Tablet,
    location: "Los Angeles, CA",
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    isCurrent: false,
  },
];

// Mock activity log
const mockActivity = [
  { id: "1", action: "Signed in", timestamp: new Date() },
  { id: "2", action: "Updated profile", timestamp: new Date(Date.now() - 1000 * 60 * 15) },
  { id: "3", action: "Changed theme to dark mode", timestamp: new Date(Date.now() - 1000 * 60 * 60) },
  { id: "4", action: "Created new agent 'Assistant'", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) },
  { id: "5", action: "Enabled notifications for rituals", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24) },
];

export function ActivitySessionsSection({ className }: ActivitySessionsSectionProps) {
  const [showHistory, setShowHistory] = React.useState(false);

  const handleSignOutSession = (sessionId: string) => {
    // In a real implementation, this would call an API
    console.log("Sign out session:", sessionId);
  };

  const handleSignOutAll = () => {
    // In a real implementation, this would call an API
    console.log("Sign out all sessions");
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <CardTitle>Activity & Sessions</CardTitle>
        <CardDescription>
          View your active sessions and recent activity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active Sessions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium mb-1">Active Sessions</h4>
              <p className="text-sm text-muted-foreground">
                Devices currently signed into your account.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOutAll}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out all
            </Button>
          </div>

          <div className="space-y-3">
            {mockSessions.map((session) => {
              const Icon = session.icon;
              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-background p-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{session.device}</p>
                        {session.isCurrent && (
                          <Badge variant="secondary" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {session.location} · {formatDistanceToNow(session.lastActive, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSignOutSession(session.id)}
                    >
                      Sign out
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Recent Activity */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-1">Recent Activity</h4>
            <p className="text-sm text-muted-foreground">
              Your recent account activity.
            </p>
          </div>

          <div className="space-y-2">
            {mockActivity.slice(0, 3).map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-3">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{activity.action}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>

          {/* Login History (Expandable) */}
          <div className="border-t pt-4">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  showHistory && "rotate-180"
                )}
              />
              Login History
            </button>

            {showHistory && (
              <div className="mt-4 space-y-2">
                {mockActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="text-muted-foreground">{activity.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {activity.timestamp.toLocaleDateString()} at {activity.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ActivitySessionsSection;
