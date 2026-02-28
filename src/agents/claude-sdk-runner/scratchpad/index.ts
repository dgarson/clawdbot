export {
  buildScratchpadTool,
  SCRATCHPAD_ENTRY_KEY,
  SCRATCHPAD_NOTES_KEY,
  SCRATCHPAD_PLAN_KEY,
  SCRATCHPAD_REFS_KEY,
} from "./scratchpad-tool.js";
export type { ScratchpadState, ScratchpadToolOptions } from "./scratchpad-tool.js";
export { detectPlanPatterns, buildScratchpadNudge } from "./nudge.js";
export type { NudgeTrigger } from "./nudge.js";
