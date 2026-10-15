import { NextResponse } from 'next/server';
import { createAttendee, type AttendeeKind } from '@/lib/chime-server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { room, name, kind } = (await req.json()) as { room?: string; name?: string; kind?: AttendeeKind };
  if (!room || !name) return NextResponse.json({ error: 'room and name required' }, { status: 400 });
  try {
    const { meeting, attendee } = await createAttendee(room, name, kind === 'bot' ? 'bot' : 'human');
    return NextResponse.json({ meeting, attendee });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
