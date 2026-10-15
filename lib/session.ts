import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export interface Session { id: string; name: string; bot: boolean }

const COOKIE = 'ct_session';
const g = globalThis as unknown as { __ctSecret?: string };
// Dev fallback: random per process (sessions reset on restart). Set SESSION_SECRET to persist.
const secret = () => process.env.SESSION_SECRET || (g.__ctSecret ??= randomBytes(32).toString('hex'));

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function encode(s: Session): string {
  const payload = Buffer.from(JSON.stringify(s)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function decode(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return null; }
}

export function getSession(): Session | null {
  return decode(cookies().get(COOKIE)?.value);
}

export const cookieOptions = {
  name: COOKIE,
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.COOKIE_SECURE === '1',
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};

export const cleanName = (n: string) => n.trim().replace(/[^\w .\-]/g, '').slice(0, 32);
