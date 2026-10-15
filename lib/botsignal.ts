// Browser-only helpers. Each bot publishes a unique tone + unique-colour video; every client checks what it
// actually receives (decoded audio spectrum, rendered video pixels) and reports which bots it detected.

export const botNumber = (name: string): number => {
  const m = /^bot-(\d+)$/.exec(name);
  return m ? Number(m[1]) : 0;
};
export const toneHz = (n: number) => 300 + n * 100; // bot-1 = 400 Hz ... bot-15 = 1800 Hz
// Kept low so Chime's 0-1 level meter isn't pinned at 1.00 by a steady tone.
export const BOT_GAIN = 0.03;
export const hueFor = (n: number) => (n * 24) % 360;

export function makeBotMedia(n: number, label: string) {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  osc.frequency.value = toneHz(n);
  const gain = ctx.createGain();
  gain.gain.value = BOT_GAIN;
  const dest = ctx.createMediaStreamDestination();
  osc.connect(gain).connect(dest);
  osc.start();
  ctx.resume().catch(() => {});

  const W = 320, H = 180;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d')!;
  const draw = () => {
    c.fillStyle = `hsl(${hueFor(n)} 90% 45%)`;
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff';
    c.font = 'bold 36px sans-serif';
    c.textAlign = 'center';
    c.fillText(label, W / 2, 70);
    // moving bar in the lower band: lets receivers prove frames keep changing (100 px/s, wraps every 3.2s)
    c.fillRect(((Date.now() / 10) % W) - 20, 120, 40, 20);
  };
  draw();
  const timer = setInterval(draw, 100);
  const video = canvas.captureStream(10);
  return {
    audio: dest.stream,
    video,
    stop: () => { clearInterval(timer); osc.stop(); ctx.close().catch(() => {}); video.getTracks().forEach((t) => t.stop()); },
  };
}

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

export function createToneListener(stream: MediaStream) {
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 8192;
  an.smoothingTimeConstant = 0.3;
  src.connect(an); // analysis only; not connected to speakers
  const buf = new Float32Array(an.frequencyBinCount);
  return {
    // dB above the local noise floor at each expected tone. > ~12 means the tone is clearly present.
    measure(expected: Record<string, number>): Record<string, number> {
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      an.getFloatFrequencyData(buf);
      const binHz = ctx.sampleRate / an.fftSize;
      const out: Record<string, number> = {};
      for (const [name, hz] of Object.entries(expected)) {
        const b = Math.round(hz / binHz);
        const peak = Math.max(buf[b - 1], buf[b], buf[b + 1]);
        // floor window stays within 10 bins (~58 Hz) so neighbouring bots' tones (100 Hz apart) don't pollute it
        const around: number[] = [];
        for (let k = 3; k <= 10; k++) around.push(buf[b - k], buf[b + k]);
        out[name] = Math.round((peak - median(around)) * 10) / 10;
      }
      return out;
    },
    close: () => ctx.close().catch(() => {}),
  };
}

const rgbToHue = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 20) return -1; // grey / black: no colour
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
};

export interface VideoSample { hueOk: boolean; hueDeg: number; strip: number[] }

const scratch = typeof document !== 'undefined' ? document.createElement('canvas') : null;

// Reads the rendered <video> pixels: hue from the plain-colour corners, and a brightness strip across the bar band.
export function sampleVideo(el: HTMLVideoElement, expectedHue: number): VideoSample | null {
  if (!scratch || el.readyState < 2 || !el.videoWidth) return null;
  scratch.width = 64; scratch.height = 36;
  const c = scratch.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(el, 0, 0, 64, 36);
  const px = (x: number, y: number, w: number, h: number) => c.getImageData(x, y, w, h).data;
  const hues: number[] = [];
  for (const [x, y] of [[1, 1], [59, 1], [1, 31], [59, 31]]) {
    const d = px(x, y, 3, 3);
    hues.push(rgbToHue(d[0], d[1], d[2]));
  }
  const valid = hues.filter((h) => h >= 0);
  const hueDeg = valid.length ? Math.round(median(valid)) : -1;
  const diff = hueDeg < 0 ? 999 : Math.min(Math.abs(hueDeg - expectedHue), 360 - Math.abs(hueDeg - expectedHue));
  const strip = px(0, 24, 64, 4);
  const cols: number[] = [];
  for (let x = 0; x < 64; x++) {
    let s = 0;
    for (let y = 0; y < 4; y++) { const i = (y * 64 + x) * 4; s += strip[i] + strip[i + 1] + strip[i + 2]; }
    cols.push(s / 12);
  }
  return { hueOk: diff <= 20, hueDeg, strip: cols };
}

export const stripChanged = (a: number[], b: number[]) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length > 6;
