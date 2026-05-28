import { Terminal } from './terminal';
import type {
  DeltaListener,
  TerminalDelta,
  TerminalHandle,
  TerminalState,
  Unsubscribe,
} from './types';

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

let nextHandle: TerminalHandle = 1;

const instances = new Map<TerminalHandle, Terminal>();
const listeners = new Map<TerminalHandle, Set<DeltaListener>>();

export function createTerminal(cols: number, rows: number): TerminalHandle {
  const handle = nextHandle++;
  instances.set(handle, new Terminal(cols, rows));
  listeners.set(handle, new Set());
  return handle;
}

export function processBytes(handle: TerminalHandle, data: string): void {
  const terminal = instances.get(handle);
  if (!terminal) return;

  const delta = terminal.processBytes(data);

  const cbs = listeners.get(handle);
  if (cbs && cbs.size > 0) {
    for (const cb of cbs) cb(delta);
  }
}

export function resize(handle: TerminalHandle, cols: number, rows: number): void {
  const terminal = instances.get(handle);
  if (!terminal) return;

  terminal.resize(cols, rows);

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

export function getState(handle: TerminalHandle): TerminalState | null {
  return instances.get(handle)?.getState() ?? null;
}

export function onTerminalDelta(
  handle: TerminalHandle,
  listener: DeltaListener,
): Unsubscribe {
  const set = listeners.get(handle);
  if (!set) return () => {};
  set.add(listener);
  return () => set.delete(listener);
}

export function destroy(handle: TerminalHandle): void {
  instances.delete(handle);
  listeners.delete(handle);
}

export const GhosttyVt = {
  createTerminal,
  processBytes,
  resize,
  getState,
  onTerminalDelta,
  destroy,
} as const;
