import type { KeyMeta } from '@/core/keys/key-store';
import type { SshProfile } from '@/core/profiles/types';

export interface BackupSettings {
  themeId: string;
  fontId: string;
  fontSize: number;
  sshUrlAutoOpen: boolean;
}

export interface BackupPayload {
  profiles: SshProfile[];
  keyMeta: KeyMeta[];
  /** Base64-encoded raw ciphertext from each .enc file, keyed by keyId. */
  keyFiles: Record<string, string>;
  /** Hex encryption key from SecureStore for each keyId. */
  keyEncs: Record<string, string>;
  settings: BackupSettings;
}

export interface BackupFile {
  version: 1;
  exportedAt: number;
  /** Base64 — 32-byte random salt for key derivation. */
  salt: string;
  /** Base64 — 24-byte random nonce for secretbox. */
  nonce: string;
  /** Base64 — secretbox-encrypted BackupPayload JSON. */
  ciphertext: string;
}
