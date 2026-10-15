import { NextResponse } from 'next/server';
import { cookieOptions } from '@/lib/session';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieOptions.name, '', { path: '/', maxAge: 0 });
  return res;
}
