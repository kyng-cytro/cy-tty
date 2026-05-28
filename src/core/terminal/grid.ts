import type { CellColor, TerminalCell, TerminalDelta, TerminalState } from './types';

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
    scrollback: [],
    cursor: { row: 0, col: 0, visible: true, shape: 'block' },
    cols,
    rows,
    title: '',
    alternateScreen: false,
  };
}

const SCROLLBACK_MAX = 1000;

export function applyDelta(state: TerminalState, delta: TerminalDelta): TerminalState {
  // Append any newly scrolled-off rows to the scrollback buffer
  let scrollback = state.scrollback;
  if (delta.appendedScrollback.length > 0) {
    scrollback = [...state.scrollback, ...delta.appendedScrollback];
    if (scrollback.length > SCROLLBACK_MAX) {
      scrollback = scrollback.slice(scrollback.length - SCROLLBACK_MAX);
    }
  }

  if (delta.cleared) {
    const fresh = createEmptyGrid(state.cols, state.rows);
    for (const { index, cells } of delta.dirtyRows) {
      if (index < fresh.length) fresh[index] = cells;
    }
    return {
      ...state,
      scrollback,
      grid: fresh,
      cursor: delta.cursor,
      title: delta.title ?? state.title,
    };
  }

  if (delta.dirtyRows.length === 0 && delta.appendedScrollback.length === 0) {
    return {
      ...state,
      cursor: delta.cursor,
      title: delta.title ?? state.title,
    };
  }

  const grid = state.grid.slice();
  for (const { index, cells } of delta.dirtyRows) {
    if (index < grid.length) grid[index] = cells;
  }

  return {
    ...state,
    scrollback,
    grid,
    cursor: delta.cursor,
    title: delta.title ?? state.title,
  };
}

export const ANSI_256: readonly number[] = (() => {
  const p: number[] = [];

  const std = [0x000000, 0xcc0000, 0x00cc00, 0xcccc00, 0x0000cc, 0xcc00cc, 0x00cccc, 0xd3d3d3];
  const brt = [0x808080, 0xff0000, 0x00ff00, 0xffff00, 0x0000ff, 0xff00ff, 0x00ffff, 0xffffff];

  for (const c of std) p.push(c);
  for (const c of brt) p.push(c);

  const cubeVal = (n: number) => (n === 0 ? 0 : 55 + n * 40);
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        p.push((cubeVal(r) << 16) | (cubeVal(g) << 8) | cubeVal(b));
      }
    }
  }

  for (let i = 0; i < 24; i++) {
    const v = 8 + i * 10;
    p.push((v << 16) | (v << 8) | v);
  }

  return p;
})();

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
    fg = bg;
  }
  if (cell.dim) {
    const r = ((fg >> 16) & 0xff) >> 1;
    const g = ((fg >> 8) & 0xff) >> 1;
    const b = (fg & 0xff) >> 1;
    fg = (0xff << 24) | (r << 16) | (g << 8) | b;
  }

  return { fg, bg };
}
