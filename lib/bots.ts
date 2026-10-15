import type { Browser, BrowserContext } from 'playwright';
import { botKey } from './botkey';

interface BotState {
  browser?: Browser;
  // room -> botName -> context
  rooms: Map<string, Map<string, BrowserContext>>;
}
const g = globalThis as unknown as { __chimeBots?: BotState };
const state: BotState = (g.__chimeBots ??= { rooms: new Map() });

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
    n++;
  }
  return { started, total: existing.size, capped: allowed < count };
}

export async function closeBots(room: string) {
  const ctxs = state.rooms.get(room);
  if (!ctxs) return 0;
  const n = ctxs.size;
  await Promise.all([...ctxs.values()].map((c) => c.close().catch(() => {})));
  state.rooms.delete(room);
  return n;
}
