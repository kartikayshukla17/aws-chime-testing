// Usage: npm run bots -- --room test --count 5 [--share]
// Requires the dev server to be running (bots open /room/<room> in headless Chromium).
import { spawnBots, closeBots } from '../lib/bots';

const args = process.argv.slice(2);
const get = (k: string, d: string) => (args.includes(`--${k}`) ? args[args.indexOf(`--${k}`) + 1] : d);
const room = get('room', 'test');
const count = Number(get('count', '3'));
const share = args.includes('--share');

(async () => {
  const res = await spawnBots(room, count, { screenshare: share });
  console.log('started', res);
  const stop = async () => { await closeBots(room); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  console.log('Bots running. Ctrl+C to stop.');
})();
