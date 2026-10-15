import { Redis } from '@upstash/redis';

// Small KV abstraction: Upstash Redis when configured (needed on Vercel), in-memory otherwise (local dev).
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

export const usingRedis = !!redis;

interface Mem { kv: Map<string, { v: unknown; exp: number }>; hashes: Map<string, { f: Map<string, unknown>; exp: number }> }
const g = globalThis as unknown as { __ctMem?: Mem };
const mem = (g.__ctMem ??= { kv: new Map(), hashes: new Map() });
const alive = (exp: number) => exp > Date.now();

export async function getJSON<T>(key: string): Promise<T | null> {
  if (redis) return (await redis.get<T>(key)) ?? null;
  const e = mem.kv.get(key);
  return e && alive(e.exp) ? (e.v as T) : null;
}

export async function setJSON(key: string, value: unknown, ttlSec: number): Promise<void> {
  if (redis) { await redis.set(key, value, { ex: ttlSec }); return; }
  mem.kv.set(key, { v: value, exp: Date.now() + ttlSec * 1000 });
}

// Set only if absent. Returns true if this call wrote it.
export async function setIfAbsent(key: string, value: unknown, ttlSec: number): Promise<boolean> {
  if (redis) return (await redis.set(key, value, { nx: true, ex: ttlSec })) === 'OK';
  if (await getJSON(key)) return false;
  await setJSON(key, value, ttlSec);
  return true;
}

export async function del(key: string): Promise<void> {
  if (redis) { await redis.del(key); return; }
  mem.kv.delete(key); mem.hashes.delete(key);
}

export async function hsetJSON(key: string, field: string, value: unknown, ttlSec: number): Promise<void> {
  if (redis) { await redis.hset(key, { [field]: value }); await redis.expire(key, ttlSec); return; }
  const h = mem.hashes.get(key) ?? { f: new Map(), exp: 0 };
  h.f.set(field, value); h.exp = Date.now() + ttlSec * 1000;
  mem.hashes.set(key, h);
}

export async function hgetAllEntries<T>(key: string): Promise<Record<string, T>> {
  if (redis) return (await redis.hgetall<Record<string, T>>(key)) ?? {};
  const h = mem.hashes.get(key);
  return h && alive(h.exp) ? (Object.fromEntries(h.f) as Record<string, T>) : {};
}

export async function hgetAllJSON<T>(key: string): Promise<T[]> {
  if (redis) return Object.values((await redis.hgetall<Record<string, T>>(key)) ?? {});
  const h = mem.hashes.get(key);
  return h && alive(h.exp) ? ([...h.f.values()] as T[]) : [];
}
