'use client';
import { useCallback, useEffect, useState } from 'react';

interface Row { room: string; bots: string[]; staleBots: string[]; humans: string[]; meetingId: string | null; mediaRegion: string | null; startedByThisServer: string[] }
interface Status { now: number; canControl: boolean; totals: { bots: number; meetings: number }; rooms: Row[] }

export default function BotsPage() {
  const [data, setData] = useState<Status | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (document.hidden) return; // saves quota when nobody is looking
    try { setData(await (await fetch('/api/bots/status', { cache: 'no-store' })).json()); setErr(''); }
    catch { setErr('could not load status'); }
  }, []);
  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [load]);

  const stop = async (room: string) => {
    await fetch('/api/bots', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ room }) });
    load();
  };

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <h1 className="text-lg font-semibold">Active bots</h1>
      <p className="text-sm text-zinc-400">
        {data ? <><b className="text-zinc-100">{data.totals.bots}</b> bot{data.totals.bots === 1 ? '' : 's'} connected across <b className="text-zinc-100">{data.totals.meetings}</b> meeting{data.totals.meetings === 1 ? '' : 's'}</> : 'loading…'}
        <span className="ml-2 text-xs">Counted from what each bot reports from inside the call (last ~35s), so bots on other machines show up too. Refreshes every 5s.</span>
      </p>
      {err && <p className="text-sm text-red-400">{err}</p>}
      {data && data.rooms.length === 0 && <p className="text-sm text-zinc-400">No bots are running.</p>}
      <div className="space-y-3">
        {data?.rooms.map((r) => (
          <section key={r.room} className="space-y-2 rounded border border-zinc-700 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <b className="text-base">{r.room}</b>
              <a className="text-blue-400 underline" href={`/room/${encodeURIComponent(r.room)}`}>room</a>
              <a className="text-blue-400 underline" href={`/dashboard/${encodeURIComponent(r.room)}`}>dashboard</a>
              <span className="text-zinc-400">{r.bots.length} bot{r.bots.length === 1 ? '' : 's'} · {r.humans.length} human{r.humans.length === 1 ? '' : 's'} reporting</span>
              {data.canControl && r.startedByThisServer.length > 0 && (
                <button className="ml-auto rounded bg-red-900 px-3 py-1" onClick={() => stop(r.room)}>Stop bots here</button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {r.bots.map((b) => <span key={b} className="rounded bg-emerald-900/60 px-2 py-0.5">🤖 {b}</span>)}
              {r.staleBots.map((b) => <span key={b} className="rounded bg-zinc-800 px-2 py-0.5 text-zinc-500" title="started but not reported recently">🤖 {b} (not reporting)</span>)}
              {r.bots.length === 0 && r.startedByThisServer.length > 0 && <span className="text-zinc-500">started here ({r.startedByThisServer.join(', ')}), still connecting…</span>}
            </div>
            <div className="text-xs text-zinc-500">
              Chime meeting {r.meetingId ?? 'unknown'}{r.mediaRegion ? ` · ${r.mediaRegion}` : ''}
              {r.humans.length > 0 ? ` · humans: ${r.humans.join(', ')}` : ''}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
