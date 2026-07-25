import { NextRequest, NextResponse } from 'next/server';
import {
  readWalletSession,
  sessionToken,
  walletSessionCookieName,
  type WalletSession,
} from '@/lib/walletAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ wallet: readWalletSession(req) });
}

export async function PUT(): Promise<NextResponse> {
  return NextResponse.json({ error: 'wallet challenge signing is disabled' }, { status: 405 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as {
    accountHash?: string;
    publicKey?: string;
  };
  if (!body.accountHash || !body.publicKey) {
    return NextResponse.json({ error: 'wallet account required' }, { status: 400 });
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
  return res;
}

export async function DELETE(): Promise<NextResponse> {
  const res = NextResponse.json({ wallet: null });
  res.cookies.delete(walletSessionCookieName());
  return res;
}
