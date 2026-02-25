import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, Activity, AlertTriangle, ArrowUpRight, Server, Mic, Code } from "lucide-react";

export function ApiUsageDashboard() {
  const [timeRange, setTimeRange] = useState("week");

  // Mock data representing a unified view of ALL API usage (LLM + TTS + External APIs)
  const apiUsageData = [
    {
      id: "llm-core",
      name: "Core LLM Processing",
      provider: "OpenAI / Anthropic",
      icon: <Code className="w-5 h-5 text-blue-500" />,
      costUsd: 145.2,
      limitUsd: 500,
      calls: 12500,
      status: "healthy",
    },
    {
      id: "tts-elevenlabs",
      name: "Text-to-Speech",
      provider: "ElevenLabs",
      icon: <Mic className="w-5 h-5 text-purple-500" />,
      costUsd: 85.5,
      limitUsd: 100,
      calls: 4320,
      status: "warning",
    },
    {
      id: "nano-banana",
      name: "Nano Banana Compute",
      provider: "Banana.dev",
      icon: <Server className="w-5 h-5 text-green-500" />,
      costUsd: 12.4,
      limitUsd: 50,
      calls: 850,
      status: "healthy",
    },
    {
      id: "search-tavily",
      name: "Web Search",
      provider: "Tavily",
      icon: <ArrowUpRight className="w-5 h-5 text-orange-500" />,
      costUsd: 48.0,
      limitUsd: 50,
      calls: 9600,
      status: "critical",
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Usage & Cost Telemetry</h1>
          <p className="text-muted-foreground mt-2">
            Unified view of all external API costs, limits, and quotas across the platform.
          </p>
        </div>
        <select 
          className="border rounded-md px-3 py-1.5 bg-background"
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {/* High Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total API Spend</CardTitle>
            <BarChart className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$291.10</div>
            <p className="text-xs text-muted-foreground">Across 4 providers this {timeRange}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Budget Utilization</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">41.5%</div>
            <Progress value={41.5} className="mt-2" />
          </CardContent>
        </Card>
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Approaching Limits</CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">2 Services</div>
            <p className="text-xs text-orange-600">Search & TTS near weekly quotas</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Service Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Service Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {apiUsageData.map((service) => {
              const usagePercent = (service.costUsd / service.limitUsd) * 100;
              const isWarning = usagePercent > 80;
              const isCritical = usagePercent > 95;

              return (
                <div key={service.id} className="flex items-center space-x-4 border-b last:border-0 pb-4 last:pb-0">
                  <div className="p-2 bg-muted rounded-md">
                    {service.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold">{service.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {service.provider}
                        </Badge>
                      </div>
                      <div className="text-sm font-medium">
                        ${service.costUsd.toFixed(2)} / ${service.limitUsd}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Progress 
                        value={usagePercent} 
                        className={`h-2 flex-1 ${
                          isCritical ? "bg-red-200 [&>div]:bg-red-500" :
                          isWarning ? "bg-orange-200 [&>div]:bg-orange-500" : ""
                        }`}
                      />
                      <span className="text-xs text-muted-foreground w-20 text-right">
                        {service.calls.toLocaleString()} calls
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
