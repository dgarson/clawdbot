export { ReactionEscalationService } from "./service.js";
export { createSlackReactionEscalationAdapter } from "./adapters/slack.js";
export type {
  EscalationIntent,
  EscalationOutcome,
  ReactionEscalationAdapter,
  ReactionEscalationDispatch,
  ReactionMessageContext,
  SignalReaction,
} from "./types.js";
