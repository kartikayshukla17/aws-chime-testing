import path from 'node:path';
import fs from 'node:fs';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { botKey } from './session';

interface BotState {
  browser?: Browser;
  // room -> botName -> context
  rooms: Map<string, Map<string, BrowserContext>>;
  pages: Map<string, Page>; // `${room}/${name}` -> page
}
const g = globalThis as unknown as { __chimeBots?: BotState };
const state: BotState = (g.__chimeBots ??= { rooms: new Map(), pages: new Map() });

const assetsDir = path.join(process.cwd(), 'assets');
const videoFile = path.join(assetsDir, 'bot.y4m');
const audioFile = path.join(assetsDir, 'bot.wav');

async function getBrowser(): Promise<Browser> {
  if (state.browser?.isConnected()) return state.browser;
  if (!fs.existsSync(videoFile) || !fs.existsSync(audioFile)) {
    throw new Error('Missing bot media. Run: npm run assets');
  }
  state.browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${videoFile}`,
      `--use-file-for-fake-audio-capture=${audioFile}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  return state.browser;
}

export function listBots(room: string): string[] {
  return [...(state.rooms.get(room)?.keys() ?? [])];
}

export async function spawnBots(room: string, count: number, opts: { screenshare?: boolean } = {}) {
  const max = Number(process.env.MAX_BOTS || 10);
  const existing = state.rooms.get(room) ?? new Map<string, BrowserContext>();
  state.rooms.set(room, existing);
  const allowed = Math.max(0, Math.min(count, max - existing.size));
  const base = (process.env.APP_URL || 'http://localhost:3100').replace(/\/$/, '');
  const browser = await getBrowser();
  const started: string[] = [];
  for (let i = 0; i < allowed; i++) {
    let n = existing.size + 1;
    while (existing.has(`bot-${n}`)) n++;
    const name = `bot-${n}`;
    const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
    // Same passwordless login path as humans; the bot key marks the session as a bot.
    const login = await ctx.request.post(`${base}/api/login`, {
      data: { name, bot: true },
      headers: { 'x-bot-key': botKey() },
    });
    if (!login.ok()) throw new Error(`bot login failed: ${login.status()}`);
    const page = await ctx.newPage();
    state.pages.set(`${room}/${name}`, page);
    const qs = new URLSearchParams({ bot: '1', ...(opts.screenshare ? { share: '1' } : {}) });
    await page.goto(`${base}/room/${encodeURIComponent(room)}?${qs}`);
    existing.set(name, ctx);
    started.push(name);
  }
  return { started, total: existing.size, capped: allowed < count };
}

export async function closeBots(room: string) {
  const ctxs = state.rooms.get(room);
  if (!ctxs) return 0;
  const n = ctxs.size;
  await Promise.all([...ctxs.values()].map((c) => c.close().catch(() => {})));
  state.rooms.delete(room);
  for (const k of [...state.pages.keys()]) if (k.startsWith(`${room}/`)) state.pages.delete(k);
  return n;
}

export async function screenshotBot(room: string, name: string): Promise<Buffer | null> {
  const page = state.pages.get(`${room}/${name}`);
  if (!page || page.isClosed()) return null;
  return page.screenshot({ type: 'jpeg', quality: 60 });
}
