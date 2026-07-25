import { NextRequest, NextResponse } from 'next/server';
import {
  hasOperatorSession,
  operatorCookieName,
  operatorSessionToken,
  verifyOperatorCode,
} from '@/lib/operatorAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ operator: hasOperatorSession(req) });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  if (!verifyOperatorCode(body.code ?? '')) {
    return NextResponse.json({ error: 'invalid operator code' }, { status: 401 });
  }

  const res = NextResponse.json({ operator: true });
  res.cookies.set(operatorCookieName(), operatorSessionToken(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return res;
}

export async function DELETE(): Promise<NextResponse> {
  const res = NextResponse.json({ operator: false });
  res.cookies.delete(operatorCookieName());
  return res;
}
