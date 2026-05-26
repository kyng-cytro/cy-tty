/**
 * Re-exports the canonical terminal types from expo-ghostty-vt.
 *
 * App code should import from here — not directly from 'expo-ghostty-vt' —
 * so the import site stays stable when the native module is dropped in.
 */
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
} from 'expo-ghostty-vt';
