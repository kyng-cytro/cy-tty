import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  DEFAULT_KEYS,
  loadKeyboardSettings,
  saveKeyboardSettings,
  type KeyEntry,
} from "./keyboard-settings";

interface KeyboardSettingsContextValue {
  keys: KeyEntry[];
  updateKeys: (keys: KeyEntry[]) => void;
}

const KeyboardSettingsContext = createContext<KeyboardSettingsContextValue>({
  keys: DEFAULT_KEYS,
  updateKeys: () => {},
});

export function useKeyboardSettings() {
  return useContext(KeyboardSettingsContext);
}

export function KeyboardSettingsProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<KeyEntry[]>(DEFAULT_KEYS);

  useEffect(() => {
    void loadKeyboardSettings().then(setKeys);
  }, []);

  const updateKeys = useCallback((next: KeyEntry[]) => {
    setKeys(next);
    void saveKeyboardSettings(next);
  }, []);

  return (
    <KeyboardSettingsContext.Provider value={{ keys, updateKeys }}>
      {children}
    </KeyboardSettingsContext.Provider>
  );
}
