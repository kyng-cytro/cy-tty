/**
 * Grid utility functions used by hooks and the Skia renderer.
 *
 * All functions are pure — they never mutate their inputs.
 */

import type { CellColor, TerminalCell, TerminalDelta, TerminalState } from './types';

// ── Empty state factory ───────────────────────────────────────────────────

export function createEmptyCell(): TerminalCell {
  return {
    char: '',
    width: 1,
    fg: { kind: 'default' },
    bg: { kind: 'default' },
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    blink: false,
    inverse: false,
    invisible: false,
    strikethrough: false,
  };
}

export function createEmptyGrid(cols: number, rows: number): TerminalCell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => createEmptyCell()),
  );
}

export function createEmptyState(cols: number, rows: number): TerminalState {
  return {
    grid: createEmptyGrid(cols, rows),
    cursor: { row: 0, col: 0, visible: true, shape: 'block' },
    cols,
    rows,
    title: '',
    alternateScreen: false,
  };
}

// ── Delta application ─────────────────────────────────────────────────────

/**
 * Merge a TerminalDelta into an existing TerminalState.
 * Returns a new TerminalState; the original is not mutated.
 */
export function applyDelta(state: TerminalState, delta: TerminalDelta): TerminalState {
  if (delta.cleared) {
    // Full clear: replace grid entirely, then apply any dirty rows on top
    const fresh = createEmptyGrid(state.cols, state.rows);
    for (const { index, cells } of delta.dirtyRows) {
      if (index < fresh.length) fresh[index] = cells;
    }
    return {
      ...state,
      grid: fresh,
      cursor: delta.cursor,
      title: delta.title ?? state.title,
    };
  }

  if (delta.dirtyRows.length === 0) {
    // Only cursor / title changed
    return {
      ...state,
      cursor: delta.cursor,
      title: delta.title ?? state.title,
    };
  }

  // Shallow-copy the grid array, replacing only dirty rows
  const grid = state.grid.slice();
  for (const { index, cells } of delta.dirtyRows) {
    if (index < grid.length) grid[index] = cells;
  }

  return {
    ...state,
    grid,
    cursor: delta.cursor,
    title: delta.title ?? state.title,
  };
}

// ── 256-colour palette (ANSI / xterm) ─────────────────────────────────────

/**
 * Full xterm 256-colour palette as packed 0xRRGGBB integers.
 *
 * Layout:
 *   0-7   standard ANSI colours
 *   8-15  high-intensity / bright variants
 *   16-231 6×6×6 colour cube
 *   232-255 24-step greyscale ramp
 */
export const ANSI_256: readonly number[] = (() => {
  const p: number[] = [];

  // Standard 8
  const std = [0x000000, 0xcc0000, 0x00cc00, 0xcccc00, 0x0000cc, 0xcc00cc, 0x00cccc, 0xd3d3d3];
  // Bright 8
  const brt = [0x808080, 0xff0000, 0x00ff00, 0xffff00, 0x0000ff, 0xff00ff, 0x00ffff, 0xffffff];

  for (const c of std) p.push(c);
  for (const c of brt) p.push(c);

  // 6×6×6 cube (indices 16-231)
  const cubeVal = (n: number) => (n === 0 ? 0 : 55 + n * 40);
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        p.push((cubeVal(r) << 16) | (cubeVal(g) << 8) | cubeVal(b));
      }
    }
  }

  // 24-step greyscale (indices 232-255)
  for (let i = 0; i < 24; i++) {
    const v = 8 + i * 10;
    p.push((v << 16) | (v << 8) | v);
  }

  return p;
})();

// ── Color resolution ──────────────────────────────────────────────────────

/**
 * Resolve a CellColor to a packed 0xAARRGGBB integer suitable for Skia.
 *
 * @param color        The CellColor to resolve.
 * @param defaultRgb   Packed 0xRRGGBB used when kind === 'default'.
 * @param themePalette Optional 16-element array overriding ANSI colours 0-15.
 *                     Indices 16-255 always use the standard xterm cube/greyscale.
 */
export function resolveColor(
  color: CellColor,
  defaultRgb: number,
  themePalette?: readonly number[],
): number {
  switch (color.kind) {
    case 'default':
      return 0xff000000 | defaultRgb;
    case 'palette': {
      const idx = color.index;
      // Theme overrides indices 0-15 (standard ANSI); 16-255 use xterm table
      const rgb =
        idx < 16 && themePalette
          ? (themePalette[idx] ?? ANSI_256[idx] ?? 0xffffff)
          : (ANSI_256[idx] ?? 0xffffff);
      return 0xff000000 | rgb;
    }
    case 'rgb':
      return (0xff << 24) | (color.r << 16) | (color.g << 8) | color.b;
  }
}

/**
 * Convenience: resolve fg & bg with inverse-video support.
 * Returns `{ fg, bg }` as 0xAARRGGBB integers.
 *
 * @param themePalette Optional 16-element theme ANSI palette (overrides 0-15).
 */
export function resolveCellColors(
  cell: TerminalCell,
  defaultFgRgb: number,
  defaultBgRgb: number,
  themePalette?: readonly number[],
): { fg: number; bg: number } {
  let fg = resolveColor(cell.fg, defaultFgRgb, themePalette);
  let bg = resolveColor(cell.bg, defaultBgRgb, themePalette);

  if (cell.inverse) {
    [fg, bg] = [bg, fg];
  }
  if (cell.invisible) {
    fg = bg; // render char as invisible by matching fg to bg
  }
  if (cell.dim) {
    // Reduce fg brightness by ~50%
    const r = ((fg >> 16) & 0xff) >> 1;
    const g = ((fg >> 8) & 0xff) >> 1;
    const b = (fg & 0xff) >> 1;
    fg = (0xff << 24) | (r << 16) | (g << 8) | b;
  }

  return { fg, bg };
}
