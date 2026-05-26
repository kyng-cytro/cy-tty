/**
 * KnownHosts — SSH host key verification (known_hosts equivalent).
 *
 * Stored as a JSON array in SecureStore under `CY_TTY_KNOWN_HOSTS`.
 * Each entry records the host:port, the key algorithm, and the SHA-256
 * fingerprint (base64-encoded, as shown by `ssh-keygen -lf -E sha256`).
 *
 * Verification results:
 *   'ok'       — host known and fingerprint matches
 *   'unknown'  — host not seen before; prompt user to accept
 *   'mismatch' — host known but fingerprint has CHANGED (possible MITM)
 */

import * as SecureStore from 'expo-secure-store';

const STORE_KEY = 'CY_TTY_KNOWN_HOSTS';

export interface KnownHost {
  /** `"hostname:port"` — the key that identifies the entry. */
  host: string;
  algorithm: string;   // e.g. "ssh-rsa", "ecdsa-sha2-nistp256"
  fingerprint: string; // SHA-256 base64, e.g. "SHA256:abcd1234..."
  addedAt: number;     // Unix ms
}

export type VerifyResult = 'ok' | 'unknown' | 'mismatch';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function load(): Promise<KnownHost[]> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    return raw ? (JSON.parse(raw) as KnownHost[]) : [];
  } catch {
    return [];
  }
}

async function save(hosts: KnownHost[]): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(hosts));
}

// ── Public API ───────────────────────────────────────────────────────────────

export const KnownHosts = {
  /**
   * Verify a host key fingerprint against stored entries.
   *
   * @param hostname  The hostname or IP being connected to.
   * @param port      SSH port number.
   * @param fingerprint  SHA-256 fingerprint string received from the server.
   */
  async verify(hostname: string, port: number, fingerprint: string): Promise<VerifyResult> {
    const key = `${hostname}:${port}`;
    const hosts = await load();
    const entry = hosts.find((h) => h.host === key);
    if (!entry) return 'unknown';
    return entry.fingerprint === fingerprint ? 'ok' : 'mismatch';
  },

  /** Add or update a host entry (call after user accepts). */
  async add(entry: KnownHost): Promise<void> {
    const hosts = await load();
    const idx = hosts.findIndex((h) => h.host === entry.host);
    if (idx >= 0) {
      hosts[idx] = entry;
    } else {
      hosts.push(entry);
    }
    await save(hosts);
  },

  /** Return all stored entries. */
  getAll: load,

  /** Remove a single entry by host key. */
  async remove(hostKey: string): Promise<void> {
    const hosts = await load();
    await save(hosts.filter((h) => h.host !== hostKey));
  },
};
