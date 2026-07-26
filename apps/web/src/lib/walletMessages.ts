export function walletSessionMessage(publicKey: string, nonce: string, issuedAt: string): string {
  return [
    'Caliber wallet sign-in',
    '',
    `Public key: ${publicKey}`,
    `Nonce: ${nonce}`,
    `Issued at: ${issuedAt}`,
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
