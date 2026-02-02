"use client";

import * as React from "react";
import { createLazyFileRoute, Navigate } from "@tanstack/react-router";
import { PlugZap, Plug, Trash2, Terminal as TerminalIcon } from "lucide-react";

import { useUIStore } from "@/stores/useUIStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { WebTerminalRef } from "@/components/composed/WebTerminal";
import { OpenClawEventBus, OpenClawGatewayClient, type OpenClawEvents } from "@/integrations/openclaw";
import { Loader2 } from "lucide-react";

// Lazy-load WebTerminal and all xterm dependencies
const LazyWebTerminal = React.lazy(() =>
  import("@/components/composed/WebTerminal").then((mod) => ({
    default: mod.WebTerminal,
  }))
);

export const Route = createLazyFileRoute("/debug/terminal")({
  component: DebugTerminalPage,
});

function DebugTerminalPage() {
  const powerUserMode = useUIStore((s) => s.powerUserMode);
  const terminalRef = React.useRef<WebTerminalRef | null>(null);
  const eventBusRef = React.useRef<OpenClawEventBus>(new OpenClawEventBus());
  const clientRef = React.useRef<OpenClawGatewayClient | null>(null);
  const inputBufferRef = React.useRef("");

  const [gatewayUrl, setGatewayUrl] = React.useState("ws://127.0.0.1:18789");
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    if (!powerUserMode) {return;}
    terminalRef.current?.writeln("Clawdbrain Debug Terminal");
    terminalRef.current?.writeln("Commands:");
    terminalRef.current?.writeln("  /connect  - connect to OpenClaw gateway");
    terminalRef.current?.writeln("  /disconnect");
    terminalRef.current?.writeln("  /clear");
    terminalRef.current?.writeln("");
    terminalRef.current?.write("> ");
  }, [powerUserMode]);

  React.useEffect(() => {
    if (!powerUserMode) {return;}
    const bus = eventBusRef.current;

    const onConnected = (_e: OpenClawEvents["gateway:connected"]) => {
      void _e;
      setConnected(true);
      terminalRef.current?.writeln("");
      terminalRef.current?.writeln(`[gateway] connected (${gatewayUrl})`);
      terminalRef.current?.write("> ");
    };

    const onDisconnected = (_e: OpenClawEvents["gateway:disconnected"]) => {
      void _e;
      setConnected(false);
      terminalRef.current?.writeln("");
      terminalRef.current?.writeln("[gateway] disconnected");
      terminalRef.current?.write("> ");
    };

    const onMessage = (e: OpenClawEvents["gateway:message"]) => {
      terminalRef.current?.writeln("");
      terminalRef.current?.writeln(`[gateway] ${JSON.stringify(e.data ?? e, null, 0)}`);
      terminalRef.current?.write("> ");
    };

    bus.on("gateway:connected", onConnected);
    bus.on("gateway:disconnected", onDisconnected);
    bus.on("gateway:message", onMessage);

    return () => {
      bus.off("gateway:connected", onConnected);
      bus.off("gateway:disconnected", onDisconnected);
      bus.off("gateway:message", onMessage);
    };
  }, [gatewayUrl, powerUserMode]);

  const connect = React.useCallback(async () => {
    const bus = eventBusRef.current;
    if (!bus) {return;}

    terminalRef.current?.writeln("");
    terminalRef.current?.writeln(`[gateway] connecting... (${gatewayUrl})`);

    clientRef.current?.disconnect();
    clientRef.current = new OpenClawGatewayClient(bus, { url: gatewayUrl });

    try {
      await clientRef.current.connect();
    } catch (err) {
      setConnected(false);
      terminalRef.current?.writeln(`[gateway] connect error: ${err instanceof Error ? err.message : String(err)}`);
      terminalRef.current?.write("> ");
    }
  }, [gatewayUrl]);

  const disconnect = React.useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setConnected(false);
    terminalRef.current?.writeln("");
    terminalRef.current?.writeln("[gateway] disconnected (manual)");
    terminalRef.current?.write("> ");
  }, []);

  const runCommand = React.useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {return;}

      if (trimmed === "/clear") {
        terminalRef.current?.clear();
        terminalRef.current?.writeln("Clawdbrain Debug Terminal");
        terminalRef.current?.write("> ");
        return;
      }

      if (trimmed === "/connect") {
        await connect();
        return;
      }

      if (trimmed === "/disconnect") {
        disconnect();
        return;
      }

      terminalRef.current?.writeln(`\nunknown command: ${trimmed}`);
      terminalRef.current?.write("> ");
    },
    [connect, disconnect]
  );

  const onTerminalData = React.useCallback(
    (data: string) => {
      // Ignore escape sequences (arrows, etc)
      if (data.startsWith("\u001b")) {return;}

      // Enter
      if (data === "\r") {
        const line = inputBufferRef.current;
        inputBufferRef.current = "";
        terminalRef.current?.writeln("");
        void runCommand(line);
        return;
      }

      // Backspace
      if (data === "\u007f") {
        if (inputBufferRef.current.length === 0) {return;}
        inputBufferRef.current = inputBufferRef.current.slice(0, -1);
        terminalRef.current?.write("\b \b");
        return;
      }

      // Printable
      inputBufferRef.current += data;
      terminalRef.current?.write(data);
    },
    [runCommand]
  );

  if (!powerUserMode) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <TerminalIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold">Terminal</h1>
                <Badge variant={connected ? "success" : "secondary"}>
                  {connected ? "Connected" : "Disconnected"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Minimal xterm.js wrapper wired to OpenClaw gateway events.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => terminalRef.current?.clear()} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
            {connected ? (
              <Button variant="destructive" onClick={disconnect} className="gap-2">
                <Plug className="h-4 w-4" />
                Disconnect
              </Button>
            ) : (
              <Button onClick={() => void connect()} className="gap-2">
                <PlugZap className="h-4 w-4" />
                Connect
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Input
            value={gatewayUrl}
            onChange={(e) => setGatewayUrl(e.target.value)}
            placeholder="ws://127.0.0.1:18789"
          />
          <Button variant="outline" onClick={() => terminalRef.current?.fit()}>
            Fit
          </Button>
        </div>

        <React.Suspense
          fallback={
            <div className="flex items-center justify-center bg-background rounded-lg border border-border" style={{ height: 520 }}>
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-sm text-muted-foreground">Loading terminal...</div>
              </div>
            </div>
          }
        >
          <LazyWebTerminal
            ref={terminalRef}
            height={520}
            welcomeMessage={undefined}
            onData={onTerminalData}
          />
        </React.Suspense>
      </div>
    </div>
  );
}
