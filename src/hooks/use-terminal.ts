import { GhosttyVt } from 'expo-ghostty-vt';
import type { TerminalDelta, TerminalHandle, TerminalState } from 'expo-ghostty-vt';
import { useCallback, useEffect, useRef, useState } from 'react';

import { applyDelta, createEmptyState } from '@/core/terminal/grid';

// ── Types ─────────────────────────────────────────────────────────────────

export interface UseTerminalOptions {
  cols: number;
  rows: number;
}

export interface UseTerminalResult {
  /** Opaque handle — pass to GhosttyVt.* if you need direct access. */
  handle: TerminalHandle | null;
  /** Current terminal state (grid + cursor + title). */
  state: TerminalState;
  /**
   * Indices of rows that changed in the most recent delta.
   * The Skia renderer reads this ref to skip unchanged rows.
   */
  dirtyRowsRef: React.RefObject<number[]>;
  /** Feed raw SSH bytes (ISO-8859-1 string) from expo-ssh. */
  processBytes: (data: string) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────

/**
 * Creates a libghostty-vt terminal instance and keeps a TerminalState
 * in sync with incoming VT bytes.
 *
 * ```tsx
 * const { state, dirtyRowsRef, processBytes } = useTerminal({ cols, rows });
 *
 * // Wire to SSH:
 * useEffect(() => SshClient.onData(({ data }) => processBytes(data)).remove, [processBytes]);
 * ```
 */
export function useTerminal({ cols, rows }: UseTerminalOptions): UseTerminalResult {
  const [handle, setHandle] = useState<TerminalHandle | null>(null);
  const [state, setState] = useState<TerminalState>(() => createEmptyState(cols, rows));
  const dirtyRowsRef = useRef<number[]>([]);

  // ── Create / destroy terminal instance ──────────────────────────────────
  useEffect(() => {
    const h = GhosttyVt.createTerminal(cols, rows);
    setHandle(h);

    const unsubscribe = GhosttyVt.onTerminalDelta(h, (delta: TerminalDelta) => {
      dirtyRowsRef.current = delta.dirtyRows.map((r) => r.index);
      setState((prev) => applyDelta(prev, delta));
    });

    return () => {
      unsubscribe();
      GhosttyVt.destroy(h);
    };
    // Intentionally empty deps — terminal is created once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resize when cols / rows change ───────────────────────────────────────
  useEffect(() => {
    if (handle !== null) {
      GhosttyVt.resize(handle, cols, rows);
    }
  }, [handle, cols, rows]);

  // ── processBytes — stable reference ─────────────────────────────────────
  const processBytes = useCallback(
    (data: string) => {
      if (handle !== null) {
        GhosttyVt.processBytes(handle, data);
      }
    },
    [handle],
  );

  return { handle, state, dirtyRowsRef, processBytes };
}
