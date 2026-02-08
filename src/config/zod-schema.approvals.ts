import { z } from "zod";

const ExecApprovalForwardTargetSchema = z
  .object({
    channel: z.string().min(1),
    to: z.string().min(1),
    accountId: z.string().optional(),
    threadId: z.union([z.string(), z.number()]).optional(),
  })
  .strict();

const ExecApprovalForwardingSchema = z
  .object({
    enabled: z.boolean().optional(),
    mode: z.union([z.literal("session"), z.literal("targets"), z.literal("both")]).optional(),
    agentFilter: z.array(z.string()).optional(),
    sessionFilter: z.array(z.string()).optional(),
    targets: z.array(ExecApprovalForwardTargetSchema).optional(),
  })
  .strict()
  .optional();

const RiskClassSchema = z.union([
  z.literal("R0"),
  z.literal("R1"),
  z.literal("R2"),
  z.literal("R3"),
  z.literal("R4"),
]);

const ToolApprovalPolicySchema = z
  .object({
    requireApprovalAtOrAbove: RiskClassSchema.optional(),
    denyAtOrAbove: RiskClassSchema.optional(),
    requireApprovalForExternalWrite: z.boolean().optional(),
    requireApprovalForMessagingSend: z.boolean().optional(),
  })
  .strict()
  .optional();

const ToolApprovalRoutingSchema = z
  .object({
    mode: z.union([z.literal("session"), z.literal("targets"), z.literal("both")]).optional(),
    targets: z.array(ExecApprovalForwardTargetSchema).optional(),
    agentFilter: z.array(z.string()).optional(),
    sessionFilter: z.array(z.string()).optional(),
  })
  .strict()
  .optional();

const ToolApprovalClassifierSchema = z
  .object({
    enabled: z.boolean().optional(),
    timeoutMs: z.number().int().nonnegative().optional(),
    minConfidence: z.number().min(0).max(1).optional(),
    onLowConfidence: z
      .union([z.literal("require_approval"), z.literal("deny"), z.literal("allow")])
      .optional(),
    provider: z.string().optional(),
    model: z.string().optional(),
    maxInputChars: z.number().int().positive().optional(),
  })
  .strict()
  .optional();

const ToolApprovalsSchema = z
  .object({
    enabled: z.boolean().optional(),
    mode: z.union([z.literal("off"), z.literal("adaptive"), z.literal("always")]).optional(),
    timeoutMs: z.number().int().nonnegative().optional(),
    policy: ToolApprovalPolicySchema,
    routing: ToolApprovalRoutingSchema,
    classifier: ToolApprovalClassifierSchema,
  })
  .strict()
  .optional();

export const ApprovalsSchema = z
  .object({
    exec: ExecApprovalForwardingSchema,
    tools: ToolApprovalsSchema,
  })
  .strict()
  .optional();
