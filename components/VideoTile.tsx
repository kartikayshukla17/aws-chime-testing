'use client';
import { useEffect, useRef, useState } from 'react';
import type { AudioVideoFacade } from 'amazon-chime-sdk-js';
import { colorFor } from './AvatarTile';

export default function VideoTile({
  tileId, label, name, speaking, content, bot, audioVideo,
}: { tileId: number; label: string; name: string; speaking: boolean; content: boolean; bot?: boolean; audioVideo: AudioVideoFacade }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (ref.current) audioVideo.bindVideoElement(tileId, ref.current);
    return () => { try { audioVideo.unbindVideoElement(tileId); } catch {} };
  }, [tileId, audioVideo]);

  // A tile can linger black after someone's camera stops. Treat "no live, unmuted video track" as no video
  // and show their initial instead.
  useEffect(() => {
    const check = () => {
      const stream = ref.current?.srcObject;
      const track = stream instanceof MediaStream ? stream.getVideoTracks()[0] : undefined;
      setLive(!!track && track.readyState === 'live' && !track.muted && (ref.current?.videoWidth ?? 0) > 0);
    };
    check();
    const i = setInterval(check, 500);
    return () => clearInterval(i);
  }, [tileId]);

  const initial = (name.trim()[0] || '?').toUpperCase();
  return (
    <div className={`relative overflow-hidden rounded bg-black ${speaking ? 'ring-4 ring-green-500' : ''} ${content ? 'col-span-2' : ''}`} data-tile={tileId}>
      <video ref={ref} data-name={name} data-content={content ? '1' : '0'} className={`w-full ${content ? 'object-contain' : 'object-cover'} aspect-video`} autoPlay playsInline muted />
      {!live && !content && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900" data-avatar={name}>
          <div className={`flex h-16 w-16 items-center justify-center rounded-full ${colorFor(name)} text-2xl font-semibold text-white`}>{bot ? '🤖' : initial}</div>
        </div>
      )}
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-2 text-xs">{label}{content ? ' (screen)' : ''}</span>
    </div>
  );
}
