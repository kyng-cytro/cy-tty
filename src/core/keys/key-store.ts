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

const PEM_HEADER = /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/;
const PEM_FOOTER = /-----END (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/;

/**
 * Returns null if `text` looks like a valid PEM private key, or an error
 * string describing why it is not.
 */
export function validatePem(text: string): string | null {
  const t = text.trim();
  if (!PEM_HEADER.test(t)) {
    return 'Missing -----BEGIN ... PRIVATE KEY----- header';
  }
  if (!PEM_FOOTER.test(t)) {
    return 'Missing -----END ... PRIVATE KEY----- footer';
  }
  const body = t
    .replace(/-----BEGIN[^-]*-----/, '')
    .replace(/-----END[^-]*-----/, '')
    .replace(/\s/g, '');
  if (body.length === 0) {
    return 'Key body is empty';
  }
  return null;
}

export const KeyStore = {
  async import(pem: string, label?: string): Promise<string> {
    const err = validatePem(pem);
    if (err) throw new Error(`Invalid PEM: ${err}`);
    await ensureDir();
    const id = Crypto.randomUUID();
    const keyBytes = await Crypto.getRandomBytesAsync(32);
    const keyHex = Array.from(keyBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(`${ENC_KEY_PREFIX}${id}`, keyHex);
    const ciphertext = await encrypt(pem.trim(), keyHex);
    await FileSystem.writeAsStringAsync(encPath(id), ciphertext, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const meta = await readMeta();
    meta.push({ id, label: label ?? `Key ${meta.length + 1}`, createdAt: Date.now() });
    await writeMeta(meta);
    return id;
  },

  async read(keyId: string): Promise<string> {
    const keyHex = await SecureStore.getItemAsync(`${ENC_KEY_PREFIX}${keyId}`);
    if (!keyHex) throw new Error(`No encryption key found for keyId: ${keyId}`);
    const ciphertext = await FileSystem.readAsStringAsync(encPath(keyId));
    return decrypt(ciphertext, keyHex);
  },

  list: readMeta,

  async remove(keyId: string): Promise<void> {
    await FileSystem.deleteAsync(encPath(keyId), { idempotent: true });
    await SecureStore.deleteItemAsync(`${ENC_KEY_PREFIX}${keyId}`).catch(() => {});
    const meta = await readMeta();
    await writeMeta(meta.filter((m) => m.id !== keyId));
  },
};
