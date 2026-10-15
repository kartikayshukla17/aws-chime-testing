import { NextResponse } from 'next/server';
import { closeBots, idleMinutes, listBots, spawnBots } from '@/lib/bots';

export const runtime = 'nodejs';

// Bots need Chromium, so they only run on a machine you control (set ENABLE_BOTS=1). Not on Vercel.
const disabled = () => process.env.ENABLE_BOTS !== '1';
const off = () => Response.json({ error: 'bots disabled on this server' }, { status: 501 });

export async function GET(req: Request) {
  if (disabled()) return off();
  const room = new URL(req.url).searchParams.get('room');
  if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });
  return NextResponse.json({ bots: listBots(room), max: Number(process.env.MAX_BOTS || 15), idleMinutes: idleMinutes() });
}

export async function POST(req: Request) {
  if (disabled()) return off();
  const { room, count = 1, screenshare = false } = await req.json();
  if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });
  try {
    return NextResponse.json(await spawnBots(room, Number(count), { screenshare }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (disabled()) return off();
  const { room } = await req.json();
  if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });
  return NextResponse.json({ closed: await closeBots(room) });
}
