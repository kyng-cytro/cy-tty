import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cy_tty_ssh_url_open';

export interface SshUrlOpenSettings {
  enabled: boolean;
  patterns: string[];
}

export const SSH_URL_SETTINGS_DEFAULTS: SshUrlOpenSettings = {
  enabled: false,
  patterns: [],
};

export async function loadSshUrlSettings(): Promise<SshUrlOpenSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return SSH_URL_SETTINGS_DEFAULTS;
    return { ...SSH_URL_SETTINGS_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return SSH_URL_SETTINGS_DEFAULTS;
  }
}

export async function saveSshUrlSettings(s: SshUrlOpenSettings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}

// `*` matches any character sequence (including `/`) for convenience with URLs.
export function urlMatchesPattern(url: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  try {
    return new RegExp(`^${regexStr}$`, 'i').test(url);
  } catch {
    return false;
  }
}

export function isUrlAllowed(url: string, settings: SshUrlOpenSettings): boolean {
  return settings.enabled && settings.patterns.some(p => urlMatchesPattern(url, p));
}
