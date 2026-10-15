export interface TileReport { from: string; content: boolean; width?: number; height?: number; fps?: number; kbps?: number; lossPct?: number; delayMs?: number }
export interface Report {
  observer: string;
  isBot: boolean;
  ts: number;
  tilesVisible: number;
  tiles: TileReport[];
  hearing: Record<string, number>; // remote name -> max volume (0..1) heard since last report
  net: { rttMs?: number; audioLossFraction?: number; downKbps?: number; upKbps?: number };
}

const g = globalThis as unknown as { __ctReports?: Map<string, Map<string, Report>> };
const store = (g.__ctReports ??= new Map());

export function saveReport(room: string, r: Report) {
  const m = store.get(room) ?? new Map<string, Report>();
  store.set(room, m);
  m.set(r.observer, r);
}
export const getReports = (room: string) => [...(store.get(room)?.values() ?? [])];
export const clearReports = (room: string) => store.delete(room);
