import { NextResponse } from 'next/server';
import { allBots } from '@/lib/bots';
import { peekMeeting } from '@/lib/chime-server';
import { getReports, listRooms } from '@/lib/reports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FRESH_MS = 35_000; // clients report about every 10s; older than this = no longer connected

// Which bots are actually connected, and in which meeting. Based on what clients report from inside the call, so it
// also sees bots started from another machine (e.g. `npm run bots` against a deployed app).
export async function GET() {
  const now = Date.now();
  const spawnedHere = allBots();
  const rooms = new Set([...(await listRooms()), ...Object.keys(spawnedHere)]);

  const rows = await Promise.all([...rooms].map(async (room) => {
    const reports = await getReports(room);
    const fresh = reports.filter((r) => now - r.ts <= FRESH_MS);
    const bots = fresh.filter((r) => r.isBot).map((r) => r.observer);
    const stale = reports.filter((r) => r.isBot && now - r.ts > FRESH_MS).map((r) => r.observer);
    const meeting = await peekMeeting(room);
    return {
      room,
      bots: bots.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      staleBots: stale,
      humans: fresh.filter((r) => !r.isBot).map((r) => r.observer),
      meetingId: meeting?.MeetingId ?? null,
      mediaRegion: meeting?.MediaRegion ?? null,
      startedByThisServer: spawnedHere[room] ?? [],
    };
  }));

  const active = rows.filter((r) => r.bots.length > 0 || r.startedByThisServer.length > 0);
  return NextResponse.json({
    now,
    canControl: process.env.ENABLE_BOTS === '1',
    totals: { bots: active.reduce((n, r) => n + r.bots.length, 0), meetings: active.length },
    rooms: active.sort((a, b) => a.room.localeCompare(b.room)),
  });
}
