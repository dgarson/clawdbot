export type SessionTranscriptMessageContext = {
  role?: string;
  content?: unknown;
};

type SessionTranscriptUpdate = {
  sessionFile: string;
  sessionKey?: string;
  agentId?: string;
  message?: SessionTranscriptMessageContext;
};

type SessionTranscriptListener = (update: SessionTranscriptUpdate) => void;

const SESSION_TRANSCRIPT_LISTENERS = new Set<SessionTranscriptListener>();

export function onSessionTranscriptUpdate(listener: SessionTranscriptListener): () => void {
  SESSION_TRANSCRIPT_LISTENERS.add(listener);
  return () => {
    SESSION_TRANSCRIPT_LISTENERS.delete(listener);
  };
}

export function emitSessionTranscriptUpdate(
  sessionFile: string,
  context?: Omit<SessionTranscriptUpdate, "sessionFile">,
): void {
  const trimmed = sessionFile.trim();
  if (!trimmed) {
    return;
  }

  const update: SessionTranscriptUpdate = { sessionFile: trimmed };
  if (context) {
    Object.assign(update, context);
  }

  for (const listener of SESSION_TRANSCRIPT_LISTENERS) {
    listener(update);
  }
}
