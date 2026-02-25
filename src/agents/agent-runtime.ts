import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { EmbeddedPiSubscribeEvent } from "./pi-embedded-subscribe.handlers.types.js";

export interface AgentRuntime {
  subscribe(handler: (evt: EmbeddedPiSubscribeEvent) => void): () => void;
  prompt(
    text: string,
    options?: { images?: Array<{ type: string; media_type: string; data: string }> },
  ): Promise<void>;
  steer(text: string): Promise<void>;
  abort(): void;
  abortCompaction(): void;
  dispose(): void;
  replaceMessages(messages: AgentMessage[]): void;
  readonly isStreaming: boolean;
  readonly isCompacting: boolean;
  readonly messages: AgentMessage[];
  readonly sessionId: string;
  readonly runtimeHints: AgentRuntimeHints;
}

export interface AgentRuntimeHints {
  /** Whether to allow synthetic tool result repair in SessionManager. */
  allowSyntheticToolResults: boolean;
  /** Whether to enforce <final> tag extraction. */
  enforceFinalTag: boolean;
}
