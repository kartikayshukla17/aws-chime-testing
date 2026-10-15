'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { AudioVideoFacade, DefaultMeetingSession } from 'amazon-chime-sdk-js';
import VideoTile from './VideoTile';
import type { Report } from '@/lib/reports';
import { botNumber, createToneListener, hueFor, makeBotMedia, sampleVideo, stripChanged, toneHz, type VideoSample } from '@/lib/botsignal';

interface Tile { tileId: number; attendeeId: string; content: boolean; local: boolean }
interface Person { name: string; volume: number; muted: boolean }
interface Dev { deviceId: string; label: string }

const SPEAKING_THRESHOLD = 0.1;
const REPORT_EVERY_MS = 10_000; // keeps us inside free-tier request/command quotas
const ADJ = ['Swift', 'Quiet', 'Brave', 'Lucky', 'Calm', 'Witty', 'Bold', 'Sunny'];
const ANIMAL = ['Otter', 'Falcon', 'Panda', 'Fox', 'Heron', 'Lynx', 'Koala', 'Gecko'];
const randomName = () => `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${ANIMAL[Math.floor(Math.random() * ANIMAL.length)]}`;
interface LogEvent { t: number; name: string; joined: boolean }
// ExternalUserId is `${kind}-${name}-${id}`; show just the name.
const pretty = (x: string) => x.replace(/^(human|bot)-/, '').replace(/-[0-9a-f]{8}$/, '');

export default function Room({ room }: { room: string }) {
  const sp = useSearchParams();
  const autoShare = sp.get('share') === '1';
  const [name, setName] = useState('');
  const [code, setCode] = useState(sp.get('code') || '');
  const [me, setMe] = useState<{ name: string; bot: boolean } | null | undefined>(undefined);
  const [needCode, setNeedCode] = useState(false);
  const isBot = sp.get('bot') === '1' || !!me?.bot;
  const [phase, setPhase] = useState<'lobby' | 'joining' | 'joined' | 'error'>('lobby');
  const [error, setError] = useState('');
  const [tiles, setTiles] = useState<Record<number, Tile>>({});
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [myId, setMyId] = useState('');
  const [mics, setMics] = useState<Dev[]>([]);
  const [cams, setCams] = useState<Dev[]>([]);
  const [outs, setOuts] = useState<Dev[]>([]);
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [joinMs, setJoinMs] = useState<number | null>(null);
  const [reconnects, setReconnects] = useState(0);
  const [bots, setBots] = useState<string[]>([]);
  const [botCount, setBotCount] = useState(3);
  const [botsEnabled, setBotsEnabled] = useState(false);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [notice, setNotice] = useState('');
  const sessionRef = useRef<DefaultMeetingSession | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [av, setAv] = useState<AudioVideoFacade | null>(null);
  const namesRef = useRef<Record<string, string>>({});
  const heardRef = useRef<Record<string, number>>({});
  const tileCountRef = useRef(0);
  const meNameRef = useRef('');
  const myIdRef = useRef('');
  const lastSentRef = useRef(0);
  const signalsRef = useRef<NonNullable<Report['signals']>>({ audio: {}, video: {} });
  const prevStripRef = useRef<Record<string, VideoSample['strip']>>({});
  const botMediaRef = useRef<ReturnType<typeof makeBotMedia> | null>(null);
  const toneRef = useRef<ReturnType<typeof createToneListener> | null>(null);

  // Clears everything tied to the current session so the user can rejoin cleanly.
  const resetLocal = useCallback(() => {
    botMediaRef.current?.stop(); botMediaRef.current = null;
    toneRef.current?.close(); toneRef.current = null;
    namesRef.current = {}; heardRef.current = {}; prevStripRef.current = {};
    signalsRef.current = { audio: {}, video: {} };
    lastSentRef.current = 0;
    setTiles({}); setPeople({}); setEvents([]); setAv(null);
    setMuted(false); setCamOn(true); setSharing(false); setBots([]);
  }, []);

  const join = useCallback(async () => {
    setNotice('');
    setPhase('joining');
    const t0 = Date.now();
    try {
      const res = await fetch('/api/attendee', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ room }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'attendee failed');

      const sdk = await import('amazon-chime-sdk-js');
      const logger = new sdk.ConsoleLogger('chime', sdk.LogLevel.WARN);
      const deviceController = new sdk.DefaultDeviceController(logger);
      const config = new sdk.MeetingSessionConfiguration(
        { Meeting: data.meeting } as never,
        { Attendee: data.attendee } as never,
      );
      const session = new sdk.DefaultMeetingSession(config, logger, deviceController);
      sessionRef.current = session;
      const audioVideo = session.audioVideo;
      setMyId(data.attendee.AttendeeId);
      myIdRef.current = data.attendee.AttendeeId;
      meNameRef.current = data.displayName;

      audioVideo.addObserver({
        audioVideoDidStart: () => setJoinMs(Date.now() - t0),
        audioVideoDidStartConnecting: (reconnecting: boolean) => { if (reconnecting) setReconnects((n) => n + 1); },
        audioVideoDidStop: (status) => {
          if (status.statusCode() === sdk.MeetingSessionStatusCode.MeetingEnded) setNotice('The meeting was ended for everyone.');
          resetLocal();
          setPhase('lobby');
        },
        metricsDidReceive: (rep) => {
          if (Date.now() - lastSentRef.current < REPORT_EVERY_MS) return;
          lastSentRef.current = Date.now();
          const m = rep.getObservableMetrics();
          const vm = rep.getObservableVideoMetrics();
          const tilesOut: Report['tiles'] = [];
          for (const [aid, streams] of Object.entries(vm)) {
            if (aid === myIdRef.current) continue; // own upstream tile has no downstream stats
            const first = Object.values(streams)[0] as Record<string, number> | undefined;
            if (!first) continue;
            tilesOut.push({
              from: namesRef.current[aid.split('#')[0]] || aid.slice(0, 6),
              content: aid.includes('#'),
              width: first.videoDownstreamFrameWidth,
              height: first.videoDownstreamFrameHeight,
              fps: first.videoDownstreamFramesDecodedPerSecond,
              kbps: first.videoDownstreamBitrate, // raw SDK value
              lossPct: first.videoDownstreamPacketLossPercent,
              delayMs: first.videoDownstreamDelayMs,
            });
          }
          const report: Report = {
            observer: meNameRef.current,
            isBot,
            ts: Date.now(),
            tilesVisible: tileCountRef.current,
            tiles: tilesOut,
            hearing: { ...heardRef.current },
            signals: signalsRef.current,
            net: {
              rttMs: m.currentRoundTripTimeMs,
              audioLossFraction: m.audioPacketsReceivedFractionLoss,
              downKbps: m.availableIncomingBitrate,
              upKbps: m.availableOutgoingBitrate,
            },
          };
          heardRef.current = {};
          fetch('/api/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ room, report }) }).catch(() => {});
        },
        videoTileDidUpdate: (ts) => {
          if (!ts.tileId || !ts.boundAttendeeId) return;
          setTiles((t) => ({
            ...t,
            [ts.tileId!]: { tileId: ts.tileId!, attendeeId: ts.boundAttendeeId!, content: !!ts.isContent, local: !!ts.localTile },
          }));
        },
        videoTileWasRemoved: (id) => setTiles((t) => { const { [id]: _x, ...rest } = t; return rest; }),
      });
      audioVideo.addContentShareObserver({
        contentShareDidStart: () => setSharing(true),
        contentShareDidStop: () => setSharing(false),
      });

      audioVideo.realtimeSubscribeToAttendeeIdPresence((id: string, present: boolean, externalUserId?: string) => {
        setPeople((p) => {
          if (!present) {
            if (p[id]) setEvents((ev) => [...ev, { t: Date.now(), name: p[id].name, joined: false }].slice(-30));
            const { [id]: _x, ...rest } = p; return rest;
          }
          if (id.includes('#')) return p; // content-share pseudo attendee
          audioVideo.realtimeSubscribeToVolumeIndicator(id, (_a, volume, mutedFlag) => {
            const nm = namesRef.current[id];
            if (nm && !mutedFlag) heardRef.current[nm] = Math.max(heardRef.current[nm] ?? 0, volume ?? 0);
            setPeople((q) => (q[id] ? { ...q, [id]: { ...q[id], volume: volume ?? 0, muted: !!mutedFlag } } : q));
          });
          const nm = externalUserId ? pretty(externalUserId) : id.slice(0, 6);
          namesRef.current[id] = nm;
          if (!p[id]) setEvents((ev) => [...ev, { t: Date.now(), name: nm, joined: true }].slice(-30));
          return { ...p, [id]: { name: nm, volume: 0, muted: false } };
        });
      });

      const list = async (fn: () => Promise<MediaDeviceInfo[]>) =>
        (await fn()).map((d) => ({ deviceId: d.deviceId, label: d.label || d.deviceId.slice(0, 8) }));
      const [m, c, o] = await Promise.all([
        list(() => audioVideo.listAudioInputDevices()),
        list(() => audioVideo.listVideoInputDevices()),
        list(() => audioVideo.listAudioOutputDevices()),
      ]);
      setMics(m); setCams(c); setOuts(o);
      audioVideo.addDeviceChangeObserver({
        audioInputsChanged: (d) => setMics((d || []).map((x) => ({ deviceId: x.deviceId, label: x.label || x.deviceId.slice(0, 8) }))),
        videoInputsChanged: (d) => setCams((d || []).map((x) => ({ deviceId: x.deviceId, label: x.label || x.deviceId.slice(0, 8) }))),
        audioOutputsChanged: (d) => setOuts((d || []).map((x) => ({ deviceId: x.deviceId, label: x.label || x.deviceId.slice(0, 8) }))),
      });

      if (isBot) {
        // Bots publish a unique tone + unique-colour video so receivers can verify exactly who they hear/see.
        const media = makeBotMedia(botNumber(data.displayName), data.displayName);
        botMediaRef.current = media;
        await audioVideo.startAudioInput(media.audio);
        await audioVideo.startVideoInput(media.video);
        audioVideo.chooseVideoInputQuality(320, 180, 10);
      } else {
        if (m[0]) await audioVideo.startAudioInput(m[0].deviceId);
        if (c[0]) await audioVideo.startVideoInput(c[0].deviceId);
      }
      if (audioRef.current) audioVideo.bindAudioElement(audioRef.current);
      audioVideo.start();
      audioVideo.startLocalVideoTile();
      setAv(audioVideo);
      setPhase('joined');
      if (autoShare) setTimeout(() => audioVideo.startContentShareFromScreenCapture().catch(() => {}), 3000);
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    }
  }, [room, isBot, autoShare, resetLocal]);

  useEffect(() => { tileCountRef.current = Object.keys(tiles).length; }, [tiles]);

  useEffect(() => { setName((n) => n || randomName()); }, []);

  useEffect(() => {
    fetch('/api/me').then((r) => r.json()).then((d) => { setMe(d.user); setNeedCode(!!d.accessCodeRequired); }).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    // Bots arrive with a pre-made bot session cookie and join immediately.
    if (isBot && me?.bot && phase === 'lobby') join();
  }, [isBot, me, phase, join]);

  const login = async () => {
    setError('');
    const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, code }) });
    const d = await r.json();
    if (!r.ok) return setError(d.error || 'login failed');
    setMe({ name: d.name, bot: false });
  };
  const logout = async () => { await fetch('/api/logout', { method: 'POST' }); setMe(null); };

  useEffect(() => () => { sessionRef.current?.audioVideo.stop(); botMediaRef.current?.stop(); toneRef.current?.close(); }, []);

  // Every 2s: measure the decoded audio spectrum for each bot's tone, and the rendered pixels of each bot's tile.
  useEffect(() => {
    if (phase !== 'joined') return;
    const timer = setInterval(() => {
      const me = meNameRef.current;
      const bots = Object.values(namesRef.current).filter((n) => botNumber(n) > 0 && n !== me);

      const stream = audioRef.current?.srcObject;
      if (stream instanceof MediaStream && !toneRef.current) {
        try { toneRef.current = createToneListener(stream); } catch {}
      }
      const audio: Record<string, number> = {};
      if (toneRef.current && bots.length) {
        Object.assign(audio, toneRef.current.measure(Object.fromEntries(bots.map((n) => [n, toneHz(botNumber(n))]))));
      }

      const video: Record<string, { hueOk: boolean; moving: boolean }> = {};
      document.querySelectorAll<HTMLVideoElement>('video[data-name]').forEach((el) => {
        const name = el.dataset.name!;
        if (el.dataset.content === '1' || botNumber(name) === 0 || name === me) return;
        const smp = sampleVideo(el, hueFor(botNumber(name)));
        if (!smp) { video[name] = { hueOk: false, moving: false }; return; }
        const prev = prevStripRef.current[name];
        prevStripRef.current[name] = smp.strip;
        video[name] = { hueOk: smp.hueOk, moving: prev ? stripChanged(prev, smp.strip) : false };
      });
      signalsRef.current = { audio, video };
    }, 2000);
    return () => clearInterval(timer);
  }, [phase]);

  const refreshBots = useCallback(async () => {
    const r = await fetch(`/api/bots?room=${encodeURIComponent(room)}`);
    setBotsEnabled(r.ok);
    if (r.ok) setBots((await r.json()).bots);
  }, [room]);
  useEffect(() => { if (phase === 'joined' && !isBot) refreshBots(); }, [phase, isBot, refreshBots]);

  const toggleMute = () => {
    if (!av) return;
    if (muted) av.realtimeUnmuteLocalAudio(); else av.realtimeMuteLocalAudio();
    setMuted(!muted);
  };
  const toggleCam = () => {
    if (!av) return;
    if (camOn) av.stopLocalVideoTile(); else av.startLocalVideoTile();
    setCamOn(!camOn);
  };
  const toggleShare = async () => {
    if (!av) return;
    if (sharing) av.stopContentShare();
    else await av.startContentShareFromScreenCapture().catch((e) => setError(String(e)));
  };
  const addBots = async (share = false) => {
    const r = await fetch('/api/bots', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ room, count: botCount, screenshare: share }) });
    const d = await r.json();
    if (!r.ok) setError(d.error);
    refreshBots();
  };
  const removeBots = async () => {
    await fetch('/api/bots', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ room }) });
    refreshBots();
  };
  const leave = () => {
    if (!av) return;
    if (sharing) av.stopContentShare();
    av.stopLocalVideoTile();
    av.stopVideoInput().catch(() => {});
    av.stopAudioInput().catch(() => {});
    av.stop(); // triggers audioVideoDidStop -> resetLocal
  };
  const endMeeting = async () => {
    if (!window.confirm('End the meeting for everyone in this room?')) return;
    const r = await fetch('/api/meeting', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ room }) });
    if (!r.ok) setError((await r.json().catch(() => ({}))).error || 'could not end meeting');
  };

  const tileList = Object.values(tiles);
  const label = (t: Tile) => people[t.attendeeId.split('#')[0]]?.name || t.attendeeId.slice(0, 6);
  const speaking = (t: Tile) => (people[t.attendeeId.split('#')[0]]?.volume ?? 0) > SPEAKING_THRESHOLD;

  if (me === undefined) return <main className="p-6 text-sm text-zinc-400">Loading…</main>;

  if (!me) {
    return (
      <main className="mx-auto max-w-md p-6 space-y-3">
        <h1 className="text-lg font-semibold">Sign in to join “{room}”</h1>
        <p className="text-sm text-zinc-400">No password. We picked a name for you — edit it or just continue.</p>
        <input className="w-full rounded bg-zinc-800 p-2" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name && login()} />
        {needCode && <input className="w-full rounded bg-zinc-800 p-2" placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value)} />}
        <button className="rounded bg-blue-600 px-4 py-2 disabled:opacity-40" disabled={!name} onClick={login}>Continue</button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </main>
    );
  }

  if (phase === 'lobby' || phase === 'error') {
    return (
      <main className="mx-auto max-w-md p-6 space-y-3">
        <h1 className="text-lg font-semibold">Room: {room}</h1>
        <p className="text-sm text-zinc-400">Signed in as <b>{me.name}</b> · <button className="underline" onClick={logout}>switch</button></p>
        {notice && <p className="text-amber-400 text-sm">{notice}</p>}
        <button className="rounded bg-blue-600 px-4 py-2" onClick={() => join()}>{notice ? 'Rejoin' : 'Join'}</button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </main>
    );
  }

  return (
    <main className="p-4 space-y-3" data-phase={phase} data-tiles={tileList.length} data-people={Object.keys(people).length}>
      <audio ref={audioRef} className="hidden" />
      <header className="flex flex-wrap items-center gap-2 text-sm">
        <b>{room}</b>
        <a className="underline text-blue-400" href={`/dashboard/${encodeURIComponent(room)}`} target="_blank">receiving dashboard</a>
        <span className="text-zinc-400">{phase === 'joining' ? 'joining…' : `${Object.keys(people).length} in room · ${tileList.length} tiles · join ${joinMs ?? '…'}ms · reconnects ${reconnects}`}</span>
      </header>
      {phase === 'joined' && av && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {tileList.map((t) => (
              <VideoTile key={t.tileId} tileId={t.tileId} label={t.local ? `${label(t)} (you)` : label(t)} name={label(t)} speaking={speaking(t)} content={t.content} audioVideo={av} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button className="rounded bg-zinc-700 px-3 py-1" onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
            <button className="rounded bg-zinc-700 px-3 py-1" onClick={toggleCam}>{camOn ? 'Camera off' : 'Camera on'}</button>
            <button className="rounded bg-zinc-700 px-3 py-1" onClick={toggleShare}>{sharing ? 'Stop share' : 'Share screen'}</button>
            <select className="rounded bg-zinc-800 p-1" onChange={(e) => av.startAudioInput(e.target.value)}>{mics.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select>
            <select className="rounded bg-zinc-800 p-1" onChange={(e) => av.startVideoInput(e.target.value)}>{cams.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select>
            <select className="rounded bg-zinc-800 p-1" onChange={(e) => av.chooseAudioOutput(e.target.value)}>{outs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select>
            <button className="rounded bg-red-700 px-3 py-1" onClick={leave}>Leave</button>
            {!isBot && <button className="rounded bg-red-900 px-3 py-1" onClick={endMeeting}>End meeting for all</button>}
          </div>
          {!isBot && botsEnabled && (
            <div className="rounded border border-zinc-700 p-3 text-sm space-y-2">
              <div className="font-medium">Proxy users (bots) — {bots.length} running {bots.length ? `(${bots.join(', ')})` : ''}</div>
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" min={1} max={15} className="w-16 rounded bg-zinc-800 p-1" value={botCount} onChange={(e) => setBotCount(Number(e.target.value))} />
                <button className="rounded bg-emerald-700 px-3 py-1" onClick={() => addBots(false)}>Add bots</button>
                <button className="rounded bg-emerald-900 px-3 py-1" onClick={() => addBots(true)}>Add bots (with screenshare)</button>
                <button className="rounded bg-zinc-700 px-3 py-1" onClick={removeBots}>Remove bots</button>
              </div>
            </div>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="grid gap-3 md:grid-cols-2 text-xs">
            <div className="rounded border border-zinc-700 p-3">
              <div className="mb-1 font-medium text-sm">In the room ({Object.keys(people).length})</div>
              <ul className="space-y-0.5">
                {Object.entries(people).sort((a, b) => a[1].name.localeCompare(b[1].name, undefined, { numeric: true })).map(([id, p]) => {
                  const hasVideo = tileList.some((t) => !t.content && t.attendeeId === id);
                  return (
                    <li key={id} className="flex justify-between">
                      <span>{botNumber(p.name) ? '🤖 ' : ''}{p.name}{id === myId ? ' (you)' : ''}</span>
                      <span className="text-zinc-400">{p.muted ? 'muted' : `vol ${p.volume.toFixed(2)}`} · {hasVideo ? 'video' : 'no video'}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="rounded border border-zinc-700 p-3">
              <div className="mb-1 font-medium text-sm">Joined / left</div>
              <ul className="space-y-0.5 text-zinc-400">
                {events.length === 0 && <li>nothing yet</li>}
                {[...events].reverse().map((e, i) => (
                  <li key={i}>{new Date(e.t).toLocaleTimeString()} — {e.name} {e.joined ? 'joined' : 'left'}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
