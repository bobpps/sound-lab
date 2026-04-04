import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../../src/db/local/crypto.js';

describe('crypto', () => {
  const key = 'test-encryption-key-32chars-long!';

  it('encrypts and decrypts a string', () => {
    const original = 'sk-test-api-key-12345';
    const encrypted = encrypt(original, key);
    expect(encrypted).not.toBe(original);
    expect(decrypt(encrypted, key)).toBe(original);
  });

  it('produces different ciphertext for same input (random IV)', () => {
    const original = 'same-input';
    const a = encrypt(original, key);
    const b = encrypt(original, key);
    expect(a).not.toBe(b);
  });

  it('throws on wrong key', () => {
    const encrypted = encrypt('secret', key);
    expect(() => decrypt(encrypted, 'wrong-key-that-is-32chars-long!')).toThrow();
  });

  it('handles empty string', () => {
    const encrypted = encrypt('', key);
    expect(decrypt(encrypted, key)).toBe('');
  });

  it('handles unicode', () => {
    const original = 'key-test-unicode';
    const encrypted = encrypt(original, key);
    expect(decrypt(encrypted, key)).toBe(original);
  });
});
