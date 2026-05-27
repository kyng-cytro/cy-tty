import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'cy_tty_ssh_url_open';

export interface SshUrlOpenSettings {
  autoOpen: boolean;
}

export const SSH_URL_SETTINGS_DEFAULTS: SshUrlOpenSettings = {
  autoOpen: false,
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
