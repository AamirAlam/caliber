import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_SERVICES_URL = 'http://localhost:4000';

function servicesBaseUrl(): string {
  const base =
    process.env.SERVICES_URL ??
    process.env.NEXT_PUBLIC_SERVICES_URL ??
    DEFAULT_SERVICES_URL;
  return base.replace(/\/+$/, '');
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
  if (process.env.CALIBER_ADMIN_TOKEN && req.method !== 'GET' && req.method !== 'HEAD') {
    headers.set('authorization', `Bearer ${process.env.CALIBER_ADMIN_TOKEN}`);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
    redirect: 'follow',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  try {
    const upstream = await fetch(targetUrl(path, req), init);
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
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
