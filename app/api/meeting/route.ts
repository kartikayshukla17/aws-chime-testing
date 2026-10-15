import { NextResponse } from 'next/server';
import { deleteMeeting, getOrCreateMeeting, meetingExists } from '@/lib/chime-server';
import { closeBots } from '@/lib/bots';
import { clearReports } from '@/lib/reports';
import { getSession } from '@/lib/session';

export const runtime = 'nodejs';

// Used by "Join meeting" on the home page to tell a typo from a real, running meeting.
export async function GET(req: Request) {
  const room = new URL(req.url).searchParams.get('room');
  if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });
  try {
    return NextResponse.json({ exists: await meetingExists(room) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!getSession()) return NextResponse.json({ error: 'not logged in' }, { status: 401 });
  const { room } = await req.json();
  if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });
  try {
    return NextResponse.json({ meeting: await getOrCreateMeeting(room) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!getSession()) return NextResponse.json({ error: 'not logged in' }, { status: 401 });
  const { room } = await req.json();
  if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });
  await closeBots(room);
  await clearReports(room);
  try {
    return NextResponse.json({ deleted: await deleteMeeting(room) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
