"use client";

import * as React from "react";
import type { OpenClawEvents, ToolCallEventData, WorkflowCallbacks } from "./openclaw";
import { OpenClawEventBus, OpenClawGatewayClient, registerWorkflowCallbacks } from "./openclaw";

const OpenClawContext = React.createContext<{
  eventBus: OpenClawEventBus;
  gateway: OpenClawGatewayClient | null;
} | null>(null);

export function OpenClawProvider({
  children,
  gatewayUrl,
  gatewayToken,
  autoConnect = true,
}: {
  children: React.ReactNode;
  gatewayUrl?: string;
  gatewayToken?: string;
  autoConnect?: boolean;
}) {
  const eventBus = React.useMemo(() => new OpenClawEventBus(), []);
  const [gateway, setGateway] = React.useState<OpenClawGatewayClient | null>(null);

  React.useEffect(() => {
    const client = new OpenClawGatewayClient(eventBus, {
      url: gatewayUrl,
      token: gatewayToken,
    });
    setGateway(client);

    if (autoConnect) {
      client.connect().catch((e) => console.error("[OpenClaw] connect failed:", e));
    }

    return () => client.disconnect();
  }, [eventBus, gatewayUrl, gatewayToken, autoConnect]);

  return <OpenClawContext.Provider value={{ eventBus, gateway }}>{children}</OpenClawContext.Provider>;
}

export function useOpenClawEvents() {
  const ctx = React.useContext(OpenClawContext);
  if (!ctx) {throw new Error("useOpenClawEvents must be used within OpenClawProvider");}
  return ctx.eventBus;
}

export function useOpenClawGateway() {
  const ctx = React.useContext(OpenClawContext);
  if (!ctx) {throw new Error("useOpenClawGateway must be used within OpenClawProvider");}
  return ctx.gateway;
}

export function useOptionalOpenClawEvents() {
  return React.useContext(OpenClawContext)?.eventBus ?? null;
}

export function useOptionalOpenClawGateway() {
  return React.useContext(OpenClawContext)?.gateway ?? null;
}

export function useOpenClawEvent<K extends keyof OpenClawEvents>(
  event: K,
  handler: (data: OpenClawEvents[K]) => void
) {
  const eventBus = useOpenClawEvents();
  const handlerRef = React.useRef(handler);

  React.useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  React.useEffect(() => {
    const wrapped = (data: OpenClawEvents[K]) => handlerRef.current(data);
    eventBus.on(event, wrapped);
    return () => {
      eventBus.off(event, wrapped);
    };
  }, [eventBus, event]);
}

export function useOpenClawWorkflow(callbacks?: WorkflowCallbacks) {
  const eventBus = useOpenClawEvents();
  const gateway = useOpenClawGateway();

  const [status, setStatus] = React.useState<
    "idle" | "thinking" | "executing" | "waiting" | "complete" | "error"
  >("idle");
  const [pendingTools, setPendingTools] = React.useState<ToolCallEventData[]>([]);
  const [isConnected, setIsConnected] = React.useState(false);

  React.useEffect(() => {
    if (!callbacks) {return;}
    return registerWorkflowCallbacks(eventBus, callbacks);
  }, [eventBus, callbacks]);

  useOpenClawEvent("gateway:connected", () => setIsConnected(true));
  useOpenClawEvent("gateway:disconnected", () => setIsConnected(false));

  useOpenClawEvent("agent:thinking", () => setStatus("thinking"));
  useOpenClawEvent("agent:complete", () => setStatus("complete"));
  useOpenClawEvent("agent:error", () => setStatus("error"));
  useOpenClawEvent("tool:executing", () => setStatus("executing"));
  useOpenClawEvent("workflow:waiting_approval", () => setStatus("waiting"));

  useOpenClawEvent("tool:pending", (e) => {
    const data = e.data;
    if (!data) {return;}
    setPendingTools((prev) => [...prev, data]);
  });

  useOpenClawEvent("tool:approved", (e) => {
    setPendingTools((prev) => prev.filter((t) => t.toolCallId !== e.data?.toolCallId));
  });

  useOpenClawEvent("tool:rejected", (e) => {
    setPendingTools((prev) => prev.filter((t) => t.toolCallId !== e.data?.toolCallId));
  });

  const connect = React.useCallback(async () => {
    await gateway?.connect();
  }, [gateway]);

  const disconnect = React.useCallback(() => {
    gateway?.disconnect();
  }, [gateway]);

  const approveTool = React.useCallback(
    (toolCallId: string, modifiedArgs?: unknown) => {
      eventBus.emit("tool:approved", {
        type: "tool",
        action: "approved",
        sessionKey: "",
        timestamp: new Date(),
        messages: [],
        data: { toolCallId, modifiedArgs },
        context: {},
      });
      void gateway?.rpc("tool.approve", { toolCallId, modifiedArgs });
    },
    [eventBus, gateway]
  );

  const rejectTool = React.useCallback(
    (toolCallId: string, reason?: string) => {
      eventBus.emit("tool:rejected", {
        type: "tool",
        action: "rejected",
        sessionKey: "",
        timestamp: new Date(),
        messages: [],
        data: { toolCallId, reason },
        context: {},
      });
      void gateway?.rpc("tool.reject", { toolCallId, reason });
    },
    [eventBus, gateway]
  );

  return {
    status,
    pendingTools,
    isConnected,
    connect,
    disconnect,
    approveTool,
    rejectTool,
    eventBus,
    gateway,
  };
}
