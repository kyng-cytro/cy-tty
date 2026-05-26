/**
 * TerminalSession
 *
 * Composes the full SSH → VT → Skia pipeline and exposes a React Context so
 * sibling / child UI (keyboard toolbar, status bar, etc.) can call `write`
 * and inspect connection status without prop-drilling.
 *
 * Measurement loop:
 *   Skia font loads → onCellSize fires → cellSize state updates
 *   → useTerminalSize recomputes cols/rows
 *   → useTerminal resizes the VT grid
 *   → useSshSession sends PTY window-change to the server
 */

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

// ── Context ────────────────────────────────────────────────────────────────

export interface TerminalSessionContextValue {
  /** Send raw input to the remote PTY (keyboard keys, paste text, etc.). */
  write: (data: string) => void;
  /** Tear down the SSH connection. */
  disconnect: () => void;
  status: SshSessionStatus;
  error: string | null;
  /** How many columns the terminal currently has. */
  cols: number;
  /** How many rows the terminal currently has. */
  rows: number;
  /** Focus the hidden TextInput so the soft keyboard appears. */
  showKeyboard: () => void;
}

export const TerminalSessionContext = createContext<TerminalSessionContextValue | null>(null);

/**
 * Consume the TerminalSession context from any child component.
 * Throws if used outside of `<TerminalSession>`.
 */
export function useTerminalSessionContext(): TerminalSessionContextValue {
  const ctx = useContext(TerminalSessionContext);
  if (!ctx) {
    throw new Error('useTerminalSessionContext must be used inside <TerminalSession>');
  }
  return ctx;
}

// ── Props ──────────────────────────────────────────────────────────────────

export interface TerminalSessionProps {
  host: string;
  port?: number;
  username: string;
  password: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Child components (keyboard toolbar, status bar, overlays) that can call
   * `useTerminalSessionContext()` to interact with the session.
   */
  children?: ReactNode;
}

// ── Component ──────────────────────────────────────────────────────────────

export function TerminalSession({
  host,
  port = 22,
  username,
  password,
  style,
  children,
}: TerminalSessionProps) {
  const { resolvedTheme } = useTerminalPreferences();
  // ── 1. Cell size — seeded with defaults, updated once Skia font loads ──
  const [cellSize, setCellSize] = useState({
    width: DEFAULT_CELL_WIDTH,
    height: DEFAULT_CELL_HEIGHT,
  });

  // ── 2. Terminal dimensions derived from screen size + cell size ────────
  const { cols, rows, terminalWidth, terminalHeight } = useTerminalSize({
    cellWidth: cellSize.width,
    cellHeight: cellSize.height,
  });

  // ── 3. VT state (grid + cursor) ────────────────────────────────────────
  const { state, processBytes } = useTerminal({ cols, rows });

  // ── 4. SSH transport — auto-connects on mount ──────────────────────────
  const { status, error, write, disconnect } = useSshSession({
    host,
    port,
    username,
    password,
    cols,
    rows,
    onData: processBytes,
  });

  // ── 5. Cell-size callback from Skia (stable identity) ─────────────────
  const handleCellSize = useCallback((w: number, h: number) => {
    setCellSize((prev) =>
      prev.width === w && prev.height === h ? prev : { width: w, height: h },
    );
  }, []);

  // ── Context value (stable with useMemo) ────────────────────────────────
  const ctx = useMemo<TerminalSessionContextValue>(
    () => ({ write, disconnect, status, error, cols, rows, showKeyboard: () => {} }),
    [write, disconnect, status, error, cols, rows],
  );

  return (
    <TerminalSessionContext.Provider value={ctx}>
      <View style={[styles.container, { backgroundColor: resolvedTheme.backgroundHex }, style]}>
        {/* Canvas fills all available space above any children (toolbar, etc.) */}
        <TerminalCanvas
          state={state}
          onCellSize={handleCellSize}
          style={styles.canvas}
        />
        {children}
      </View>
    </TerminalSessionContext.Provider>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor set inline from active terminal theme
  },
  canvas: {
    flex: 1,
  },
});
