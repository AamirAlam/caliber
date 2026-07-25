import { NextRequest, NextResponse } from 'next/server';
import {
  createWalletChallenge,
  readWalletSession,
  sessionToken,
  verifyWalletSignature,
  walletChallengeCookieName,
  walletSessionCookieName,
  type WalletSession,
} from '@/lib/walletAuth';
import { walletLoginMessage } from '@/lib/walletMessages';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ wallet: readWalletSession(req) });
}

export async function PUT(): Promise<NextResponse> {
  const challenge = createWalletChallenge();
  const res = NextResponse.json({ challenge, message: walletLoginMessage(challenge) });
  res.cookies.set(walletChallengeCookieName(), challenge, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });
  return res;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as {
    accountHash?: string;
    publicKey?: string;
    signature?: string;
    message?: string;
  };
  const challenge = req.cookies.get(walletChallengeCookieName())?.value;
  if (!challenge || body.message !== walletLoginMessage(challenge)) {
    return NextResponse.json({ error: 'wallet challenge expired or invalid' }, { status: 401 });
  }
  if (!body.accountHash || !body.signature || !body.publicKey) {
    return NextResponse.json({ error: 'wallet account and signature required' }, { status: 400 });
  }
  if (!verifyWalletSignature(body.publicKey, body.message, body.signature)) {
    return NextResponse.json({ error: 'wallet signature invalid' }, { status: 401 });
  }

  const wallet: WalletSession = {
    accountHash: body.accountHash,
    publicKey: body.publicKey,
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
  res.cookies.delete(walletChallengeCookieName());
  return res;
}

export async function DELETE(): Promise<NextResponse> {
  const res = NextResponse.json({ wallet: null });
  res.cookies.delete(walletSessionCookieName());
  res.cookies.delete(walletChallengeCookieName());
  return res;
}
