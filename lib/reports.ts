import { del, hdel, hgetAllEntries, hgetAllJSON, hsetJSON } from './store';

export interface TileReport { from: string; content: boolean; width?: number; height?: number; fps?: number; kbps?: number; lossPct?: number; delayMs?: number }
export interface Report {
  observer: string;
  isBot: boolean;
  ts: number;
  tilesVisible: number;
  tiles: TileReport[];
  hearing: Record<string, number>; // remote name -> max volume (0..1) heard since last report
  // Verified signals from bot signatures: dB above noise floor per bot tone (>12 = heard), and per-bot video checks.
  signals?: { audio: Record<string, number>; video: Record<string, { hueOk: boolean; moving: boolean }> };
  // For bots only: what this bot is currently publishing (default off; humans toggle it).
  publishing?: { audio: boolean; video: boolean };
  net: { rttMs?: number; audioLossFraction?: number; downKbps?: number; upKbps?: number };
}

const key = (room: string) => `reports:${room}`;
const TTL_SEC = 15 * 60;

// Rooms that have recently reported, so /bots can list active meetings. Touched at most once a minute per room.
const lastTouch = new Map<string, number>();
export async function saveReport(room: string, r: Report) {
  await hsetJSON(key(room), r.observer, r, TTL_SEC);
  if (Date.now() - (lastTouch.get(room) ?? 0) > 60_000) {
    lastTouch.set(room, Date.now());
    await hsetJSON('rooms', room, Date.now(), TTL_SEC);
  }
}
export const removeReport = (room: string, observer: string) => hdel(key(room), observer);
export const listRooms = async () => Object.keys(await hgetAllEntries<number>('rooms'));
export const getReports = (room: string) => hgetAllJSON<Report>(key(room));
export const clearReports = (room: string) => del(key(room));
