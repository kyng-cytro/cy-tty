import { Glyphs, Group, Rect, type SkFont } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';

import { resolveCellColors } from '@/core/terminal/grid';
import type { TerminalCell } from '@/core/terminal/types';
import { argbToHex } from '@/core/terminal/colors';

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

function buildRowData(
  cells: TerminalCell[],
  rowY: number,
  cellWidth: number,
  cellHeight: number,
  baseline: number,
  font: SkFont,
  fgRgb: number,
  bgRgb: number,
  themePalette: readonly number[] | undefined,
): { bgRects: BgRect[]; glyphRuns: GlyphRun[] } {
  const bgRects: BgRect[] = [];
  const runMap = new Map<string, GlyphRun>();

  for (let col = 0; col < cells.length; col++) {
    const cell = cells[col]!;
    const x = col * cellWidth;

    const { fg, bg } = resolveCellColors(cell, fgRgb, bgRgb, themePalette);

    if ((bg & 0x00ffffff) !== bgRgb) {
      bgRects.push({ x, y: rowY, w: cellWidth, h: cellHeight, color: argbToHex(bg) });
    }

    if (!cell.char || cell.invisible) continue;

    const ids = font.getGlyphIDs(cell.char);
    if (!ids || ids.length === 0) continue;

    const colorKey = argbToHex(fg);
    if (!runMap.has(colorKey)) {
      runMap.set(colorKey, { glyphs: [], color: colorKey });
    }
    const run = runMap.get(colorKey)!;

    for (const id of ids) {
      run.glyphs.push({ id, pos: { x, y: rowY + baseline } });
    }
  }

  return { bgRects, glyphRuns: [...runMap.values()] };
}

export interface TerminalRowProps {
  cells: TerminalCell[];
  rowIndex: number;
  cellWidth: number;
  cellHeight: number;
  baseline: number;
  font: SkFont;
  boldFont: SkFont | null;
  fgRgb: number;
  bgRgb: number;
  themePalette?: readonly number[];
}

export const TerminalRow = memo(function TerminalRow({
  cells,
  rowIndex,
  cellWidth,
  cellHeight,
  baseline,
  font,
  boldFont,
  fgRgb,
  bgRgb,
  themePalette,
}: TerminalRowProps) {
  const rowY = rowIndex * cellHeight;

  const { bgRects, glyphRuns } = useMemo(
    () => buildRowData(cells, rowY, cellWidth, cellHeight, baseline, font, fgRgb, bgRgb, themePalette),
    [cells, rowY, cellWidth, cellHeight, baseline, font, fgRgb, bgRgb, themePalette],
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
