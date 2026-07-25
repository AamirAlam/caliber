import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'caliber_operator_session';
const SESSION_SUBJECT = 'caliber-operator';

export function operatorCookieName(): string {
  return COOKIE_NAME;
}

export function hasOperatorSession(req: NextRequest): boolean {
  const expected = operatorSessionToken();
  const actual = req.cookies.get(COOKIE_NAME)?.value;
  if (!expected || !actual) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyOperatorCode(code: string): boolean {
  const expected = process.env.OPERATOR_ACCESS_CODE ?? process.env.CALIBER_OPERATOR_CODE ?? '';
  if (!expected || !code) return false;
  const a = Buffer.from(code);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function operatorSessionToken(): string {
  const secret = process.env.OPERATOR_ACCESS_CODE ?? process.env.CALIBER_OPERATOR_CODE ?? '';
  if (!secret) return '';
  return createHmac('sha256', secret).update(SESSION_SUBJECT).digest('hex');
}
