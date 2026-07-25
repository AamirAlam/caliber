import { z } from 'zod';

export const WorkspaceSourceModeSchema = z.enum(['operator', 'external']);

export const TreasuryWorkspaceSchema = z.object({
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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateTreasuryWorkspaceSchema = TreasuryWorkspaceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
