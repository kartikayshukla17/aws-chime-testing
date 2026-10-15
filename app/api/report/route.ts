import { NextResponse } from 'next/server';
import { getReports, saveReport, type Report } from '@/lib/reports';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { room, report } = (await req.json()) as { room?: string; report?: Report };
  if (!room || !report?.observer) return NextResponse.json({ error: 'bad report' }, { status: 400 });
  await saveReport(room, { ...report, ts: Date.now() });
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const room = new URL(req.url).searchParams.get('room');
  if (!room) return NextResponse.json({ error: 'room required' }, { status: 400 });
  return NextResponse.json({ now: Date.now(), reports: await getReports(room) });
}
