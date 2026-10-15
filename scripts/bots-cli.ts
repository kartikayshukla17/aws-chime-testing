// Run bots from your machine against a local OR deployed app.
//   npm run bots -- --url https://your-app.vercel.app --room test --count 5 [--start 6] [--share]
// Use --start so a second runner machine continues numbering (bot-6, bot-7, ...) without clashing names.
// Needs the same BOT_KEY (and ACCESS_CODE, if set) as the target server, in your local .env.
import 'dotenv/config';
import { spawnBots, closeBots, listBots } from '../lib/bots';

const args = process.argv.slice(2);
const get = (k: string, d: string) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const url = get('url', process.env.APP_URL || 'http://localhost:3100');
const room = get('room', 'test');
const count = Number(get('count', '3'));
const share = args.includes('--share');
const startAt = Number(get('start', '1'));

if (!process.env.BOT_KEY) {
  console.error('BOT_KEY is not set. It must equal the BOT_KEY configured on the server at', url);
  process.exit(1);
}

(async () => {
  const res = await spawnBots(room, count, { screenshare: share, baseUrl: url, startAt });
  console.log('started', res, '->', url);
  const stop = async () => { await closeBots(room); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  console.log('Bots running. Ctrl+C to stop (they also stop on their own when no humans remain; see BOT_IDLE_MINUTES).');
  setInterval(() => { if (listBots(room).length === 0) { console.log('No bots left, exiting.'); process.exit(0); } }, 5000);
})();
