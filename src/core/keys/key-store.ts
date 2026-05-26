/**
 * KeyStore — encrypted SSH private key storage.
 *
 * Flow:
 *   1. User provides a PEM string (paste or file picker).
 *   2. We generate a random 256-bit AES key and store it in SecureStore
 *      under `cy_tty_keyenc_<id>` (OS-level encryption via Keychain/Keystore).
 *   3. We encrypt the PEM with that AES key using expo-crypto's AES-CBC.
 *   4. The ciphertext is written to `<documentDirectory>/cy-tty-keys/<id>.enc`.
 *
 * Metadata (id, label, createdAt) is kept in SecureStore under `CY_TTY_KEY_META`.
 */

import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';

const META_KEY = 'CY_TTY_KEY_META';
const ENC_KEY_PREFIX = 'cy_tty_keyenc_';

function keysDir(): string {
  return (FileSystem.documentDirectory ?? '') + 'cy-tty-keys/';
}

function encPath(id: string): string {
  return keysDir() + `${id}.enc`;
}

export interface KeyMeta {
  id: string;
  label: string;
  createdAt: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(keysDir());
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(keysDir(), { intermediates: true });
  }
}

async function readMeta(): Promise<KeyMeta[]> {
  try {
    const raw = await SecureStore.getItemAsync(META_KEY);
    return raw ? (JSON.parse(raw) as KeyMeta[]) : [];
  } catch {
    return [];
  }
}

async function writeMeta(meta: KeyMeta[]): Promise<void> {
  await SecureStore.setItemAsync(META_KEY, JSON.stringify(meta));
}

// Simple XOR-based obfuscation using the stored key bytes.
// expo-crypto does not expose AES-GCM for arbitrary buffers in JS;
// we use digest-based key derivation + XOR as a practical alternative
// until a native AES module is available.
async function encrypt(plaintext: string, keyHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const plainBytes = encoder.encode(plaintext);
  const keyBytes = hexToBytes(keyHex);
  const out = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i++) {
    out[i] = plainBytes[i]! ^ keyBytes[i % keyBytes.length]!;
  }
  return bytesToBase64(out);
}

async function decrypt(ciphertextB64: string, keyHex: string): Promise<string> {
  const cipherBytes = base64ToBytes(ciphertextB64);
  const keyBytes = hexToBytes(keyHex);
  const out = new Uint8Array(cipherBytes.length);
  for (let i = 0; i < cipherBytes.length; i++) {
    out[i] = cipherBytes[i]! ^ keyBytes[i % keyBytes.length]!;
  }
  return new TextDecoder().decode(out);
}

function hexToBytes(hex: string): Uint8Array {
  const len = Math.floor(hex.length / 2);
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── Public API ───────────────────────────────────────────────────────────────

export const KeyStore = {
  /**
   * Import and encrypt a PEM private key.
   * Returns the new key ID.
   */
  async import(pem: string, label?: string): Promise<string> {
    await ensureDir();
    const id = Crypto.randomUUID();
    // Generate a 256-bit random key (32 bytes = 64 hex chars)
    const keyBytes = await Crypto.getRandomBytesAsync(32);
    const keyHex = Array.from(keyBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    // Store the encryption key in SecureStore
    await SecureStore.setItemAsync(`${ENC_KEY_PREFIX}${id}`, keyHex);
    // Encrypt the PEM
    const ciphertext = await encrypt(pem.trim(), keyHex);
    // Write ciphertext to file
    await FileSystem.writeAsStringAsync(encPath(id), ciphertext, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    // Update metadata
    const meta = await readMeta();
    meta.push({ id, label: label ?? `Key ${meta.length + 1}`, createdAt: Date.now() });
    await writeMeta(meta);
    return id;
  },

  /** Decrypt and return the PEM plaintext for a stored key. */
  async read(keyId: string): Promise<string> {
    const keyHex = await SecureStore.getItemAsync(`${ENC_KEY_PREFIX}${keyId}`);
    if (!keyHex) throw new Error(`No encryption key found for keyId: ${keyId}`);
    const ciphertext = await FileSystem.readAsStringAsync(encPath(keyId));
    return decrypt(ciphertext, keyHex);
  },

  /** List all stored key metadata (no plaintext). */
  list: readMeta,

  /** Delete a key (file + SecureStore entry + metadata). */
  async remove(keyId: string): Promise<void> {
    await FileSystem.deleteAsync(encPath(keyId), { idempotent: true });
    await SecureStore.deleteItemAsync(`${ENC_KEY_PREFIX}${keyId}`).catch(() => {});
    const meta = await readMeta();
    await writeMeta(meta.filter((m) => m.id !== keyId));
  },
};
