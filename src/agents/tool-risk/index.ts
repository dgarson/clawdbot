export type { RiskClass, SideEffectType, ToolRiskProfile, ToolRiskAssessment } from "./types.js";

export { RISK_CLASSES, compareRiskClass, maxRiskClass } from "./types.js";

export {
  getCoreToolRiskProfile,
  listCoreToolRiskProfiles,
  normalizeName,
} from "./tool-risk-catalog.js";

export { evaluateToolRisk } from "./tool-risk-static.js";

export type { StaticEvaluatorOptions } from "./tool-risk-static.js";

export {
  resolveToolRiskProfile,
  assessToolRisk,
  setPluginToolMetaAccessor,
} from "./tool-risk-resolver.js";
