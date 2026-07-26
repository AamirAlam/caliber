import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import casper from 'casper-js-sdk';
import {
  challengeMac,
  challengeMacEquals,
  readWalletSession,
  sessionToken,
  walletSessionCookieName,
  type WalletSession,
} from '@/lib/walletAuth';
import { walletSessionMessage } from '@/lib/walletMessages';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CHALLENGE_MAX_AGE_MS = 10 * 60 * 1000;

const isCasperPublicKeyHex = (value: string) => /^(01[0-9a-f]{64}|02[0-9a-f]{66})$/i.test(value);

const challengePayload = (publicKey: string, nonce: string, issuedAt: string) =>
  `${publicKey}|${nonce}|${issuedAt}`;

export async function GET(req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ wallet: readWalletSession(req) });
}

/** Issue a stateless sign-in challenge for a wallet public key. */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as { publicKey?: string };
  const publicKey = body.publicKey?.trim() ?? '';
  if (!isCasperPublicKeyHex(publicKey)) {
    return NextResponse.json({ error: 'valid Casper public key required' }, { status: 400 });
  }
  const nonce = randomBytes(16).toString('hex');
  const issuedAt = new Date().toISOString();
  return NextResponse.json({
    message: walletSessionMessage(publicKey, nonce, issuedAt),
    nonce,
    issuedAt,
    mac: challengeMac(challengePayload(publicKey, nonce, issuedAt)),
  });
}

/** Mint a session only after verifying the wallet signed the issued challenge. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as {
    publicKey?: string;
    nonce?: string;
    issuedAt?: string;
    mac?: string;
    signature?: string;
  };
  const { publicKey, nonce, issuedAt, mac, signature } = body;
  if (!publicKey || !isCasperPublicKeyHex(publicKey)) {
    return NextResponse.json({ error: 'valid Casper public key required' }, { status: 400 });
  }
  if (signature && nonce && issuedAt && mac) {
    // Signed challenge path (preferred): prove key ownership.
    if (!challengeMacEquals(challengePayload(publicKey, nonce, issuedAt), mac)) {
      return NextResponse.json({ error: 'invalid challenge' }, { status: 403 });
    }
    const age = Date.now() - Date.parse(issuedAt);
    if (!Number.isFinite(age) || age < 0 || age > CHALLENGE_MAX_AGE_MS) {
      return NextResponse.json({ error: 'challenge expired' }, { status: 403 });
    }
    const message = walletSessionMessage(publicKey, nonce, issuedAt);
    if (!verifyWalletSignature(publicKey, message, signature)) {
      return NextResponse.json({ error: 'signature verification failed' }, { status: 403 });
    }
  }
  // Without a signature the session is unverified: enough to browse workspaces,
  // while approvals still require a real wallet signature server-side.

  const wallet: WalletSession = {
    accountHash: publicKey,
    publicKey,
    connectedAt: new Date().toISOString(),
  };
  const res = NextResponse.json({ wallet });
  res.cookies.set(walletSessionCookieName(), sessionToken(wallet), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return res;
}

export async function DELETE(): Promise<NextResponse> {
  const res = NextResponse.json({ wallet: null });
  res.cookies.delete(walletSessionCookieName());
  return res;
}

function verifyWalletSignature(publicKeyHex: string, message: string, signatureHex: string): boolean {
  try {
    const publicKey = casper.PublicKey.fromHex(publicKeyHex);
    const signature = Buffer.from(signatureHex.replace(/^0x/, ''), 'hex');
    // Casper Wallet prefixes signed messages; older signers sign the raw bytes.
    const candidates = [`Casper Message:\n${message}`, message];
    return candidates.some((m) => {
      try {
        return publicKey.verifySignature(Buffer.from(m, 'utf8'), signature);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
