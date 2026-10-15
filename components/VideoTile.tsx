'use client';
import { useEffect, useRef } from 'react';
import type { AudioVideoFacade } from 'amazon-chime-sdk-js';

export default function VideoTile({
  tileId, label, name, speaking, content, audioVideo,
}: { tileId: number; label: string; name: string; speaking: boolean; content: boolean; audioVideo: AudioVideoFacade }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) audioVideo.bindVideoElement(tileId, ref.current);
    return () => { try { audioVideo.unbindVideoElement(tileId); } catch {} };
  }, [tileId, audioVideo]);
  return (
    <div className={`relative overflow-hidden rounded bg-black ${speaking ? 'ring-4 ring-green-500' : ''} ${content ? 'col-span-2' : ''}`} data-tile={tileId}>
      <video ref={ref} data-name={name} data-content={content ? '1' : '0'} className={`w-full ${content ? 'object-contain' : 'object-cover'} aspect-video`} autoPlay playsInline muted />
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-2 text-xs">{label}{content ? ' (screen)' : ''}</span>
    </div>
  );
}
