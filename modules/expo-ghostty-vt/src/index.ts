/**
 * expo-ghostty-vt
 *
 * VT/ANSI terminal state machine for cy-tty.
 *
 * Currently implemented as a pure TypeScript state machine that is fully
 * compatible with the planned native libghostty-vt module.  When the
 * libghostty-vt C API stabilises and the XCFramework / Android NDK build
 * pipeline is ready, the native module can be dropped in here without any
 * changes to callers.
 *
 * API contract mirrors the planned native module:
 *   createTerminal(cols, rows)  → TerminalHandle
 *   processBytes(handle, data)  → void  (emits onTerminalDelta)
 *   resize(handle, cols, rows)  → void
 *   destroy(handle)             → void
 *   onTerminalDelta(handle, cb) → Unsubscribe
 */

import { Terminal } from './terminal';
import type {
  DeltaListener,
  TerminalDelta,
  TerminalHandle,
  TerminalState,
  Unsubscribe,
} from './types';

// Re-export types for consumers
export type {
  CellColor,
  CursorShape,
  DefaultColor,
  DirtyRow,
  DeltaListener,
  PaletteColor,
  RgbColor,
  TerminalCell,
  TerminalCursor,
  TerminalDelta,
  TerminalHandle,
  TerminalState,
  Unsubscribe,
} from './types';

// ── Instance registry ─────────────────────────────────────────────────────

let nextHandle: TerminalHandle = 1;

const instances = new Map<TerminalHandle, Terminal>();
const listeners = new Map<TerminalHandle, Set<DeltaListener>>();

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Create a new terminal instance and return its opaque handle.
 *
 * ```ts
 * const term = GhosttyVt.createTerminal(80, 24);
 * ```
 */
export function createTerminal(cols: number, rows: number): TerminalHandle {
  const handle = nextHandle++;
  instances.set(handle, new Terminal(cols, rows));
  listeners.set(handle, new Set());
  return handle;
}

/**
 * Feed raw SSH bytes (ISO-8859-1 encoded string) into the VT parser.
 * Fires all registered `onTerminalDelta` listeners synchronously.
 *
 * ```ts
 * SshClient.onData(({ data }) => GhosttyVt.processBytes(term, data));
 * ```
 */
export function processBytes(handle: TerminalHandle, data: string): void {
  const terminal = instances.get(handle);
  if (!terminal) return;

  const delta = terminal.processBytes(data);

  const cbs = listeners.get(handle);
  if (cbs && cbs.size > 0) {
    for (const cb of cbs) cb(delta);
  }
}

/**
 * Notify the terminal of a size change (e.g. device rotation).
 * Fires onTerminalDelta with all rows marked dirty.
 */
export function resize(handle: TerminalHandle, cols: number, rows: number): void {
  const terminal = instances.get(handle);
  if (!terminal) return;

  terminal.resize(cols, rows);

  // After resize emit a full-screen delta so the renderer can repaint
  const state = terminal.getState();
  const delta: TerminalDelta = {
    dirtyRows: state.grid.map((cells, index) => ({ index, cells: [...cells] })),
    cursor: state.cursor,
    cleared: false,
    title: null,
    appendedScrollback: [],
  };

  const cbs = listeners.get(handle);
  if (cbs) for (const cb of cbs) cb(delta);
}

/**
 * Return a snapshot of the full terminal state.
 * Use sparingly — prefer delta events for incremental updates.
 */
export function getState(handle: TerminalHandle): TerminalState | null {
  return instances.get(handle)?.getState() ?? null;
}

/**
 * Subscribe to delta events for a terminal.
 * Returns an unsubscribe function.
 *
 * ```ts
 * const off = GhosttyVt.onTerminalDelta(term, (delta) => {
 *   // update React state
 * });
 * // later:
 * off();
 * ```
 */
export function onTerminalDelta(
  handle: TerminalHandle,
  listener: DeltaListener,
): Unsubscribe {
  const set = listeners.get(handle);
  if (!set) return () => {};
  set.add(listener);
  return () => set.delete(listener);
}

/**
 * Destroy a terminal instance and free its resources.
 * All listeners are removed automatically.
 */
export function destroy(handle: TerminalHandle): void {
  instances.delete(handle);
  listeners.delete(handle);
}

/** Convenience namespace (matches the planned native module shape). */
export const GhosttyVt = {
  createTerminal,
  processBytes,
  resize,
  getState,
  onTerminalDelta,
  destroy,
} as const;
