export type DefaultColor = { readonly kind: 'default' };

export type PaletteColor = { readonly kind: 'palette'; readonly index: number };

export type RgbColor = {
  readonly kind: 'rgb';
  readonly r: number;
  readonly g: number;
  readonly b: number;
};

export type CellColor = DefaultColor | PaletteColor | RgbColor;

export interface TerminalCell {
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

export type CursorShape = 'block' | 'bar' | 'underline';

export interface TerminalCursor {
  row: number;
  col: number;
  visible: boolean;
  shape: CursorShape;
}

export interface TerminalState {
  grid: TerminalCell[][];
  /** Lines that have scrolled off the top of the main screen (oldest first). */
  scrollback: TerminalCell[][];
  cursor: TerminalCursor;
  cols: number;
  rows: number;
  title: string;
  /** True while the alternate screen buffer is active (e.g. vim, less). */
  alternateScreen: boolean;
}

export interface DirtyRow {
  index: number;
  cells: TerminalCell[];
}

export interface TerminalDelta {
  dirtyRows: DirtyRow[];
  cursor: TerminalCursor;
  cleared: boolean;
  title: string | null;
  appendedScrollback: TerminalCell[][];
}

export type TerminalHandle = number;

export type DeltaListener = (delta: TerminalDelta) => void;
export type Unsubscribe = () => void;
