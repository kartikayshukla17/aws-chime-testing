import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const s = getSession();
  return NextResponse.json({ user: s ? { name: s.name, bot: s.bot, accessCodeRequired: false } : null, accessCodeRequired: !!process.env.ACCESS_CODE });
}
