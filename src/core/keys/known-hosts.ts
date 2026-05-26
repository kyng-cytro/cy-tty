import * as SecureStore from 'expo-secure-store';

const STORE_KEY = 'CY_TTY_KNOWN_HOSTS';

export interface KnownHost {
  host: string;
  algorithm: string;
  fingerprint: string;
  addedAt: number;
}

export type VerifyResult = 'ok' | 'unknown' | 'mismatch';

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

export const KnownHosts = {
  async verify(hostname: string, port: number, fingerprint: string): Promise<VerifyResult> {
    const key = `${hostname}:${port}`;
    const hosts = await load();
    const entry = hosts.find((h) => h.host === key);
    if (!entry) return 'unknown';
    return entry.fingerprint === fingerprint ? 'ok' : 'mismatch';
  },

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

  getAll: load,

  async remove(hostKey: string): Promise<void> {
    const hosts = await load();
    await save(hosts.filter((h) => h.host !== hostKey));
  },
};
