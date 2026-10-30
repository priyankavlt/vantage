import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * AES-256-GCM encryption for secrets at rest (data source credentials).
 * `context` is bound as additional authenticated data, so a ciphertext only
 * decrypts for the row it was written for (it cannot be copied to another row).
 */
export class SecretBox {
  readonly #key: Buffer;

  constructor(key: Buffer) {
    if (key.length !== 32) throw new Error('Encryption key must be exactly 32 bytes');
    this.#key = key;
  }

  /** Parse a base64 key from the environment. */
  static fromBase64(value: string): SecretBox {
    return new SecretBox(Buffer.from(value, 'base64'));
  }

  /** Derive a key from any string. Development only. */
  static fromPassphrase(value: string): SecretBox {
    return new SecretBox(createHash('sha256').update(value).digest());
  }

  encrypt(plaintext: string, context: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.#key, iv);
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString('base64'), tag.toString('base64'), body.toString('base64')].join(
      ':',
    );
  }

  decrypt(payload: string, context: string): string {
    const [version, iv, tag, body] = payload.split(':');
    if (version !== VERSION || !iv || !tag || body === undefined) {
      throw new Error('Unsupported ciphertext format');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.#key, Buffer.from(iv, 'base64'), {
      authTagLength: TAG_BYTES,
    });
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString(
      'utf8',
    );
  }
}
