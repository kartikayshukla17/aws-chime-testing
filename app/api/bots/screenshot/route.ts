import { screenshotBot } from '@/lib/bots';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const room = u.searchParams.get('room');
  const name = u.searchParams.get('name');
  if (!room || !name) return new Response('room and name required', { status: 400 });
  const img = await screenshotBot(room, name);
  if (!img) return new Response('not found', { status: 404 });
  return new Response(new Uint8Array(img), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-store' } });
}
