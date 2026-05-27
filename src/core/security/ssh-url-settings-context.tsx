import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  loadSshUrlSettings,
  saveSshUrlSettings,
  SSH_URL_SETTINGS_DEFAULTS,
  type SshUrlOpenSettings,
} from './ssh-url-settings';

export interface SshUrlSettingsContextValue {
  settings: SshUrlOpenSettings;
  setEnabled: (enabled: boolean) => void;
  addPattern: (pattern: string) => void;
  removePattern: (pattern: string) => void;
}

const SshUrlSettingsContext = createContext<SshUrlSettingsContextValue | null>(null);

export function useSshUrlSettings(): SshUrlSettingsContextValue {
  const ctx = useContext(SshUrlSettingsContext);
  if (!ctx) throw new Error('useSshUrlSettings must be inside <SshUrlSettingsProvider>');
  return ctx;
}

export function SshUrlSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<SshUrlOpenSettings>(SSH_URL_SETTINGS_DEFAULTS);

  useEffect(() => {
    void loadSshUrlSettings().then(s => setSettingsState(s));
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setSettingsState(prev => {
      const next = { ...prev, enabled };
      void saveSshUrlSettings(next);
      return next;
    });
  }, []);

  const addPattern = useCallback((pattern: string) => {
    setSettingsState(prev => {
      if (prev.patterns.includes(pattern)) return prev;
      const next = { ...prev, patterns: [...prev.patterns, pattern] };
      void saveSshUrlSettings(next);
      return next;
    });
  }, []);

  const removePattern = useCallback((pattern: string) => {
    setSettingsState(prev => {
      const next = { ...prev, patterns: prev.patterns.filter(p => p !== pattern) };
      void saveSshUrlSettings(next);
      return next;
    });
  }, []);

  const value = useMemo<SshUrlSettingsContextValue>(
    () => ({ settings, setEnabled, addPattern, removePattern }),
    [settings, setEnabled, addPattern, removePattern],
  );

  return (
    <SshUrlSettingsContext.Provider value={value}>
      {children}
    </SshUrlSettingsContext.Provider>
  );
}
