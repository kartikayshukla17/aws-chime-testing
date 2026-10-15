'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [room, setRoom] = useState('test');
  const [name, setName] = useState('');
  return (
    <main className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-xl font-semibold">Amazon Chime test</h1>
      <input
        className="w-full rounded bg-zinc-800 p-2"
        value={room}
        onChange={(e) => setRoom(e.target.value.trim())}
        placeholder="room name"
      />
      <input
        className="w-full rounded bg-zinc-800 p-2"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="your name (optional — gets put in the link)"
      />
      <button
        className="rounded bg-blue-600 px-4 py-2 disabled:opacity-40"
        disabled={!room}
        onClick={() => router.push(`/room/${encodeURIComponent(room)}${name.trim() ? `?name=${encodeURIComponent(name.trim())}` : ''}`)}
      >
        Open room
      </button>
      <p className="text-sm"><a className="text-blue-400 underline" href="/bots">Active bots →</a></p>
      <p className="text-sm text-zinc-400">Different room names run as separate, concurrent meetings. In one browser, give each tab its own name (…/room/test?name=Alice) so each tab is a different person.</p>
    </main>
  );
}
