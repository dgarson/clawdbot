"use client";

import { MessageSquare } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelConfig } from "@/components/domain/config";

interface ChannelsSectionProps {
  className?: string;
}

export function ChannelsSection({ className }: ChannelsSectionProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-primary" />
            Messaging Channels
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Connect your messaging platforms to communicate with your AI agents.
            Messages from connected channels are routed to your configured agents.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Channel Config Grid */}
      <ChannelConfig />
    </div>
  );
}

export default ChannelsSection;
