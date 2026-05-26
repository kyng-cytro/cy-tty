import * as SecureStore from 'expo-secure-store';
import type { SshProfile } from './types';

const PROFILES_KEY = 'CY_TTY_PROFILES';

function pwKey(id: string) {
  return `cy_tty_pw_${id}`;
}

async function readProfiles(): Promise<SshProfile[]> {
  try {
    const raw = await SecureStore.getItemAsync(PROFILES_KEY);
    if (!raw) return [];
    const parsed: SshProfile[] = JSON.parse(raw);
    return Promise.all(
      parsed.map(async (p) => {
        if (p.authMethod === 'password') {
          const pw = await SecureStore.getItemAsync(pwKey(p.id));
          return { ...p, password: pw ?? '' };
        }
        return p;
      }),
    );
  } catch {
    return [];
  }
}

async function writeProfiles(profiles: SshProfile[]): Promise<void> {
  const stripped = profiles.map(({ password: _pw, ...rest }) => rest);
  await SecureStore.setItemAsync(PROFILES_KEY, JSON.stringify(stripped));
  await Promise.all(
    profiles.map(async (p) => {
      if (p.authMethod === 'password' && p.password != null) {
        await SecureStore.setItemAsync(pwKey(p.id), p.password);
      }
    }),
  );
}

export const ProfileStorage = {
  loadAll: readProfiles,

  async save(profile: SshProfile): Promise<void> {
    const existing = await readProfiles();
    const idx = existing.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      existing[idx] = profile;
    } else {
      existing.push(profile);
    }
    await writeProfiles(existing);
  },

  async touch(id: string): Promise<void> {
    const existing = await readProfiles();
    const idx = existing.findIndex((p) => p.id === id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx]!, lastConnected: Date.now() };
      await writeProfiles(existing);
    }
  },

  async remove(id: string): Promise<void> {
    const existing = await readProfiles();
    const filtered = existing.filter((p) => p.id !== id);
    await writeProfiles(filtered);
    await SecureStore.deleteItemAsync(pwKey(id)).catch(() => {});
  },
};
