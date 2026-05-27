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
  setAutoOpen: (autoOpen: boolean) => void;
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

  const setAutoOpen = useCallback((autoOpen: boolean) => {
    setSettingsState(prev => {
      const next = { ...prev, autoOpen };
      void saveSshUrlSettings(next);
      return next;
    });
  }, []);

  const value = useMemo<SshUrlSettingsContextValue>(
    () => ({ settings, setAutoOpen }),
    [settings, setAutoOpen],
  );

  return (
    <SshUrlSettingsContext.Provider value={value}>
      {children}
    </SshUrlSettingsContext.Provider>
  );
}
