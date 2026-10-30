import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SecretBox } from './crypto';

describe('SecretBox', () => {
  const box = new SecretBox(randomBytes(32));

  it('round-trips', () => {
    const sealed = box.encrypt('{"password":"hunter2"}', 'ws1:ds1');
    expect(sealed).not.toContain('hunter2');
    expect(box.decrypt(sealed, 'ws1:ds1')).toBe('{"password":"hunter2"}');
  });

  it('uses a fresh IV every time', () => {
    expect(box.encrypt('same', 'ctx')).not.toBe(box.encrypt('same', 'ctx'));
  });

  it('refuses a ciphertext moved to another row', () => {
    const sealed = box.encrypt('secret', 'ws1:ds1');
    expect(() => box.decrypt(sealed, 'ws2:ds1')).toThrow();
  });

  it('refuses tampered ciphertext and wrong keys', () => {
    const sealed = box.encrypt('secret', 'ctx');
    const parts = sealed.split(':');
    const body = Buffer.from(parts[3] ?? '', 'base64');
    body[0] = (body[0] ?? 0) ^ 1;
    parts[3] = body.toString('base64');
    expect(() => box.decrypt(parts.join(':'), 'ctx')).toThrow();
    expect(() => new SecretBox(randomBytes(32)).decrypt(sealed, 'ctx')).toThrow();
  });

  it('rejects keys of the wrong size', () => {
    expect(() => new SecretBox(randomBytes(16))).toThrow(/32 bytes/);
  });
});
