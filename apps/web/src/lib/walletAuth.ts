import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import casper from 'casper-js-sdk';
import { walletLoginMessage } from './walletMessages';

export interface WalletSession {
  accountHash: string;
  publicKey: string;
  connectedAt: string;
}

const SESSION_COOKIE = 'caliber_wallet_session';
const CHALLENGE_COOKIE = 'caliber_wallet_challenge';

export function walletSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function walletChallengeCookieName(): string {
  return CHALLENGE_COOKIE;
}

export function createWalletChallenge(): string {
  return `caliber-wallet-${randomBytes(18).toString('hex')}`;
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

export function verifyWalletSignature(publicKeyHex: string, message: string, signatureHex: string): boolean {
  try {
    const publicKey = casper.PublicKey.fromHex(publicKeyHex);
    const messageBytes = Buffer.from(message, 'utf8');
    const signatureBytes = Buffer.from(stripHexPrefix(signatureHex), 'hex');
    return publicKey.verifySignature(messageBytes, signatureBytes);
  } catch {
    return false;
  }
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

function stripHexPrefix(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}
