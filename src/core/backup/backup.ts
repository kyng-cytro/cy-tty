import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import * as nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';

import { ProfileStorage } from '@/core/profiles/storage';
import type { BackupFile, BackupPayload } from './types';

const META_KEY = 'CY_TTY_KEY_META';
const ENC_KEY_PREFIX = 'cy_tty_keyenc_';

const ASYNC_THEME_KEY = 'cy_tty_theme_id';
const ASYNC_FONT_KEY = 'cy_tty_font_id';
const ASYNC_FONT_SIZE_KEY = 'cy_tty_font_size';
const ASYNC_SSH_URL_KEY = 'cy_tty_ssh_url_open';
const ALL_ASYNC_KEYS = [ASYNC_THEME_KEY, ASYNC_FONT_KEY, ASYNC_FONT_SIZE_KEY, ASYNC_SSH_URL_KEY];

function keysDir(): string {
  return (FileSystem.documentDirectory ?? '') + 'cy-tty-keys/';
}

/** Derive a 32-byte box key from a password + base64 salt using 10 000 SHA-256 rounds. */
async function deriveKey(password: string, saltB64: string): Promise<Uint8Array> {
  let state = password + '|' + saltB64;
  for (let i = 0; i < 10_000; i++) {
    state = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, state);
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(state.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export async function exportBackup(password: string): Promise<void> {
  const profiles = await ProfileStorage.loadAll();

  const rawMeta = await SecureStore.getItemAsync(META_KEY);
  const keyMeta: Array<{ id: string; label: string; createdAt: number }> = rawMeta
    ? JSON.parse(rawMeta)
    : [];
  const keyFiles: Record<string, string> = {};
  const keyEncs: Record<string, string> = {};
  for (const km of keyMeta) {
    const encKey = await SecureStore.getItemAsync(`${ENC_KEY_PREFIX}${km.id}`);
    const encFile = await FileSystem.readAsStringAsync(keysDir() + `${km.id}.enc`).catch(
      () => null,
    );
    if (encKey && encFile) {
      keyEncs[km.id] = encKey;
      keyFiles[km.id] = encFile;
    }
  }

  const themeId = await AsyncStorage.getItem(ASYNC_THEME_KEY);
  const fontId = await AsyncStorage.getItem(ASYNC_FONT_KEY);
  const fontSizeStr = await AsyncStorage.getItem(ASYNC_FONT_SIZE_KEY);
  const sshUrlRaw = await AsyncStorage.getItem(ASYNC_SSH_URL_KEY);
  const sshUrlSettings = sshUrlRaw ? (JSON.parse(sshUrlRaw) as { autoOpen: boolean }) : { autoOpen: false };

  const payload: BackupPayload = {
    profiles,
    keyMeta,
    keyFiles,
    keyEncs,
    settings: {
      themeId: themeId ?? 'tokyo-night',
      fontId: fontId ?? 'jetbrains-mono',
      fontSize: fontSizeStr ? parseInt(fontSizeStr, 10) : 13,
      sshUrlAutoOpen: sshUrlSettings.autoOpen ?? false,
    },
  };

  const saltBytes = await Crypto.getRandomBytesAsync(32);
  const saltB64 = encodeBase64(new Uint8Array(saltBytes));
  const key = await deriveKey(password, saltB64);
  const nonce = nacl.randomBytes(24);
  const plaintext = decodeUTF8(JSON.stringify(payload));
  const ciphertextBytes = nacl.secretbox(plaintext, nonce, key);

  const file: BackupFile = {
    version: 1,
    exportedAt: Date.now(),
    salt: saltB64,
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(ciphertextBytes),
  };

  const filename = `cy-tty-backup-${Date.now()}.cytty`;
  const fileUri = (FileSystem.cacheDirectory ?? '') + filename;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(file), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/octet-stream',
    dialogTitle: 'Save cy-tty backup',
    UTI: 'public.data',
  });
}

export async function importBackup(fileUri: string, password: string): Promise<void> {
  const raw = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const file: BackupFile = JSON.parse(raw) as BackupFile;

  if (file.version !== 1) throw new Error('Unsupported backup version');

  const key = await deriveKey(password, file.salt);
  const ciphertextBytes = decodeBase64(file.ciphertext);
  const nonce = decodeBase64(file.nonce);
  const plaintext = nacl.secretbox.open(ciphertextBytes, nonce, key);

  if (!plaintext) throw new Error('Wrong password or corrupted backup file');

  const payload: BackupPayload = JSON.parse(encodeUTF8(plaintext)) as BackupPayload;

  // Clear existing profiles
  const existingProfilesRaw = await SecureStore.getItemAsync('CY_TTY_PROFILES');
  const existingProfiles: Array<{ id: string }> = existingProfilesRaw
    ? JSON.parse(existingProfilesRaw)
    : [];
  await Promise.all(
    existingProfiles.map((p) =>
      SecureStore.deleteItemAsync(`cy_tty_pw_${p.id}`).catch(() => {}),
    ),
  );
  await SecureStore.deleteItemAsync('CY_TTY_PROFILES').catch(() => {});

  // Clear existing keys
  const existingMetaRaw = await SecureStore.getItemAsync(META_KEY);
  const existingMeta: Array<{ id: string }> = existingMetaRaw ? JSON.parse(existingMetaRaw) : [];
  await Promise.all(
    existingMeta.map(async (km) => {
      await SecureStore.deleteItemAsync(`${ENC_KEY_PREFIX}${km.id}`).catch(() => {});
      await FileSystem.deleteAsync(keysDir() + `${km.id}.enc`, { idempotent: true }).catch(
        () => {},
      );
    }),
  );
  await SecureStore.deleteItemAsync(META_KEY).catch(() => {});

  // Clear settings
  for (const k of ALL_ASYNC_KEYS) {
    await AsyncStorage.removeItem(k).catch(() => {});
  }

  // Restore profiles
  for (const profile of payload.profiles) {
    await ProfileStorage.save(profile);
  }

  // Restore keys
  await FileSystem.makeDirectoryAsync(keysDir(), { intermediates: true }).catch(() => {});
  await SecureStore.setItemAsync(META_KEY, JSON.stringify(payload.keyMeta));
  await Promise.all(
    Object.entries(payload.keyFiles).map(([id, ciphertext]) =>
      FileSystem.writeAsStringAsync(keysDir() + `${id}.enc`, ciphertext, {
        encoding: FileSystem.EncodingType.UTF8,
      }),
    ),
  );
  await Promise.all(
    Object.entries(payload.keyEncs).map(([id, encKey]) =>
      SecureStore.setItemAsync(`${ENC_KEY_PREFIX}${id}`, encKey),
    ),
  );

  // Restore settings
  await AsyncStorage.setItem(ASYNC_THEME_KEY, payload.settings.themeId);
  await AsyncStorage.setItem(ASYNC_FONT_KEY, payload.settings.fontId);
  await AsyncStorage.setItem(ASYNC_FONT_SIZE_KEY, String(payload.settings.fontSize));
  await AsyncStorage.setItem(
    ASYNC_SSH_URL_KEY,
    JSON.stringify({ autoOpen: payload.settings.sshUrlAutoOpen }),
  );
}
