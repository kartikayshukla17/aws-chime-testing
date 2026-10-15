import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { cleanName, cookieOptions, encode } from '@/lib/session';
import { botKey } from '@/lib/botkey';

export const runtime = 'nodejs';

// Passwordless: a display name is enough. If ACCESS_CODE is set, it must match (shared invite code, not a per-user password).
export async function POST(req: Request) {
  const { name, code, bot } = await req.json();
  const clean = cleanName(String(name || ''));
  if (!clean) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (process.env.ACCESS_CODE && code !== process.env.ACCESS_CODE && req.headers.get('x-bot-key') !== botKey()) {
    return NextResponse.json({ error: 'invalid access code' }, { status: 401 });
  }
  const isBot = !!bot && req.headers.get('x-bot-key') === botKey();
  const token = encode({ id: randomBytes(4).toString('hex'), name: clean, bot: isBot });
  const res = NextResponse.json({ name: clean, bot: isBot, token });
  const { name: cookieName, ...opts } = cookieOptions;
  res.cookies.set(cookieName, token, opts);
  return res;
}
