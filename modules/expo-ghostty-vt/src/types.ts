// ── Colors ────────────────────────────────────────────────────────────────

/** Default terminal foreground / background (resolved by the theme). */
export type DefaultColor = { readonly kind: 'default' };

/** ANSI/xterm 256-colour palette entry (0-255). */
export type PaletteColor = { readonly kind: 'palette'; readonly index: number };

/** True-colour RGB (each channel 0-255). */
export type RgbColor = {
  readonly kind: 'rgb';
  readonly r: number;
  readonly g: number;
  readonly b: number;
};

export type CellColor = DefaultColor | PaletteColor | RgbColor;

// ── Cell ──────────────────────────────────────────────────────────────────

export interface TerminalCell {
  /** Visible character(s). Empty string → empty cell. */
  char: string;
  /** 1 for most chars; 2 for CJK wide characters. */
  width: number;
  fg: CellColor;
  bg: CellColor;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  blink: boolean;
  inverse: boolean;
  invisible: boolean;
  strikethrough: boolean;
}

// ── Cursor ────────────────────────────────────────────────────────────────

export type CursorShape = 'block' | 'bar' | 'underline';

export interface TerminalCursor {
  row: number;
  col: number;
  visible: boolean;
  shape: CursorShape;
}

// ── Full state ────────────────────────────────────────────────────────────

export interface TerminalState {
  grid: TerminalCell[][];
  cursor: TerminalCursor;
  cols: number;
  rows: number;
  title: string;
  /** True while the alternate screen buffer is active (e.g. vim, less). */
  alternateScreen: boolean;
}

// ── Delta (what changed after a processBytes call) ────────────────────────

/** A row whose cells changed since the last processBytes call. */
export interface DirtyRow {
  index: number;
  cells: TerminalCell[];
}

/**
 * Minimal description of what changed after processing a chunk of bytes.
 * The renderer only needs to repaint dirty rows.
 */
export interface TerminalDelta {
  /** Rows whose content changed. */
  dirtyRows: DirtyRow[];
  /** New cursor state (always present for simplicity). */
  cursor: TerminalCursor;
  /** True when the entire screen was cleared (e.g. ESC[2J). */
  cleared: boolean;
  /** Non-null when the terminal title changed (OSC 0/2). */
  title: string | null;
}

// ── Public module API ─────────────────────────────────────────────────────

export type TerminalHandle = number;

export type DeltaListener = (delta: TerminalDelta) => void;
export type Unsubscribe = () => void;
