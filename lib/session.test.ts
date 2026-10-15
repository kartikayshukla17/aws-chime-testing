import { describe, it, expect } from 'vitest';
import { encode, decode, cleanName } from './session';

describe('session cookie', () => {
  it('round-trips a session', () => {
    const s = { id: 'ab12cd34', name: 'Asha', bot: false };
    expect(decode(encode(s))).toEqual(s);
  });
  it('rejects a tampered payload', () => {
    const t = encode({ id: 'x', name: 'Asha', bot: false });
    const forged = Buffer.from(JSON.stringify({ id: 'x', name: 'Asha', bot: true })).toString('base64url') + '.' + t.split('.')[1];
    expect(decode(forged)).toBeNull();
  });
  it('rejects garbage and empty', () => {
    expect(decode('nope')).toBeNull();
    expect(decode(undefined)).toBeNull();
  });
  it('cleans display names', () => {
    expect(cleanName('  A<s>ha!  ')).toBe('Asha');
  });
});
