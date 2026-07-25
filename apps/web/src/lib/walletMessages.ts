export function walletLoginMessage(challenge: string): string {
  return [
    'Caliber wallet authentication',
    '',
    'Sign this message to connect your wallet to Caliber.',
    `Challenge: ${challenge}`,
  ].join('\n');
}

export function walletApprovalMessage(runId: string, workspaceId: string, accountHash: string): string {
  return [
    'Caliber rebalance approval',
    '',
    `Run: ${runId}`,
    `Workspace: ${workspaceId}`,
    `Approver: ${accountHash}`,
  ].join('\n');
}
