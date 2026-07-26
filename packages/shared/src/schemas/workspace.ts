import { z } from 'zod';

export const WorkspaceSourceModeSchema = z.enum(['operator', 'external']);
export const WorkspaceAgentStatusSchema = z.enum(['stopped', 'active']);

const TreasuryWorkspaceBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ownerAccount: z.string(),
  vaultContractHash: z.string().min(1),
  network: z.literal('casper-test'),
  policy: z.object({
    rwaTarget: z.number().min(0).max(100),
    stableTarget: z.number().min(0).max(100),
    nativeTarget: z.number().min(0).max(100),
    maxRiskScore: z.number().min(0).max(100),
  }),
  signals: z.object({
    mode: WorkspaceSourceModeSchema,
    feedUrl: z.string(),
  }),
  agentStatus: WorkspaceAgentStatusSchema.default('stopped'),
  agentStartedAt: z.string().datetime().optional(),
  agentStoppedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const workspaceRules = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .refine(
      (workspace) =>
        workspace.policy.rwaTarget + workspace.policy.stableTarget + workspace.policy.nativeTarget === 100,
      {
        message: 'workspace policy allocations must total 100%',
        path: ['policy'],
      },
    )
    .refine(
      (workspace) => workspace.signals.mode !== 'external' || workspace.signals.feedUrl.trim().length > 0,
      {
        message: 'external signal mode requires feedUrl',
        path: ['signals', 'feedUrl'],
      },
    );

export const TreasuryWorkspaceSchema = workspaceRules(TreasuryWorkspaceBaseSchema);

export const UpdateWorkspacePolicySchema = TreasuryWorkspaceBaseSchema.shape.policy.refine(
  (policy) => policy.rwaTarget + policy.stableTarget + policy.nativeTarget === 100,
  { message: 'workspace policy allocations must total 100%' },
);

export const CreateTreasuryWorkspaceSchema = workspaceRules(
  TreasuryWorkspaceBaseSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  }),
);
