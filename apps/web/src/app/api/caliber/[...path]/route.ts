import { NextRequest, NextResponse } from 'next/server';
import { readWalletSession } from '@/lib/walletAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_SERVICES_URL = 'http://localhost:4000';
const OPTIONAL_DASHBOARD_READS = new Set([
  'signals/latest',
  'risk/latest',
  'recommendation/latest',
]);

function servicesBaseUrl(): string {
  const base =
    process.env.SERVICES_URL ??
    process.env.NEXT_PUBLIC_SERVICES_URL ??
    DEFAULT_SERVICES_URL;
  const withProtocol = /^https?:\/\//.test(base) ? base : `http://${base}`;
  return withProtocol.replace(/\/+$/, '');
}

function targetUrl(path: string[], req: NextRequest): string {
  const url = new URL(`${servicesBaseUrl()}/${path.join('/')}`);
  url.search = req.nextUrl.search;
  return url.toString();
}

async function forward(req: NextRequest, path: string[]): Promise<NextResponse> {
  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');
  headers.delete('accept-encoding');
  const mutation = req.method !== 'GET' && req.method !== 'HEAD';
  const route = path.join('/');
  const wallet = readWalletSession(req);
  if (mutation && !wallet) {
    return NextResponse.json({ error: 'wallet connection required' }, { status: 403 });
  }
  if (process.env.CALIBER_ADMIN_TOKEN && mutation) {
    headers.set('authorization', `Bearer ${process.env.CALIBER_ADMIN_TOKEN}`);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
    redirect: 'follow',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const raw = await req.text();
    init.body = wallet ? rewriteMutationBody(route, raw, wallet) : raw;
  }

  try {
    const upstream = await fetch(targetUrl(path, req), init);
    if (req.method === 'GET' && upstream.status === 404 && OPTIONAL_DASHBOARD_READS.has(route)) {
      return NextResponse.json(null);
    }
    const body = await upstream.arrayBuffer();
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');
    responseHeaders.delete('transfer-encoding');
    return new NextResponse(body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `services API unavailable: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 502 },
    );
  }
}

function rewriteMutationBody(
  route: string,
  raw: string,
  wallet: NonNullable<ReturnType<typeof readWalletSession>>,
): string {
  const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  if (route === 'workspaces') {
    return JSON.stringify({
      ...body,
      ownerAccount: wallet.accountHash,
    });
  }
  if (route === 'runs') {
    return JSON.stringify({
      ...body,
      ownerAccount: wallet.accountHash,
    });
  }
  if (route === 'approve') {
    return JSON.stringify({
      ...body,
      approver: wallet.accountHash,
    });
  }
  return JSON.stringify(body);
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  return forward(req, path);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  return forward(req, path);
}
