/**
 * ProfileStorage — persists SSH profiles using expo-secure-store.
 *
 * All profiles are stored as a JSON array under the key `CY_TTY_PROFILES`.
 * Passwords are stored individually under `cy_tty_pw_<id>` so the profile
 * list is safe to log / inspect without exposing credentials.
 *
 * expo-secure-store encrypts at rest using the platform keychain (iOS Keychain
 * Services / Android Keystore), so no manual crypto is needed here.
 */

import * as SecureStore from 'expo-secure-store';
import type { SshProfile } from './types';

const PROFILES_KEY = 'CY_TTY_PROFILES';

function pwKey(id: string) {
  return `cy_tty_pw_${id}`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function readProfiles(): Promise<SshProfile[]> {
  try {
    const raw = await SecureStore.getItemAsync(PROFILES_KEY);
    if (!raw) return [];
    const parsed: SshProfile[] = JSON.parse(raw);
    // Re-attach passwords from individual keys
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
  // Strip passwords from the main array before writing
  const stripped = profiles.map(({ password: _pw, ...rest }) => rest);
  await SecureStore.setItemAsync(PROFILES_KEY, JSON.stringify(stripped));
  // Write each password individually
  await Promise.all(
    profiles.map(async (p) => {
      if (p.authMethod === 'password' && p.password != null) {
        await SecureStore.setItemAsync(pwKey(p.id), p.password);
      }
    }),
  );
}

// ── Public API ───────────────────────────────────────────────────────────────

export const ProfileStorage = {
  /** Load all saved profiles (passwords re-attached from SecureStore). */
  loadAll: readProfiles,

  /** Create or update a profile. */
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

  /** Update only the lastConnected timestamp. */
  async touch(id: string): Promise<void> {
    const existing = await readProfiles();
    const idx = existing.findIndex((p) => p.id === id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx]!, lastConnected: Date.now() };
      await writeProfiles(existing);
    }
  },

  /** Remove a profile and its stored password. */
  async remove(id: string): Promise<void> {
    const existing = await readProfiles();
    const filtered = existing.filter((p) => p.id !== id);
    await writeProfiles(filtered);
    await SecureStore.deleteItemAsync(pwKey(id)).catch(() => {});
  },
};
