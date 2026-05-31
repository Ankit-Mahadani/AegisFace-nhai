/**
 * AES-256-GCM encryption helpers.
 *
 * Uses the Web Crypto API. On Hermes/React Native `crypto.subtle` is
 * available via globalThis.crypto since RN 0.71.
 * The key is stored in react-native-keychain (Android Keystore / iOS Keychain).
 */
import * as Keychain from 'react-native-keychain';
import { KEYCHAIN_SERVICE } from '../config/constants';

const KEY_LABEL = 'aegisface_aes_key';
const IV_LENGTH = 12; // GCM nonce length

function getWebCrypto(): Crypto {
  return (globalThis as unknown as { crypto: Crypto }).crypto;
}

/** Copy any Uint8Array into a fresh ArrayBuffer (resolves SharedArrayBuffer ambiguity). */
function toArrayBuffer(src: Uint8Array | ArrayBuffer): ArrayBuffer {
  if (src instanceof ArrayBuffer) {
    const dst = new ArrayBuffer(src.byteLength);
    new Uint8Array(dst).set(new Uint8Array(src));
    return dst;
  }
  const dst = new ArrayBuffer(src.byteLength);
  new Uint8Array(dst).set(src);
  return dst;
}

// ─── Key management ──────────────────────────────────────────────────────────

async function getOrCreateKey(): Promise<CryptoKey> {
  const wc = getWebCrypto();
  const stored = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  if (stored) {
    const rawBuf = toArrayBuffer(hexToBytes(stored.password));
    return wc.subtle.importKey('raw', rawBuf, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  const key = await wc.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const exported = await wc.subtle.exportKey('raw', key);
  const hex = bytesToHex(new Uint8Array(exported));
  await Keychain.setGenericPassword(KEY_LABEL, hex, { service: KEYCHAIN_SERVICE });
  return key;
}

// ─── Public helpers ──────────────────────────────────────────────────────────

export async function encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
  const wc = getWebCrypto();
  const key = await getOrCreateKey();

  const ivBuf = new ArrayBuffer(IV_LENGTH);
  wc.getRandomValues(new Uint8Array(ivBuf));
  const ptBuf = toArrayBuffer(plaintext);

  const cipherBuf = await wc.subtle.encrypt({ name: 'AES-GCM', iv: ivBuf }, key, ptBuf);

  const result = new Uint8Array(IV_LENGTH + cipherBuf.byteLength);
  result.set(new Uint8Array(ivBuf), 0);
  result.set(new Uint8Array(cipherBuf), IV_LENGTH);
  return result;
}

export async function decrypt(data: Uint8Array): Promise<Uint8Array> {
  const wc = getWebCrypto();
  const key = await getOrCreateKey();

  const ivBuf = toArrayBuffer(data.subarray(0, IV_LENGTH));
  const ctBuf = toArrayBuffer(data.subarray(IV_LENGTH));

  const plainBuf = await wc.subtle.decrypt({ name: 'AES-GCM', iv: ivBuf }, key, ctBuf);
  return new Uint8Array(plainBuf);
}

export function float32ArrayToBytes(arr: Float32Array): Uint8Array {
  const dst = new ArrayBuffer(arr.byteLength);
  new Uint8Array(dst).set(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength));
  return new Uint8Array(dst);
}

export function bytesToFloat32Array(bytes: Uint8Array): Float32Array {
  const buf = toArrayBuffer(bytes);
  return new Float32Array(buf);
}

export async function encryptEmbedding(embedding: Float32Array): Promise<string> {
  const bytes = float32ArrayToBytes(embedding);
  const enc = await encrypt(bytes);
  return bytesToHex(enc);
}

export async function decryptEmbedding(hex: string): Promise<Float32Array> {
  const bytes = hexToBytes(hex);
  const plain = await decrypt(bytes);
  return bytesToFloat32Array(plain);
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const result = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    result[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return result;
}

export function simpleHash(data: Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i]!;
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}
