import type { Browser, BrowserContext } from 'playwright';
import { botKey } from './botkey';

interface BotState {
  browser?: Browser;
  watch: Map<string, { timer: ReturnType<typeof setInterval>; lastHuman: number; base: string }>;
  // room -> botName -> context
  rooms: Map<string, Map<string, BrowserContext>>;
}
const g = globalThis as unknown as { __chimeBots?: BotState };
const state: BotState = (g.__chimeBots ??= { rooms: new Map(), watch: new Map() });

async function getBrowser(): Promise<Browser> {
  if (state.browser?.isConnected()) return state.browser;
  // Loaded lazily so the deployed (Vercel) build never needs Chromium.
  const { chromium } = await import('playwright');
  state.browser = await chromium.launch({
    headless: true,
    // Bots generate their own tone/video in the page, so no fake-device files are needed.
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  return state.browser;
}

// Minutes with no human in the meeting before that room's bots shut themselves down. 0 disables it.
export const idleMinutes = () => Number(process.env.BOT_IDLE_MINUTES ?? 5);
const CHECK_EVERY_MS = 10_000;
const FRESH_MS = 35_000; // a bot report older than this is ignored

// Asks the app (works for a local server and for a deployed one) what the bots see. Bots report how many humans
// are present according to Chime itself, which doesn't depend on a person's tab being in the foreground.
async function checkIdle(room: string) {
  const w = state.watch.get(room);
  const idleMs = idleMinutes() * 60_000;
  if (!w || idleMs <= 0) return;
  try {
    const d = (await (await fetch(`${w.base}/api/report?room=${encodeURIComponent(room)}`, { cache: 'no-store' })).json()) as {
      now: number; reports: { isBot: boolean; ts: number; humans?: number }[];
    };
    const fresh = d.reports.filter((r) => r.isBot && d.now - r.ts <= FRESH_MS && typeof r.humans === 'number');
    if (fresh.length === 0) return; // bots still joining, or the app is unreachable: don't guess
    if (Math.max(...fresh.map((r) => r.humans as number)) > 0) { w.lastHuman = Date.now(); return; }
    if (Date.now() - w.lastHuman >= idleMs) {
      console.log(`[bots] no humans in "${room}" for ${idleMinutes()} min, stopping its bots`);
      await closeBots(room);
    }
  } catch { /* transient network error: try again next tick */ }
}

function watchRoom(room: string, base: string) {
  if (state.watch.has(room) || idleMinutes() <= 0) return;
  // The clock starts when the bots start, so people have the grace period to arrive.
  const timer = setInterval(() => { void checkIdle(room); }, CHECK_EVERY_MS);
  state.watch.set(room, { timer, lastHuman: Date.now(), base });
}

export function listBots(room: string): string[] {
  return [...(state.rooms.get(room)?.keys() ?? [])];
}

export async function spawnBots(
  room: string,
  count: number,
  opts: { screenshare?: boolean; baseUrl?: string; startAt?: number } = {},
) {
  const max = Number(process.env.MAX_BOTS || 15);
  const existing = state.rooms.get(room) ?? new Map<string, BrowserContext>();
  state.rooms.set(room, existing);
  const allowed = Math.max(0, Math.min(count, max - existing.size));
  const base = (opts.baseUrl || process.env.APP_URL || 'http://localhost:3100').replace(/\/$/, '');
  const browser = await getBrowser();
  const started: string[] = [];
  let n = opts.startAt ?? 1;
  for (let i = 0; i < allowed; i++) {
    while (existing.has(`bot-${n}`)) n++;
    const name = `bot-${n}`;
    const ctx = await browser.newContext();
    // Same passwordless login path as humans; the bot key marks the session as a bot.
    const login = await ctx.request.post(`${base}/api/login`, {
      data: { name, bot: true },
      headers: { 'x-bot-key': botKey() },
    });
    if (!login.ok()) { await ctx.close(); throw new Error(`bot login failed: ${login.status()}`); }
    const page = await ctx.newPage();
    const qs = new URLSearchParams({ bot: '1', ...(opts.screenshare ? { share: '1' } : {}) });
    await page.goto(`${base}/room/${encodeURIComponent(room)}?${qs}`);
    existing.set(name, ctx);
    started.push(name);
    watchRoom(room, base);
    n++;
  }
  return { started, total: existing.size, capped: allowed < count };
}

export async function closeBots(room: string) {
  const w = state.watch.get(room);
  if (w) { clearInterval(w.timer); state.watch.delete(room); }
  const ctxs = state.rooms.get(room);
  if (!ctxs) return 0;
  const n = ctxs.size;
  await Promise.all([...ctxs.values()].map((c) => c.close().catch(() => {})));
  state.rooms.delete(room);
  return n;
}
