import { createContext, useContext } from 'react';
import type { SshSessionStatus } from '@/hooks/use-ssh-session';

export interface TerminalSessionContextValue {
  write: (data: string) => void;
  disconnect: () => void;
  status: SshSessionStatus;
  error: string | null;
  cols: number;
  rows: number;
  showKeyboard: () => void;
  hideKeyboard: () => void;
  modifier: 'ctrl' | 'alt' | null;
  toggleModifier: (mod: 'ctrl' | 'alt') => void;
}

export const TerminalSessionContext = createContext<TerminalSessionContextValue | null>(null);

export function useTerminalSessionContext(): TerminalSessionContextValue {
  const ctx = useContext(TerminalSessionContext);
  if (!ctx) throw new Error('useTerminalSessionContext must be used inside a terminal screen');
  return ctx;
}
