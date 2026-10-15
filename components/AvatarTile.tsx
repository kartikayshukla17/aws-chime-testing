'use client';

const COLORS = ['bg-blue-700', 'bg-emerald-700', 'bg-purple-700', 'bg-amber-700', 'bg-rose-700', 'bg-cyan-700', 'bg-indigo-700', 'bg-teal-700'];
export const colorFor = (name: string) => COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length];

// Shown instead of a black box when a participant has no live video (camera off, never started, etc.).
export default function AvatarTile({ name, label, speaking, bot }: { name: string; label: string; speaking: boolean; bot: boolean }) {
  const initial = (name.trim()[0] || '?').toUpperCase();
  return (
    <div className={`relative flex aspect-video items-center justify-center overflow-hidden rounded bg-zinc-900 ${speaking ? 'ring-4 ring-green-500' : ''}`} data-avatar={name}>
      <div className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl font-semibold text-white ${colorFor(name)}`}>
        {bot ? '🤖' : initial}
      </div>
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-2 text-xs">{label}</span>
    </div>
  );
}
