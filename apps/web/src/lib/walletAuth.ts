import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

export interface WalletSession {
  accountHash: string;
  publicKey: string;
  connectedAt: string;
}

const SESSION_COOKIE = 'caliber_wallet_session';
export function walletSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function sessionToken(session: WalletSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readWalletSession(req: NextRequest): WalletSession | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [payload, mac] = token.split('.');
  if (!payload || !mac || !constantEquals(mac, sign(payload))) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as WalletSession;
  } catch {
    return null;
  }
}

export function hasWalletSession(req: NextRequest): boolean {
  return readWalletSession(req) !== null;
}

/** HMAC over a challenge payload so the server can verify it issued the challenge. */
export function challengeMac(payload: string): string {
  return sign(payload);
}

export function challengeMacEquals(payload: string, mac: string): boolean {
  return constantEquals(mac, sign(payload));
}

function sign(payload: string): string {
  return createHmac('sha256', walletSecret()).update(payload).digest('base64url');
}

function walletSecret(): string {
  return (
    process.env.WALLET_SESSION_SECRET ??
    process.env.CALIBER_ADMIN_TOKEN ??
    'caliber-local-wallet-session'
  );
}

function constantEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
