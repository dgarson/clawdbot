"use client";

import * as React from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DetailPanel } from "@/components/composed/DetailPanel";
import {
  Monitor,
  Smartphone,
  Tablet,
  Server,
  Laptop,
  Plus,
  Settings,
  Wifi,
  WifiOff,
  QrCode,
  Check,
  ChevronRight,
  Clock,
  Unlink,
  MessageSquare,
  Bell,
  Calendar,
  Brain,
} from "lucide-react";

export const Route = createFileRoute("/nodes/")({
  component: NodesPage,
});

type DeviceType = "desktop" | "laptop" | "mobile" | "tablet" | "server";
type DeviceStatus = "online" | "offline" | "syncing";

interface DeviceCapability {
  id: string;
  name: string;
  enabled: boolean;
  icon: React.ReactNode;
}

interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  lastSeen: Date;
  paired: Date;
  capabilities: string[];
  allowlist: string[];
}

// Mock device data
const initialDevices: Device[] = [
  {
    id: "1",
    name: "MacBook Pro",
    type: "laptop",
    status: "online",
    lastSeen: new Date(),
    paired: new Date(Date.now() - 2592000000),
    capabilities: ["messaging", "notifications", "calendar", "memory"],
    allowlist: ["send.message", "list.agents", "create.goal"],
  },
  {
    id: "2",
    name: "iPhone 15 Pro",
    type: "mobile",
    status: "online",
    lastSeen: new Date(Date.now() - 300000),
    paired: new Date(Date.now() - 1209600000),
    capabilities: ["messaging", "notifications"],
    allowlist: ["send.message"],
  },
  {
    id: "3",
    name: "iPad Pro",
    type: "tablet",
    status: "offline",
    lastSeen: new Date(Date.now() - 86400000),
    paired: new Date(Date.now() - 604800000),
    capabilities: ["messaging", "notifications", "calendar"],
    allowlist: ["send.message", "list.agents"],
  },
  {
    id: "4",
    name: "Home Server",
    type: "server",
    status: "syncing",
    lastSeen: new Date(Date.now() - 60000),
    paired: new Date(Date.now() - 5184000000),
    capabilities: ["messaging", "notifications", "calendar", "memory"],
    allowlist: ["*"],
  },
];

const allCapabilities: DeviceCapability[] = [
  { id: "messaging", name: "Messaging", enabled: false, icon: <MessageSquare className="h-4 w-4" /> },
  { id: "notifications", name: "Notifications", enabled: false, icon: <Bell className="h-4 w-4" /> },
  { id: "calendar", name: "Calendar Access", enabled: false, icon: <Calendar className="h-4 w-4" /> },
  { id: "memory", name: "Memory Sync", enabled: false, icon: <Brain className="h-4 w-4" /> },
];

const availableCommands = [
  "send.message",
  "list.agents",
  "create.goal",
  "update.goal",
  "trigger.ritual",
  "search.memory",
  "list.conversations",
  "create.reminder",
];

function NodesPage() {
  const powerUserMode = useUIStore((s) => s.powerUserMode);
  const [devices, setDevices] = React.useState<Device[]>(initialDevices);
  const [selectedDevice, setSelectedDevice] = React.useState<Device | null>(null);
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const [isPairingOpen, setIsPairingOpen] = React.useState(false);
  const [pairingStep, setPairingStep] = React.useState(1);
  const [pairingCode, setPairingCode] = React.useState("");
  const [unpairDialogOpen, setUnpairDialogOpen] = React.useState(false);
  const [deviceToUnpair, setDeviceToUnpair] = React.useState<Device | null>(null);
  const [baseNow] = React.useState(() => Date.now());

  // Config panel state
  const [configName, setConfigName] = React.useState("");
  const [configCapabilities, setConfigCapabilities] = React.useState<string[]>([]);
  const [configAllowlist, setConfigAllowlist] = React.useState("");

  if (!powerUserMode) {
    return <Navigate to="/" />;
  }

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case "desktop":
        return <Monitor className="h-6 w-6" />;
      case "laptop":
        return <Laptop className="h-6 w-6" />;
      case "mobile":
        return <Smartphone className="h-6 w-6" />;
      case "tablet":
        return <Tablet className="h-6 w-6" />;
      case "server":
        return <Server className="h-6 w-6" />;
    }
  };

  const getStatusBadge = (status: DeviceStatus) => {
    switch (status) {
      case "online":
        return (
          <Badge variant="success" className="gap-1">
            <Wifi className="h-3 w-3" />
            Online
          </Badge>
        );
      case "offline":
        return (
          <Badge variant="secondary" className="gap-1">
            <WifiOff className="h-3 w-3" />
            Offline
          </Badge>
        );
      case "syncing":
        return (
          <Badge className="gap-1">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Wifi className="h-3 w-3" />
            </motion.div>
            Syncing
          </Badge>
        );
    }
  };

  const formatLastSeen = (date: Date) => {
    const diff = baseNow - date.getTime();
    if (diff < 60000) {return "Just now";}
    if (diff < 3600000) {return `${Math.floor(diff / 60000)}m ago`;}
    if (diff < 86400000) {return `${Math.floor(diff / 3600000)}h ago`;}
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const openConfig = (device: Device) => {
    setSelectedDevice(device);
    setConfigName(device.name);
    setConfigCapabilities([...device.capabilities]);
    setConfigAllowlist(device.allowlist.join("\n"));
    setIsConfigOpen(true);
  };

  const saveConfig = () => {
    if (!selectedDevice) {return;}

    setDevices((prev) =>
      prev.map((d) =>
        d.id === selectedDevice.id
          ? {
              ...d,
              name: configName,
              capabilities: configCapabilities,
              allowlist: configAllowlist.split("\n").filter(Boolean),
            }
          : d
      )
    );
    setIsConfigOpen(false);
    setSelectedDevice(null);
  };

  const toggleCapability = (capId: string) => {
    setConfigCapabilities((prev) =>
      prev.includes(capId)
        ? prev.filter((c) => c !== capId)
        : [...prev, capId]
    );
  };

  const startPairing = () => {
    setPairingCode(Math.random().toString(36).substring(2, 8).toUpperCase());
    setPairingStep(1);
    setIsPairingOpen(true);
  };

  const confirmPairing = () => {
    setPairingStep(2);
    // Simulate pairing delay
    setTimeout(() => setPairingStep(3), 2000);
  };

  const finishPairing = () => {
    const newDevice: Device = {
      id: `device-${Date.now()}`,
      name: "New Device",
      type: "mobile",
      status: "online",
      lastSeen: new Date(),
      paired: new Date(),
      capabilities: ["messaging", "notifications"],
      allowlist: ["send.message"],
    };
    setDevices((prev) => [...prev, newDevice]);
    setIsPairingOpen(false);
    setPairingStep(1);
  };

  const confirmUnpair = (device: Device) => {
    setDeviceToUnpair(device);
    setUnpairDialogOpen(true);
  };

  const handleUnpair = () => {
    if (deviceToUnpair) {
      setDevices((prev) => prev.filter((d) => d.id !== deviceToUnpair.id));
      setUnpairDialogOpen(false);
      setDeviceToUnpair(null);
      if (selectedDevice?.id === deviceToUnpair.id) {
        setIsConfigOpen(false);
        setSelectedDevice(null);
      }
    }
  };

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Monitor className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                  Connected Nodes
                </h1>
                <p className="text-muted-foreground">
                  Manage paired devices and their capabilities
                </p>
              </div>
            </div>
            <Button onClick={startPairing} className="gap-2">
              <Plus className="h-4 w-4" />
              Pair Device
            </Button>
          </div>
        </motion.div>

        {/* Device Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {devices.map((device) => (
              <motion.div
                key={device.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                <Card
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    device.status === "offline" && "opacity-70"
                  )}
                  onClick={() => openConfig(device)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-xl",
                            device.status === "online"
                              ? "bg-success/10 text-success"
                              : device.status === "syncing"
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                          )}
                        >
                          {getDeviceIcon(device.type)}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{device.name}</CardTitle>
                          <CardDescription className="capitalize">
                            {device.type}
                          </CardDescription>
                        </div>
                      </div>
                      {getStatusBadge(device.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Last Seen */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Last seen {formatLastSeen(device.lastSeen)}</span>
                    </div>

                    {/* Capabilities */}
                    <div className="flex flex-wrap gap-1">
                      {device.capabilities.map((cap) => (
                        <Badge key={cap} variant="secondary" className="text-xs">
                          {cap}
                        </Badge>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openConfig(device);
                        }}
                        className="gap-1"
                      >
                        <Settings className="h-4 w-4" />
                        Configure
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Device Config Panel */}
        <DetailPanel
          open={isConfigOpen}
          onClose={() => setIsConfigOpen(false)}
          title="Device Configuration"
          width="lg"
        >
          {selectedDevice && (
            <div className="space-y-6">
              {/* Device Info */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <div
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-xl",
                    selectedDevice.status === "online"
                      ? "bg-success/10 text-success"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {getDeviceIcon(selectedDevice.type)}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{selectedDevice.name}</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {selectedDevice.type} - Paired{" "}
                    {selectedDevice.paired.toLocaleDateString()}
                  </div>
                </div>
                {getStatusBadge(selectedDevice.status)}
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="device-name">Device Name</Label>
                <Input
                  id="device-name"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  placeholder="Enter device name"
                />
              </div>

              {/* Capabilities */}
              <div className="space-y-3">
                <Label>Capabilities</Label>
                <div className="space-y-2">
                  {allCapabilities.map((cap) => (
                    <div
                      key={cap.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                          {cap.icon}
                        </div>
                        <span className="font-medium">{cap.name}</span>
                      </div>
                      <Switch
                        checked={configCapabilities.includes(cap.id)}
                        onCheckedChange={() => toggleCapability(cap.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Command Allowlist */}
              <div className="space-y-2">
                <Label htmlFor="allowlist">Command Allowlist</Label>
                <div className="text-xs text-muted-foreground mb-2">
                  Enter one command per line. Use * to allow all commands.
                </div>
                <Textarea
                  id="allowlist"
                  value={configAllowlist}
                  onChange={(e) => setConfigAllowlist(e.target.value)}
                  placeholder="send.message\nlist.agents"
                  className="font-mono text-sm min-h-[120px]"
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {availableCommands.map((cmd) => (
                    <Button
                      key={cmd}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        const current = configAllowlist.split("\n").filter(Boolean);
                        if (!current.includes(cmd)) {
                          setConfigAllowlist([...current, cmd].join("\n"));
                        }
                      }}
                    >
                      {cmd}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => confirmUnpair(selectedDevice)}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Unlink className="h-4 w-4" />
                  Unpair Device
                </Button>
                <Button onClick={saveConfig}>Save Changes</Button>
              </div>
            </div>
          )}
        </DetailPanel>

        {/* Pairing Wizard Modal */}
        <Dialog open={isPairingOpen} onOpenChange={setIsPairingOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Pair New Device</DialogTitle>
              <DialogDescription>
                {pairingStep === 1 && "Enter this code on your device to pair"}
                {pairingStep === 2 && "Waiting for device confirmation..."}
                {pairingStep === 3 && "Device paired successfully!"}
              </DialogDescription>
            </DialogHeader>

            <div className="py-6">
              <AnimatePresence mode="wait">
                {pairingStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    {/* QR Code placeholder */}
                    <div className="flex flex-col items-center">
                      <div className="flex h-48 w-48 items-center justify-center rounded-xl border-2 border-dashed bg-muted">
                        <QrCode className="h-24 w-24 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground mt-4">
                        Scan QR code or enter code manually
                      </p>
                    </div>

                    {/* Pairing Code */}
                    <div className="text-center">
                      <div className="text-3xl font-mono font-bold tracking-widest text-primary">
                        {pairingCode}
                      </div>
                    </div>
                  </motion.div>
                )}

                {pairingStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex flex-col items-center py-8"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    >
                      <Wifi className="h-16 w-16 text-primary" />
                    </motion.div>
                    <p className="text-muted-foreground mt-4">
                      Confirming pairing...
                    </p>
                  </motion.div>
                )}

                {pairingStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center py-8"
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
                      <Check className="h-10 w-10 text-success" />
                    </div>
                    <p className="text-lg font-medium mt-4">
                      Device Paired Successfully!
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You can now configure device capabilities
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <DialogFooter>
              {pairingStep === 1 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsPairingOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={confirmPairing}>
                    Device Ready
                  </Button>
                </>
              )}
              {pairingStep === 3 && (
                <Button onClick={finishPairing} className="w-full">
                  Configure Device
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unpair Confirmation Dialog */}
        <Dialog open={unpairDialogOpen} onOpenChange={setUnpairDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unpair Device</DialogTitle>
              <DialogDescription>
                Are you sure you want to unpair{" "}
                <span className="font-medium text-foreground">
                  {deviceToUnpair?.name}
                </span>
                ? You will need to pair it again to restore access.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setUnpairDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleUnpair}>
                Unpair
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
