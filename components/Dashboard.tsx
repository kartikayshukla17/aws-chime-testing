'use client';
import { useEffect, useState } from 'react';
import type { Report } from '@/lib/reports';

const fmt = (n: number | undefined, d = 0) => (n === undefined || Number.isNaN(n) ? '–' : n.toFixed(d));

export default function Dashboard({ room }: { room: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [now, setNow] = useState(Date.now());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const d = await (await fetch(`/api/report?room=${encodeURIComponent(room)}`, { cache: 'no-store' })).json();
        setReports(d.reports); setNow(d.now); setTick((t) => t + 1);
      } catch {}
    };
    load();
    const i = setInterval(load, 2000);
    return () => clearInterval(i);
  }, [room]);

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">What each participant receives — {room}</h1>
      <p className="text-xs text-zinc-400">
        Reported by each client every ~1s via the Chime SDK metrics API. Bitrate is the raw SDK value. A participant is “stale” if no report arrived for 6s.
      </p>
      {reports.length === 0 && <p className="text-sm text-zinc-400">No reports yet. Join the room first.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {reports.map((r) => {
          const stale = now - r.ts > 6000;
          return (
            <section key={r.observer} className={`rounded border p-3 text-sm space-y-2 ${stale ? 'border-red-800 opacity-60' : 'border-zinc-700'}`}>
              <div className="flex items-center justify-between">
                <b>{r.observer}{r.isBot ? ' 🤖' : ''}</b>
                <span className="text-xs text-zinc-400">{stale ? 'stale' : `${r.tilesVisible} tiles`} · rtt {fmt(r.net.rttMs)}ms · audio loss {fmt((r.net.audioLossFraction ?? 0) * 100, 1)}%</span>
              </div>
              <table className="w-full text-xs">
                <thead className="text-zinc-400"><tr><th className="text-left">video from</th><th>res</th><th>fps</th><th>bitrate</th><th>loss%</th></tr></thead>
                <tbody>
                  {r.tiles.length === 0 && <tr><td colSpan={5} className="text-zinc-500">no remote video received</td></tr>}
                  {r.tiles.map((t, i) => (
                    <tr key={i} className="text-center">
                      <td className="text-left">{t.from}{t.content ? ' (screen)' : ''}</td>
                      <td>{t.width && t.height ? `${t.width}×${t.height}` : '–'}</td>
                      <td>{fmt(t.fps)}</td><td>{fmt(t.kbps)}</td><td>{fmt(t.lossPct, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-xs">
                <span className="text-zinc-400">hearing (peak vol since last report): </span>
                {Object.keys(r.hearing).length === 0 ? <span className="text-zinc-500">silence</span> :
                  Object.entries(r.hearing).map(([n, v]) => <span key={n} className="mr-2">{n} {v.toFixed(2)}</span>)}
              </div>
              {r.isBot && !stale && (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={`${r.observer} view`} className="w-full rounded" src={`/api/bots/screenshot?room=${encodeURIComponent(room)}&name=${encodeURIComponent(r.observer)}&t=${tick}`} />
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
