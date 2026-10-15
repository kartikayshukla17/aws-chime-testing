'use client';
import { useEffect, useState } from 'react';
import type { Report } from '@/lib/reports';

const fmt = (n: number | undefined, d = 0) => (n === undefined || Number.isNaN(n) ? '–' : n.toFixed(d));
const AUDIO_OK_DB = 12; // tone must be this many dB above the local noise floor to count as heard
const botNum = (n: string) => Number(/^bot-(\d+)$/.exec(n)?.[1] ?? 0);

function Cell({ r, sender }: { r: Report; sender: string }) {
  if (r.observer === sender) return <td className="p-1 text-center text-zinc-600">—</td>;
  if (!r.signals) return <td className="p-1 text-center text-zinc-500">…</td>;
  const db = r.signals.audio[sender];
  const v = r.signals.video[sender];
  const a = db !== undefined && db >= AUDIO_OK_DB;
  const vOk = !!v && v.hueOk && v.moving;
  const ok = a && vOk;
  return (
    <td className={`p-1 text-center ${ok ? 'bg-emerald-900/50' : 'bg-red-900/50'}`} title={`audio ${db === undefined ? 'n/a' : db.toFixed(1) + ' dB over floor'} · video ${v ? `colour ${v.hueOk ? 'ok' : 'WRONG'}, ${v.moving ? 'moving' : 'FROZEN'}` : 'no tile'}`}>
      <span className={a ? '' : 'text-red-300'}>A{a ? '✓' : '✗'}</span> <span className={vOk ? '' : 'text-red-300'}>V{vOk ? '✓' : '✗'}</span>
    </td>
  );
}

export default function Dashboard({ room }: { room: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const load = async () => {
      if (document.hidden) return; // saves free-tier quota when nobody is looking
      try {
        const d = await (await fetch(`/api/report?room=${encodeURIComponent(room)}`, { cache: 'no-store' })).json();
        setReports(d.reports); setNow(d.now);
      } catch {}
    };
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, [room]);

  const fresh = (r: Report) => now - r.ts <= 25_000; // clients report every ~10s
  const bots = reports.filter((r) => r.isBot).sort((a, b) => botNum(a.observer) - botNum(b.observer));
  const senders = bots.map((b) => b.observer);
  const observers = [...bots, ...reports.filter((r) => !r.isBot)];

  return (
    <main className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">What each participant receives — {room}</h1>
      <p className="text-xs text-zinc-400">
        Rows = who is receiving, columns = which bot. Every bot publishes its own tone and colour video; a cell is green when the receiver actually decoded that bot’s audio (tone above the noise floor) <b>and</b> its video (right colour, frames changing). Hover a cell for the numbers. Updates every ~10s.
      </p>
      {reports.length === 0 && <p className="text-sm text-zinc-400">No reports yet. Join the room first.</p>}

      {senders.length > 0 && (
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr><th className="p-1 text-left text-zinc-400">receiver ↓ / bot →</th>{senders.map((s) => <th key={s} className="p-1">{s}</th>)}</tr>
            </thead>
            <tbody>
              {observers.map((r) => (
                <tr key={r.observer} className={fresh(r) ? '' : 'opacity-40'}>
                  <td className="p-1 pr-3 whitespace-nowrap">{r.isBot ? '🤖 ' : ''}{r.observer}{fresh(r) ? '' : ' (stale)'}</td>
                  {senders.map((s) => <Cell key={s} r={r} sender={s} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {observers.map((r) => (
          <section key={r.observer} className={`rounded border p-3 text-sm space-y-2 ${fresh(r) ? 'border-zinc-700' : 'border-red-800 opacity-60'}`}>
            <div className="flex items-center justify-between">
              <b>{r.observer}{r.isBot ? ' 🤖' : ''}</b>
              <span className="text-xs text-zinc-400">{r.tilesVisible} tiles · rtt {fmt(r.net.rttMs)}ms · audio loss {fmt((r.net.audioLossFraction ?? 0) * 100, 1)}%</span>
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
          </section>
        ))}
      </div>
    </main>
  );
}
