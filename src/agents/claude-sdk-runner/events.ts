import type { AgentEvent } from "@mariozechner/pi-agent-core";
import type { AgentSession } from "@mariozechner/pi-coding-agent";

export type EmbeddedEventSink = {
  session: AgentSession;
  emit: (evt: AgentEvent) => void;
};

export function createEmbeddedEventSink(sessionId: string): EmbeddedEventSink {
  const listeners = new Set<(evt: AgentEvent) => void>();

  const session = {
    sessionId,
    id: sessionId,
    subscribe: (listener: (evt: AgentEvent) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  } as unknown as AgentSession;

  const emit = (evt: AgentEvent) => {
    for (const listener of listeners) {
      listener(evt);
    }
  };

  return { session, emit };
}
