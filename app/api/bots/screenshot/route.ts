import { screenshotBot } from '@/lib/bots';

export const runtime = 'nodejs';

// Bots need Chromium, so they only run on a machine you control (set ENABLE_BOTS=1). Not on Vercel.
const disabled = () => process.env.ENABLE_BOTS !== '1';
const off = () => Response.json({ error: 'bots disabled on this server' }, { status: 501 });
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (disabled()) return off();
  const u = new URL(req.url);
  const room = u.searchParams.get('room');
  const name = u.searchParams.get('name');
  if (!room || !name) return new Response('room and name required', { status: 400 });
  const img = await screenshotBot(room, name);
  if (!img) return new Response('not found', { status: 404 });
  return new Response(new Uint8Array(img), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-store' } });
}
