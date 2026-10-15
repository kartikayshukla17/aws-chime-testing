import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getReports } from '@/lib/reports';
import { setJSON } from '@/lib/store';

export const runtime = 'nodejs';

const FRESH_MS = 35_000;
const stopKey = (room: string) => `botstop:${room}`;

// Asks every bot in a room to shut down. Bots may run on another machine, so we can't reach them directly: we leave
// a mark that each bot sees in the response to its next report (within ~10s) and then stops itself.
// Only a person who is currently in that meeting may do this.
export async function POST(req: Request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'Sign in first (join a meeting).' }, { status: 401 });
  if (session.bot) return NextResponse.json({ error: 'Bots cannot stop bots.' }, { status: 403 });
  const { room } = (await req.json()) as { room?: string };
  if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });

  const now = Date.now();
  const inMeeting = (await getReports(room)).some((r) => !r.isBot && r.observer === session.name && now - r.ts <= FRESH_MS);
  if (!inMeeting) return NextResponse.json({ error: `You need to be in the meeting “${room}” to stop its bots.` }, { status: 403 });

  await setJSON(stopKey(room), now, 300);
  return NextResponse.json({ ok: true, note: 'Bots will leave within about 10 seconds.' });
}
