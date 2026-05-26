/**
 * TerminalRow — renders one row of the terminal grid using Skia.
 *
 * Wrapped in React.memo so it only re-renders when its `cells` array reference
 * changes.  applyDelta() in grid.ts preserves references for unchanged rows,
 * so React skips them automatically.
 */

import { Glyphs, Group, Rect, type SkFont } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';

import { resolveCellColors } from '@/core/terminal/grid';
import type { TerminalCell } from '@/core/terminal/types';
import {
  argbToHex,
  DEFAULT_BG_HEX,
  DEFAULT_BG_RGB,
  DEFAULT_FG_RGB,
} from '@/core/terminal/colors';

// ── Types ─────────────────────────────────────────────────────────────────

interface GlyphRun {
  glyphs: { id: number; pos: { x: number; y: number } }[];
  color: string;
}

interface BgRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

// ── Row render-data computation ───────────────────────────────────────────

/**
 * Walk one terminal row and produce:
 *  - bgRects  : non-default background fills
 *  - glyphRuns: glyph groups batched by fg colour
 */
function buildRowData(
  cells: TerminalCell[],
  rowY: number,
  cellWidth: number,
  cellHeight: number,
  baseline: number,
  font: SkFont,
): { bgRects: BgRect[]; glyphRuns: GlyphRun[] } {
  const bgRects: BgRect[] = [];
  // Map<colorHex, GlyphRun> — one entry per distinct fg colour in this row
  const runMap = new Map<string, GlyphRun>();

  for (let col = 0; col < cells.length; col++) {
    const cell = cells[col]!;
    const x = col * cellWidth;

    const { fg, bg } = resolveCellColors(cell, DEFAULT_FG_RGB, DEFAULT_BG_RGB);

    // ── Background rect (skip default background to avoid overdraw) ───────
    if ((bg & 0x00ffffff) !== DEFAULT_BG_RGB) {
      bgRects.push({ x, y: rowY, w: cellWidth, h: cellHeight, color: argbToHex(bg) });
    }

    // ── Glyph ─────────────────────────────────────────────────────────────
    if (!cell.char || cell.invisible) continue;

    const ids = font.getGlyphIDs(cell.char);
    if (!ids || ids.length === 0) continue;

    const colorKey = argbToHex(fg);
    if (!runMap.has(colorKey)) {
      runMap.set(colorKey, { glyphs: [], color: colorKey });
    }
    const run = runMap.get(colorKey)!;

    // For a monospace font all glyphs share the same advance, so we place
    // each glyph at its column's x with the row's baseline y.
    for (const id of ids) {
      run.glyphs.push({ id, pos: { x, y: rowY + baseline } });
    }
  }

  return { bgRects, glyphRuns: [...runMap.values()] };
}

// ── Component ─────────────────────────────────────────────────────────────

export interface TerminalRowProps {
  cells: TerminalCell[];
  rowIndex: number;
  cellWidth: number;
  cellHeight: number;
  /** Distance from cell top to text baseline (pixels). */
  baseline: number;
  font: SkFont;
  boldFont: SkFont | null;
}

export const TerminalRow = memo(function TerminalRow({
  cells,
  rowIndex,
  cellWidth,
  cellHeight,
  baseline,
  font,
  boldFont,
}: TerminalRowProps) {
  const rowY = rowIndex * cellHeight;

  const { bgRects, glyphRuns } = useMemo(
    () => buildRowData(cells, rowY, cellWidth, cellHeight, baseline, font),
    // cells reference only changes when this row is dirty (see applyDelta)
    [cells, rowY, cellWidth, cellHeight, baseline, font],
  );

  return (
    <Group>
      {bgRects.map((r, i) => (
        <Rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} color={r.color} />
      ))}
      {glyphRuns.map((run, i) => (
        <Glyphs key={i} font={font} x={0} y={0} glyphs={run.glyphs} color={run.color} />
      ))}
    </Group>
  );
});
