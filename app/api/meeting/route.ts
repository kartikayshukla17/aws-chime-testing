import { NextResponse } from 'next/server';
import { deleteMeeting, getOrCreateMeeting } from '@/lib/chime-server';
import { closeBots } from '@/lib/bots';
import { clearReports } from '@/lib/reports';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { room } = await req.json();
  if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });
  try {
    return NextResponse.json({ meeting: await getOrCreateMeeting(room) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { room } = await req.json();
  if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });
  await closeBots(room);
  clearReports(room);
  try {
    return NextResponse.json({ deleted: await deleteMeeting(room) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
