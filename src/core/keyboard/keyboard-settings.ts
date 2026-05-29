import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "cy_tty_keyboard_keys";

export interface KeyEntry {
  id: string;
  enabled: boolean;
}

export const DEFAULT_KEYS: KeyEntry[] = [
  "Tab", "Esc", "Left", "Up", "Down", "Right",
  "Home", "End", "PgUp", "PgDn", "Ins", "Del",
  "F1", "F2", "F3", "F4", "F5", "F6",
  "F7", "F8", "F9", "F10", "F11", "F12",
].map((id) => ({ id, enabled: true }));

export async function loadKeyboardSettings(): Promise<KeyEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_KEYS;
    const stored: KeyEntry[] = JSON.parse(raw);
    // Keep stored order and enabled states; append any keys added in newer versions
    const storedIds = new Set(stored.map((k) => k.id));
    return [
      ...stored.filter((k) => DEFAULT_KEYS.some((d) => d.id === k.id)),
      ...DEFAULT_KEYS.filter((d) => !storedIds.has(d.id)),
    ];
  } catch {
    return DEFAULT_KEYS;
  }
}

export async function saveKeyboardSettings(keys: KeyEntry[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(keys));
}
