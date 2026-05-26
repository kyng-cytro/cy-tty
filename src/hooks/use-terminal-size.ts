import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Constants ─────────────────────────────────────────────────────────────

/**
 * Fallback cell dimensions used before the monospace font is measured.
 * These match a typical 12pt JetBrains Mono at 1× density.
 */
export const DEFAULT_CELL_WIDTH = 7.2;
export const DEFAULT_CELL_HEIGHT = 16;

/** Height reserved for the mobile keyboard toolbar (Ctrl / Tab / arrows). */
export const KEYBOARD_TOOLBAR_HEIGHT = 44;

// ── Types ─────────────────────────────────────────────────────────────────

export interface TerminalSizeResult {
  /** Number of character columns that fit on screen. */
  cols: number;
  /** Number of character rows that fit on screen. */
  rows: number;
  /** Pixel width of a single terminal cell (set by the font loader). */
  cellWidth: number;
  /** Pixel height of a single terminal cell (set by the font loader). */
  cellHeight: number;
  /** Total available pixel width. */
  terminalWidth: number;
  /** Total available pixel height. */
  terminalHeight: number;
}

// ── Hook ──────────────────────────────────────────────────────────────────

/**
 * Computes terminal dimensions (cols × rows) from the current screen size
 * and the measured font cell size.
 *
 * Call this hook in the same component that owns the `TerminalCanvas`.
 * When `useFont` resolves the loaded font, measure one glyph and pass those
 * dimensions here so the terminal tracks the actual layout.
 *
 * ```ts
 * const { cols, rows, cellWidth, cellHeight } = useTerminalSize({
 *   cellWidth: measuredCellWidth ?? DEFAULT_CELL_WIDTH,
 *   cellHeight: measuredCellHeight ?? DEFAULT_CELL_HEIGHT,
 * });
 * ```
 */
export function useTerminalSize({
  cellWidth = DEFAULT_CELL_WIDTH,
  cellHeight = DEFAULT_CELL_HEIGHT,
  toolbarHeight = KEYBOARD_TOOLBAR_HEIGHT,
}: {
  cellWidth?: number;
  cellHeight?: number;
  toolbarHeight?: number;
} = {}): TerminalSizeResult {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const terminalWidth = width;
  const terminalHeight = height - insets.top - insets.bottom - toolbarHeight;

  const cols = Math.max(1, Math.floor(terminalWidth / cellWidth));
  const rows = Math.max(1, Math.floor(terminalHeight / cellHeight));

  return {
    cols,
    rows,
    cellWidth,
    cellHeight,
    terminalWidth,
    terminalHeight,
  };
}
