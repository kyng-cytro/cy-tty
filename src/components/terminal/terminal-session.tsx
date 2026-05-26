import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTerminalPreferences } from '@/core/theme/preferences-context';

import { DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH, useTerminalSize } from '@/hooks/use-terminal-size';
import { useTerminal } from '@/hooks/use-terminal';
import { useSshSession, type SshSessionStatus } from '@/hooks/use-ssh-session';
import { TerminalCanvas } from './terminal-canvas';

export interface TerminalSessionContextValue {
  write: (data: string) => void;
  disconnect: () => void;
  status: SshSessionStatus;
  error: string | null;
  cols: number;
  rows: number;
  showKeyboard: () => void;
  modifier: 'ctrl' | 'alt' | null;
  toggleModifier: (mod: 'ctrl' | 'alt') => void;
}

export const TerminalSessionContext = createContext<TerminalSessionContextValue | null>(null);

export function useTerminalSessionContext(): TerminalSessionContextValue {
  const ctx = useContext(TerminalSessionContext);
  if (!ctx) throw new Error('useTerminalSessionContext must be used inside <TerminalSession>');
  return ctx;
}

export interface TerminalSessionProps {
  host: string;
  port?: number;
  username: string;
  password: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export function TerminalSession({ host, port = 22, username, password, style, children }: TerminalSessionProps) {
  const { resolvedTheme } = useTerminalPreferences();
  const [cellSize, setCellSize] = useState({ width: DEFAULT_CELL_WIDTH, height: DEFAULT_CELL_HEIGHT });

  const { cols, rows, terminalWidth, terminalHeight } = useTerminalSize({
    cellWidth: cellSize.width,
    cellHeight: cellSize.height,
  });

  const { state, processBytes } = useTerminal({ cols, rows });

  const { status, error, write, disconnect } = useSshSession({
    host, port, username, password, cols, rows, onData: processBytes,
  });

  const handleCellSize = useCallback((w: number, h: number) => {
    setCellSize((prev) => prev.width === w && prev.height === h ? prev : { width: w, height: h });
  }, []);

  const ctx = useMemo<TerminalSessionContextValue>(
    () => ({ write, disconnect, status, error, cols, rows, showKeyboard: () => {}, modifier: null, toggleModifier: () => {} }),
    [write, disconnect, status, error, cols, rows],
  );

  return (
    <TerminalSessionContext.Provider value={ctx}>
      <View style={[styles.container, { backgroundColor: resolvedTheme.backgroundHex }, style]}>
        <TerminalCanvas state={state} onCellSize={handleCellSize} style={styles.canvas} />
        {children}
      </View>
    </TerminalSessionContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  canvas: { flex: 1 },
});
