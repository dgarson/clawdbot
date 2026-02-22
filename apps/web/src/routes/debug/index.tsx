
import * as React from "react";
import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bug,
  RefreshCw,
  Play,
  Pause,
  Download,
	  Search,
	  Activity,
    LayoutGrid,
	  Cpu,
	  HardDrive,
	  Clock,
    Terminal as TerminalIcon,
	  CheckCircle,
	  XCircle,
	  AlertCircle,
	} from "lucide-react";

export const Route = createFileRoute("/debug/")({
  component: DebugPage,
});

// Mock data for system status
const systemServices = [
  {
    id: "gateway",
    name: "Gateway",
    status: "healthy" as const,
    latency: 12,
    lastCheck: new Date().toISOString(),
  },
  {
    id: "database",
    name: "Database",
    status: "healthy" as const,
    latency: 45,
    lastCheck: new Date().toISOString(),
  },
  {
    id: "cache",
    name: "Cache",
    status: "degraded" as const,
    latency: 8,
    lastCheck: new Date().toISOString(),
  },
];

// Mock RPC methods
const rpcMethods = [
  "agent.list",
  "agent.get",
  "agent.create",
  "conversation.list",
  "conversation.get",
  "goal.list",
  "goal.create",
  "memory.search",
  "ritual.trigger",
  "system.health",
];

// Mock event types
const eventTypes = [
  "agent.started",
  "agent.completed",
  "agent.error",
  "conversation.created",
  "goal.updated",
  "ritual.executed",
  "system.alert",
];

// Mock log levels
const logLevels = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
type LogLevel = (typeof logLevels)[number];

interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  source: string;
}

interface EventEntry {
  id: string;
  timestamp: Date;
  type: string;
  data: Record<string, unknown>;
}

function DebugPage() {
  const powerUserMode = useUIStore((s) => s.powerUserMode);

  if (!powerUserMode) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
	          <div className="flex items-center gap-3 mb-2">
	            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
	              <Bug className="h-6 w-6 text-primary" />
	            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Debug Console
              </h1>
	              <p className="text-muted-foreground">
	                System diagnostics and debugging tools
	              </p>
	            </div>
	          </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="secondary" size="sm" className="gap-2">
                <Link to="/debug/terminal">
                  <TerminalIcon className="h-4 w-4" />
                  Terminal
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm" className="gap-2">
                <Link to="/debug/graph">
                  <Activity className="h-4 w-4" />
                  Graph
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm" className="gap-2">
                <Link to="/debug/workbench">
                  <LayoutGrid className="h-4 w-4" />
                  Workbench
                </Link>
              </Button>
            </div>
	        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="health" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="rpc">RPC</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="health">
            <HealthTab />
          </TabsContent>

          <TabsContent value="rpc">
            <RPCTab />
          </TabsContent>

          <TabsContent value="events">
            <EventsTab />
          </TabsContent>

          <TabsContent value="logs">
            <LogsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Health Tab Component
function HealthTab() {
  const [services, setServices] = React.useState(systemServices);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [memoryUsage] = React.useState(68);
  const [cpuUsage] = React.useState(42);
  const [diskUsage] = React.useState(55);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setServices(
      services.map((s) => ({
        ...s,
        lastCheck: new Date().toISOString(),
        latency: Math.floor(Math.random() * 50) + 5,
      }))
    );
    setIsRefreshing(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "degraded":
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case "unhealthy":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge variant="success">Healthy</Badge>;
      case "degraded":
        return <Badge variant="warning">Degraded</Badge>;
      case "unhealthy":
        return <Badge variant="error">Unhealthy</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Service Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {services.map((service) => (
          <Card key={service.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(service.status)}
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                </div>
                {getStatusBadge(service.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Latency</span>
                <span className="font-medium">{service.latency}ms</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Check</span>
                <span className="font-medium">
                  {new Date(service.lastCheck).toLocaleTimeString()}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Resources */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg">CPU Usage</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={cpuUsage} className="h-2" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current</span>
              <span className="font-medium">{cpuUsage}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg">Memory Usage</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={memoryUsage} className="h-2" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current</span>
              <span className="font-medium">{memoryUsage}%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-lg">Disk Usage</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={diskUsage} className="h-2" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current</span>
              <span className="font-medium">{diskUsage}%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// RPC Tab Component
function RPCTab() {
  const [selectedMethod, setSelectedMethod] = React.useState(rpcMethods[0]);
  const [params, setParams] = React.useState("{}");
  const [response, setResponse] = React.useState<string | null>(null);
  const [timing, setTiming] = React.useState<number | null>(null);
  const [isExecuting, setIsExecuting] = React.useState(false);

  const handleExecute = async () => {
    setIsExecuting(true);
    const startTime = performance.now();

    // Simulate RPC call
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));

    const endTime = performance.now();
    setTiming(Math.round(endTime - startTime));

    // Mock response
    const mockResponse = {
      success: true,
      method: selectedMethod,
      result: {
        id: "mock-id-123",
        timestamp: new Date().toISOString(),
        data: JSON.parse(params || "{}"),
      },
    };

    setResponse(JSON.stringify(mockResponse, null, 2));
    setIsExecuting(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Request Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Request</CardTitle>
          <CardDescription>Configure and execute RPC methods</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Method</Label>
            <Select value={selectedMethod} onValueChange={setSelectedMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {rpcMethods.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Parameters (JSON)</Label>
            <Textarea
              value={params}
              onChange={(e) => setParams(e.target.value)}
              placeholder='{"key": "value"}'
              className="font-mono text-sm min-h-[200px]"
            />
          </div>

          <Button
            onClick={handleExecute}
            disabled={isExecuting}
            className="w-full gap-2"
          >
            {isExecuting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Execute
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Response Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Response</CardTitle>
              <CardDescription>Method execution result</CardDescription>
            </div>
            {timing !== null && (
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                {timing}ms
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] rounded-lg border bg-muted/30 p-4">
            {response ? (
              <pre className="text-sm font-mono whitespace-pre-wrap">
                {response}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Execute a method to see the response
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// Events Tab Component
function EventsTab() {
  const [events, setEvents] = React.useState<EventEntry[]>([]);
  const [isPaused, setIsPaused] = React.useState(false);
  const [selectedTypes, setSelectedTypes] = React.useState<string[]>(eventTypes);

  // Simulate real-time events
  React.useEffect(() => {
    if (isPaused) {return;}

    const interval = setInterval(() => {
      const newEvent: EventEntry = {
        id: `event-${Date.now()}`,
        timestamp: new Date(),
        type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
        data: {
          agentId: `agent-${Math.floor(Math.random() * 1000)}`,
          duration: Math.floor(Math.random() * 5000),
        },
      };
      setEvents((prev) => [newEvent, ...prev].slice(0, 100));
    }, 2000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const filteredEvents = events.filter((e) => selectedTypes.includes(e.type));

  const getEventTypeColor = (type: string) => {
    if (type.includes("error")) {return "destructive";}
    if (type.includes("completed")) {return "success";}
    if (type.includes("started")) {return "default";}
    return "secondary";
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <Button
                variant={isPaused ? "default" : "outline"}
                onClick={() => setIsPaused(!isPaused)}
                className="gap-2"
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4" />
                    Pause
                  </>
                )}
              </Button>
              <span className="text-sm text-muted-foreground">
                {filteredEvents.length} events
              </span>
            </div>

            <Select
              value={selectedTypes.join(",")}
              onValueChange={(value) => setSelectedTypes(value.split(","))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={eventTypes.join(",")}>All Events</SelectItem>
                {eventTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Event Stream */}
      <Card>
        <CardHeader>
          <CardTitle>Event Stream</CardTitle>
          <CardDescription>Real-time system events</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {filteredEvents.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  Waiting for events...
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={getEventTypeColor(event.type) as "default" | "secondary" | "destructive"}>
                          {event.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {event.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <pre className="text-xs font-mono text-muted-foreground truncate">
                        {JSON.stringify(event.data)}
                      </pre>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// Logs Tab Component
function LogsTab() {
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [selectedLevel, setSelectedLevel] = React.useState<LogLevel | "all">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [tailMode, setTailMode] = React.useState(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Simulate log entries
  React.useEffect(() => {
    const mockLogs: LogEntry[] = Array.from({ length: 50 }, (_, i) => ({
      id: `log-${i}`,
      timestamp: new Date(Date.now() - (50 - i) * 1000),
      level: logLevels[Math.floor(Math.random() * logLevels.length)],
      message: `Sample log message ${i + 1} - ${["Processing request", "Cache hit", "Database query", "API call completed", "User authenticated"][Math.floor(Math.random() * 5)]}`,
      source: ["gateway", "database", "cache", "api", "auth"][Math.floor(Math.random() * 5)],
    }));
    setLogs(mockLogs);
  }, []);

  // Auto-scroll in tail mode
  React.useEffect(() => {
    if (tailMode && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, tailMode]);

  const filteredLogs = logs.filter((log) => {
    if (selectedLevel !== "all" && log.level !== selectedLevel) {return false;}
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleExport = () => {
    const content = filteredLogs
      .map((log) => `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case "trace":
        return "text-muted-foreground";
      case "debug":
        return "text-blue-500";
      case "info":
        return "text-green-500";
      case "warn":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
      case "fatal":
        return "text-red-700 font-bold";
      default:
        return "text-foreground";
    }
  };

  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case "trace":
      case "debug":
        return "secondary";
      case "info":
        return "success";
      case "warn":
        return "warning";
      case "error":
      case "fatal":
        return "error";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs..."
                className="pl-10"
              />
            </div>

            <Select
              value={selectedLevel}
              onValueChange={(v) => setSelectedLevel(v as LogLevel | "all")}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Log level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {logLevels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch
                id="tail-mode"
                checked={tailMode}
                onCheckedChange={setTailMode}
              />
              <Label htmlFor="tail-mode" className="text-sm">
                Tail Mode
              </Label>
            </div>

            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Log Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Log Entries</CardTitle>
          <CardDescription>
            Showing {filteredLogs.length} of {logs.length} entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]" ref={scrollRef}>
            <div className="selectable-text space-y-1 font-mono text-sm">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 p-2 rounded hover:bg-muted/50 transition-colors"
                >
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                  <Badge
                    variant={getLevelBadge(log.level) as "secondary" | "success" | "warning" | "error"}
                    className="text-xs uppercase"
                  >
                    {log.level}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    [{log.source}]
                  </span>
                  <span className={cn("flex-1", getLevelColor(log.level))}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
