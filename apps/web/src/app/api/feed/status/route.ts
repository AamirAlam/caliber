import { NextResponse } from 'next/server';
import { SignalSchema } from '@caliber/shared';
import { managedSignalFeedUrl } from '@/lib/signalFeed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  try {
    const res = await fetch(managedSignalFeedUrl(), {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ active: false, error: `feed returned ${res.status}` }, { status: 502 });
    }
    const body = (await res.json()) as unknown;
    const rawSignals = Array.isArray(body)
      ? body
      : body && typeof body === 'object' && 'signals' in body
        ? (body as { signals: unknown }).signals
        : null;
    if (!Array.isArray(rawSignals)) {
      return NextResponse.json({ active: false, error: 'feed response has no signals array' }, { status: 502 });
    }
    const signals = rawSignals.map((signal) => SignalSchema.parse(signal));
    const capturedAt = signals
      .map((signal) => Date.parse(signal.observedAt))
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0];
    return NextResponse.json({
      active: true,
      capturedAt: capturedAt ? new Date(capturedAt).toISOString() : null,
      signalCount: signals.length,
      url: managedSignalFeedUrl(),
    });
  } catch (error) {
    return NextResponse.json(
      { active: false, error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
