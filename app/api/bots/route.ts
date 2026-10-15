import { NextResponse } from 'next/server';
import { closeBots, listBots, spawnBots } from '@/lib/bots';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const room = new URL(req.url).searchParams.get('room');
  if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });
  return NextResponse.json({ bots: listBots(room) });
}

export async function POST(req: Request) {
  const { room, count = 1, screenshare = false } = await req.json();
  if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });
  try {
    return NextResponse.json(await spawnBots(room, Number(count), { screenshare }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { room } = await req.json();
  if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });
  return NextResponse.json({ closed: await closeBots(room) });
}
