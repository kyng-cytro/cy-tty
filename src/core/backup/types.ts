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
  keyFiles: Record<string, string>;
  keyEncs: Record<string, string>;
  settings: BackupSettings;
}

export interface BackupFile {
  version: 1;
  exportedAt: number;
  salt: string;
  nonce: string;
  ciphertext: string;
}
