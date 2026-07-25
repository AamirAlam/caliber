export function walletApprovalMessage(runId: string, workspaceId: string, accountHash: string): string {
  return [
    'Caliber rebalance approval',
    '',
    `Run: ${runId}`,
    `Workspace: ${workspaceId}`,
    `Approver: ${accountHash}`,
  ].join('\n');
}
