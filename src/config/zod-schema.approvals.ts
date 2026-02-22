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

const HitlPolicySchema = z
  .object({
    id: z.string().min(1),
    tool: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    pattern: z.string().min(1).optional(),
    minApproverRole: z.string().min(1).optional(),
    requireDifferentActor: z.boolean().optional(),
  })
  .strict();

const HitlApprovalsSchema = z
  .object({
    defaultPolicyId: z.string().min(1).optional(),
    approverRoleOrder: z.array(z.string().min(1)).optional(),
    policies: z.array(HitlPolicySchema).optional(),
  })
  .strict()
  .optional();

export const ApprovalsSchema = z
  .object({
    exec: ExecApprovalForwardingSchema,
    hitl: HitlApprovalsSchema,
  })
  .strict()
  .optional();
