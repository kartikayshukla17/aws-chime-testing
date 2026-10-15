'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cleanMeetingName, randomMeetingName } from '@/lib/roomname';

export default function Home() {
  const router = useRouter();
  const [createName, setCreateName] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinError, setJoinError] = useState('');
  const [checking, setChecking] = useState(false);

  // Generated after mount so server and browser HTML match.
  useEffect(() => { setCreateName(randomMeetingName()); }, []);

  const go = (name: string) => router.push(`/room/${encodeURIComponent(name)}`);

  const create = () => {
    const name = cleanMeetingName(createName);
    if (name) go(name);
  };

  const join = async () => {
    const name = cleanMeetingName(joinName);
    if (!name) return;
    setJoinError(''); setChecking(true);
    try {
      const r = await fetch(`/api/meeting?room=${encodeURIComponent(name)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'could not check the meeting');
      if (!d.exists) { setJoinError(`No running meeting called “${name}”. Check the name, or create one.`); return; }
      go(name);
    } catch (e) {
      setJoinError((e as Error).message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">Amazon Chime test</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-3 rounded border border-zinc-700 p-4">
          <h2 className="font-medium">Create meeting</h2>
          <p className="text-sm text-zinc-400">We picked a name. Change it if you like, then share it with others.</p>
          <input
            className="w-full rounded bg-zinc-800 p-2"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            aria-label="Meeting name"
          />
          <button className="rounded bg-blue-600 px-4 py-2 disabled:opacity-40" disabled={!cleanMeetingName(createName)} onClick={create}>
            Create &amp; join
          </button>
        </section>

        <section className="space-y-3 rounded border border-zinc-700 p-4">
          <h2 className="font-medium">Join meeting</h2>
          <p className="text-sm text-zinc-400">Enter the name of a meeting someone already started.</p>
          <input
            className="w-full rounded bg-zinc-800 p-2"
            value={joinName}
            onChange={(e) => { setJoinName(e.target.value); setJoinError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && join()}
            placeholder="meeting name"
            aria-label="Meeting name to join"
          />
          <button className="rounded bg-emerald-700 px-4 py-2 disabled:opacity-40" disabled={!cleanMeetingName(joinName) || checking} onClick={join}>
            {checking ? 'Checking…' : 'Join'}
          </button>
          {joinError && <p className="text-sm text-red-400">{joinError}</p>}
        </section>
      </div>
      <p className="text-sm text-zinc-400">
        You’ll choose your own display name next (a random one is filled in). <a className="text-blue-400 underline" href="/bots">Active bots →</a>
      </p>
    </main>
  );
}
