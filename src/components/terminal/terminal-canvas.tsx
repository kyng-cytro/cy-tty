/**
 * TerminalCanvas — full Skia-rendered terminal display.
 *
 * Rendering pipeline:
 *  1. Load JetBrains Mono via Skia useFont (regular + bold).
 *  2. Measure cell dimensions from font metrics.
 *  3. Report cell size to parent so useTerminalSize can compute cols/rows.
 *  4. Render each row via <TerminalRow> (memo'd, only dirty rows repaint).
 *  5. Cursor overlay: XOR rect animated via Reanimated shared value.
 */

import { Canvas, Rect, useFont } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { TerminalState } from '@/core/terminal/types';
import { DEFAULT_BG_HEX } from '@/core/terminal/colors';
import { TerminalRow } from './terminal-row';

// ── Font paths ─────────────────────────────────────────────────────────────

const FONT_REGULAR = require('../../../assets/fonts/JetBrainsMono-Regular.ttf');
const FONT_BOLD = require('../../../assets/fonts/JetBrainsMono-Bold.ttf');

// ── Types ──────────────────────────────────────────────────────────────────

export interface TerminalCanvasProps {
  state: TerminalState;
  /**
   * Called once (and again if font size changes) with the measured cell size.
   * Parent should feed these into useTerminalSize to derive cols / rows.
   */
  onCellSize?: (cellWidth: number, cellHeight: number) => void;
  /** Font size in points. Default 13. */
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
}

// ── Component ──────────────────────────────────────────────────────────────

export function TerminalCanvas({
  state,
  onCellSize,
  fontSize = 13,
  style,
}: TerminalCanvasProps) {
  // ── Font loading ───────────────────────────────────────────────────────
  const regularFont = useFont(FONT_REGULAR, fontSize);
  const boldFont = useFont(FONT_BOLD, fontSize);

  // ── Cell metrics ───────────────────────────────────────────────────────
  const { cellWidth, cellHeight, baseline } = useMemo(() => {
    if (!regularFont) return { cellWidth: 0, cellHeight: 0, baseline: 0 };

    const metrics = regularFont.getMetrics();
    // ascent is negative (above baseline), descent is positive (below)
    const ch = Math.ceil(-metrics.ascent + metrics.descent + (metrics.leading ?? 0));
    // Monospace: all glyphs share the same advance — measure any ASCII char
    const rect = regularFont.measureText('M');
    const cw = Math.ceil(rect.width);
    const bl = -metrics.ascent; // distance from cell top to baseline

    return { cellWidth: cw, cellHeight: ch, baseline: bl };
  }, [regularFont, fontSize]);

  // Report cell size to parent whenever it changes
  useEffect(() => {
    if (cellWidth > 0 && cellHeight > 0) {
      onCellSize?.(cellWidth, cellHeight);
    }
  }, [cellWidth, cellHeight, onCellSize]);

  // ── Cursor blink ───────────────────────────────────────────────────────
  const cursorOpacity = useSharedValue(1);

  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 530 }),
        withTiming(0, { duration: 530 }),
      ),
      /* iterations */ -1,
    );
    return () => {
      cursorOpacity.value = 1;
    };
  }, [cursorOpacity]);

  // ── Canvas size ────────────────────────────────────────────────────────
  const canvasWidth = state.cols * cellWidth;
  const canvasHeight = state.rows * cellHeight;

  // ── Cursor geometry ────────────────────────────────────────────────────
  const cursorX = state.cursor.col * cellWidth;
  const cursorY = state.cursor.row * cellHeight;

  // ── Loading state ──────────────────────────────────────────────────────
  if (!regularFont || cellWidth === 0) {
    return <View style={[styles.loading, style]} />;
  }

  return (
    <View style={[styles.wrapper, style]}>
      <Canvas
        style={[
          styles.canvas,
          { width: canvasWidth, height: canvasHeight },
        ]}
      >
        {/* ── Background fill for the entire terminal area ────────────── */}
        <Rect
          x={0}
          y={0}
          width={canvasWidth}
          height={canvasHeight}
          color={DEFAULT_BG_HEX}
        />

        {/* ── Grid rows (only dirty rows re-render via React.memo) ─────── */}
        {state.grid.map((cells, rowIndex) => (
          <TerminalRow
            key={rowIndex}
            cells={cells}
            rowIndex={rowIndex}
            cellWidth={cellWidth}
            cellHeight={cellHeight}
            baseline={baseline}
            font={regularFont}
            boldFont={boldFont}
          />
        ))}

        {/* ── Cursor overlay ───────────────────────────────────────────── */}
        {state.cursor.visible && (
          <Rect
            x={cursorX}
            y={cursorY}
            width={cellWidth}
            height={cellHeight}
            color="#ffffff"
            blendMode="difference"
            opacity={cursorOpacity}
          />
        )}
      </Canvas>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: DEFAULT_BG_HEX,
    overflow: 'hidden',
  },
  canvas: {
    // Canvas size is set dynamically from state.cols/rows × cell dimensions
  },
  loading: {
    backgroundColor: DEFAULT_BG_HEX,
  },
});
