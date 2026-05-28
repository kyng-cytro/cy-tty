import { GhosttyVt } from 'expo-ghostty-vt';
import type { TerminalDelta, TerminalHandle, TerminalState } from 'expo-ghostty-vt';
import { useCallback, useEffect, useState } from 'react';

import { applyDelta, createEmptyState } from '@/core/terminal/grid';

export interface UseTerminalOptions {
  cols: number;
  rows: number;
}

export interface UseTerminalResult {
  state: TerminalState;
  processBytes: (data: string) => void;
}

export function useTerminal({ cols, rows }: UseTerminalOptions): UseTerminalResult {
  const [handle, setHandle] = useState<TerminalHandle | null>(null);
  const [state, setState] = useState<TerminalState>(() => createEmptyState(cols, rows));

  useEffect(() => {
    const h = GhosttyVt.createTerminal(cols, rows);
    setHandle(h);

    const unsubscribe = GhosttyVt.onTerminalDelta(h, (delta: TerminalDelta) => {
      setState((prev) => applyDelta(prev, delta));
    });

    return () => {
      unsubscribe();
      GhosttyVt.destroy(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (handle !== null) {
      GhosttyVt.resize(handle, cols, rows);
    }
  }, [handle, cols, rows]);

  const processBytes = useCallback(
    (data: string) => {
      if (handle !== null) {
        GhosttyVt.processBytes(handle, data);
      }
    },
    [handle],
  );

  return { state, processBytes };
}
