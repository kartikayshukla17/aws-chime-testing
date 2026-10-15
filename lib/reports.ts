import { del, hgetAllJSON, hsetJSON } from './store';

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
  net: { rttMs?: number; audioLossFraction?: number; downKbps?: number; upKbps?: number };
}

const key = (room: string) => `reports:${room}`;
const TTL_SEC = 15 * 60;

export const saveReport = (room: string, r: Report) => hsetJSON(key(room), r.observer, r, TTL_SEC);
export const getReports = (room: string) => hgetAllJSON<Report>(key(room));
export const clearReports = (room: string) => del(key(room));
