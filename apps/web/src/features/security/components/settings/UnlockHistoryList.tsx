"use client";

import * as React from "react";
// Format time relative to now without external dependency
function formatDistanceToNow(date: Date, options?: { addSuffix?: boolean }): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  let result: string;
  if (diffDay > 0) {
    result = diffDay === 1 ? "1 day" : `${diffDay} days`;
  } else if (diffHour > 0) {
    result = diffHour === 1 ? "1 hour" : `${diffHour} hours`;
  } else if (diffMin > 0) {
    result = diffMin === 1 ? "1 minute" : `${diffMin} minutes`;
  } else {
    result = "less than a minute";
  }

  return options?.addSuffix ? `${result} ago` : result;
}
import { History, CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useUnlockHistory } from "../../hooks/useUnlockHistory";
import type { UnlockEvent, UnlockFailureReason } from "../../types";

/**
 * Unlock history list with expandable view.
 */
export function UnlockHistoryList() {
  const [expanded, setExpanded] = React.useState(false);
  const { data, isLoading, error } = useUnlockHistory({ limit: expanded ? 50 : 10 });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Unlock History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Unlock History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Failed to load unlock history.
          </p>
        </CardContent>
      </Card>
    );
  }

  const events = data?.events ?? [];
  const total = data?.total ?? 0;
  const visibleEvents = expanded ? events : events.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Unlock History
        </CardTitle>
        <CardDescription>
          Recent unlock attempts for your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No unlock history yet.</p>
        ) : (
          <div className="space-y-2">
            {visibleEvents.map((event) => (
              <UnlockHistoryItem key={event.id} event={event} />
            ))}

            {total > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Show {Math.min(total - 5, 45)} more
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UnlockHistoryItem({ event }: { event: UnlockEvent }) {
  const timeAgo = formatDistanceToNow(new Date(event.ts), { addSuffix: true });

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        {event.success ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : event.failureReason === "locked_out" ? (
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
        ) : (
          <XCircle className="h-5 w-5 text-destructive" />
        )}

        <div>
          <p className="text-sm font-medium">
            {event.success ? "Successful unlock" : "Failed unlock attempt"}
          </p>
          <p className="text-xs text-muted-foreground">
            {timeAgo}
            {event.ipAddress && ` • ${event.ipAddress}`}
          </p>
        </div>
      </div>

      {!event.success && event.failureReason && (
        <Badge variant="secondary" className="text-xs">
          {getFailureLabel(event.failureReason)}
        </Badge>
      )}
    </div>
  );
}

function getFailureLabel(reason: UnlockFailureReason): string {
  switch (reason) {
    case "wrong_password":
      return "Wrong password";
    case "wrong_2fa":
      return "Wrong code";
    case "invalid_recovery_code":
      return "Invalid recovery";
    case "locked_out":
      return "Locked out";
    case "session_expired":
      return "Session expired";
    default:
      return "Failed";
  }
}

export default UnlockHistoryList;
