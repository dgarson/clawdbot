"use client";
import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";

function resolveGatewayUrl(): string {
  if (typeof window === "undefined") {return "ws://localhost:18789";}
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${proto}//${host}`;
}

export function GatewayProvider({ children }: { children: React.ReactNode }) {
  const connect = useGatewayStore((s) => s.connect);
  const connected = useGatewayStore((s) => s.connected);

  React.useEffect(() => {
    if (!connected) {
      connect(resolveGatewayUrl());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
