import { NextResponse } from 'next/server';
import { getReports, removeReport, saveReport, type Report } from '@/lib/reports';
import { getJSON } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { room, report } = (await req.json()) as { room?: string; report?: Report };
  if (!room || !report?.observer) return NextResponse.json({ error: 'bad report' }, { status: 400 });
  await saveReport(room, { ...report, ts: Date.now() });
  // Bots learn here whether someone asked them to stop. They compare this stamp to the first one they saw, so a
  // stop requested before they started doesn't kill them, and only the server's clock is involved.
  const stopStamp = report.isBot ? ((await getJSON<number>(`botstop:${room}`)) ?? 0) : undefined;
  return NextResponse.json({ ok: true, stopStamp });
}

// A bot calls this as it leaves so the status list drops it right away instead of after its last report goes stale.
export async function DELETE(req: Request) {
  const { room, observer } = (await req.json()) as { room?: string; observer?: string };
  if (!room || !observer) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  await removeReport(room, observer);
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const room = new URL(req.url).searchParams.get('room');
  if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });
  return NextResponse.json({ now: Date.now(), reports: await getReports(room) });
}
