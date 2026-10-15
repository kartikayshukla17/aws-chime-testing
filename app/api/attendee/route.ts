import { NextResponse } from 'next/server';
import { createAttendee } from '@/lib/chime-server';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: 'not logged in' }, { status: 401 });
  const { room } = (await req.json()) as { room?: string };
  if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });
  try {
    // Identity comes from the session cookie, never from the request body.
    const { meeting, attendee } = await createAttendee(room, `${session.name}-${session.id}`, session.bot ? 'bot' : 'human');
    return NextResponse.json({ meeting, attendee, displayName: session.name });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
