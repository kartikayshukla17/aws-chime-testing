import { randomBytes } from 'node:crypto';

const g = globalThis as unknown as { __ctBotKey?: string };
// Bots authenticate with this key. Set BOT_KEY when bots run on a different machine than the server (e.g. Vercel).
export const botKey = () => process.env.BOT_KEY || (g.__ctBotKey ??= randomBytes(16).toString('hex'));
