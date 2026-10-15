'use client';
import { useEffect, useRef, useState } from 'react';
import { createToneListener, hueFor, makeBotMedia, sampleVideo, stripChanged, toneHz } from '@/lib/botsignal';

// Loopback check of the verification code, with no Chime involved: two bots' media are mixed locally,
// then measured exactly as a receiving client would. Visit /selftest. Expect all checks to pass.
export default function SelfTest() {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const v1 = useRef<HTMLVideoElement>(null);
  const v3 = useRef<HTMLVideoElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // React dev mode runs effects twice
    started.current = true;
    (async () => {
      const b1 = makeBotMedia(1, 'bot-1');
      const b3 = makeBotMedia(3, 'bot-3');
      // mix both bots' audio into one stream, like Chime's single mixed downstream
      const ctx = new AudioContext();
      const mix = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(b1.audio).connect(mix);
      ctx.createMediaStreamSource(b3.audio).connect(mix);
      await ctx.resume();
      const listener = createToneListener(mix.stream);

      v1.current!.srcObject = b1.video; v3.current!.srcObject = b3.video;
      await Promise.all([v1.current!.play().catch(() => {}), v3.current!.play().catch(() => {})]);
      await new Promise((r) => setTimeout(r, 1500));

      const expected = { 'bot-1': toneHz(1), 'bot-2': toneHz(2), 'bot-3': toneHz(3) };
      const audio = listener.measure(expected);
      const a1 = sampleVideo(v1.current!, hueFor(1));
      await new Promise((r) => setTimeout(r, 2000));
      const a2 = sampleVideo(v1.current!, hueFor(1));
      const wrong = sampleVideo(v1.current!, hueFor(3));
      setResult({
        audio,
        checks: {
          hears_bot1: audio['bot-1'] >= 12,
          hears_bot3: audio['bot-3'] >= 12,
          silent_bot2_absent: audio['bot-2'] < 12,
          video_hue_ok: !!a1?.hueOk,
          video_wrong_hue_rejected: wrong ? !wrong.hueOk : false,
          video_moving: !!(a1 && a2 && stripChanged(a1.strip, a2.strip)),
        },
        hueSeen: a1?.hueDeg,
      });
    })().catch((e) => setResult({ error: String(e) }));
  }, []);

  return (
    <main className="p-4 text-sm space-y-2">
      <h1 className="font-semibold">Signal self-test</h1>
      <video ref={v1} autoPlay muted playsInline className="w-40" />
      <video ref={v3} autoPlay muted playsInline className="w-40" />
      <pre id="result">{result ? JSON.stringify(result, null, 2) : 'running…'}</pre>
    </main>
  );
}
