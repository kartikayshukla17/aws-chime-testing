'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Home() {
  const router = useRouter();
  const [room, setRoom] = useState('test');
  return (
    <main className="mx-auto max-w-md p-6 space-y-4">
      <h1 className="text-xl font-semibold">Amazon Chime test</h1>
      <input
        className="w-full rounded bg-zinc-800 p-2"
        value={room}
        onChange={(e) => setRoom(e.target.value.trim())}
        placeholder="room name"
      />
      <button
        className="rounded bg-blue-600 px-4 py-2 disabled:opacity-40"
        disabled={!room}
        onClick={() => router.push(`/room/${encodeURIComponent(room)}`)}
      >
        Open room
      </button>
      <p className="text-sm text-zinc-400">Open the same room in several tabs/browsers, or add bots inside the room.</p>
    </main>
  );
}
