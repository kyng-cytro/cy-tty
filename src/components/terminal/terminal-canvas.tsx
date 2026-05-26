/**
 * TerminalCanvas — full Skia-rendered terminal display.
 *
 * Rendering pipeline:
 *  1. Load all font variants (Regular + Bold for each available font) via Skia useFont.
 *  2. Select the active font from TerminalPreferences.
 *  3. Measure cell dimensions from font metrics.
 *  4. Report cell size to parent so useTerminalSize can compute cols/rows.
 *  5. Render each row via <TerminalRow> (memo'd, only dirty rows repaint).
 *  6. Cursor overlay: XOR rect animated via Reanimated shared value.
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
import { useTerminalPreferences } from '@/core/theme/preferences-context';
import { TerminalRow } from './terminal-row';

// ── Static font asset imports (Metro requires static paths) ────────────────

// JetBrains Mono
const JBM_REG  = require('../../../assets/fonts/JetBrainsMono-Regular.ttf');
const JBM_BOLD = require('../../../assets/fonts/JetBrainsMono-Bold.ttf');
// Fira Code
const FC_REG   = require('../../../assets/fonts/FiraCode-Regular.ttf');
const FC_BOLD  = require('../../../assets/fonts/FiraCode-Bold.ttf');
// Cascadia Code
const CC_REG   = require('../../../assets/fonts/CascadiaCode-Regular.ttf');
const CC_BOLD  = require('../../../assets/fonts/CascadiaCode-Bold.ttf');
// Hack
const HK_REG   = require('../../../assets/fonts/Hack-Regular.ttf');
const HK_BOLD  = require('../../../assets/fonts/Hack-Bold.ttf');

// ── Types ──────────────────────────────────────────────────────────────────

export interface TerminalCanvasProps {
  state: TerminalState;
  /**
   * Called once (and again if font / font size changes) with the measured
   * cell size. Parent should feed these into useTerminalSize to derive cols/rows.
   */
  onCellSize?: (cellWidth: number, cellHeight: number) => void;
  style?: StyleProp<ViewStyle>;
}

// ── Component ──────────────────────────────────────────────────────────────

export function TerminalCanvas({
  state,
  onCellSize,
  style,
}: TerminalCanvasProps) {
  const { resolvedTheme, font: activeFont, fontSize } = useTerminalPreferences();

  // ── Load all fonts (hooks must not be conditional) ─────────────────────
  const jbmReg  = useFont(JBM_REG,  fontSize);
  const jbmBold = useFont(JBM_BOLD, fontSize);
  const fcReg   = useFont(FC_REG,   fontSize);
  const fcBold  = useFont(FC_BOLD,  fontSize);
  const ccReg   = useFont(CC_REG,   fontSize);
  const ccBold  = useFont(CC_BOLD,  fontSize);
  const hkReg   = useFont(HK_REG,   fontSize);
  const hkBold  = useFont(HK_BOLD,  fontSize);

  // ── Select active font pair ────────────────────────────────────────────
  const { regularFont, boldFont } = useMemo(() => {
    switch (activeFont.id) {
      case 'fira-code':      return { regularFont: fcReg,  boldFont: fcBold  };
      case 'cascadia-code':  return { regularFont: ccReg,  boldFont: ccBold  };
      case 'hack':           return { regularFont: hkReg,  boldFont: hkBold  };
      default:               return { regularFont: jbmReg, boldFont: jbmBold };
    }
  }, [activeFont.id, jbmReg, jbmBold, fcReg, fcBold, ccReg, ccBold, hkReg, hkBold]);

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

  // ── Theme colours ──────────────────────────────────────────────────────
  const bgHex       = resolvedTheme.backgroundHex;
  const fgRgb       = resolvedTheme.foregroundRgb;
  const bgRgb       = resolvedTheme.backgroundRgb;
  const themePalette = resolvedTheme.ansiPalette;

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
  const canvasWidth  = state.cols * cellWidth;
  const canvasHeight = state.rows * cellHeight;

  // ── Cursor geometry ────────────────────────────────────────────────────
  const cursorX = state.cursor.col * cellWidth;
  const cursorY = state.cursor.row * cellHeight;

  // ── Loading state ──────────────────────────────────────────────────────
  if (!regularFont || cellWidth === 0) {
    return <View style={[{ backgroundColor: bgHex }, styles.loading, style]} />;
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: bgHex }, style]}>
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
          color={bgHex}
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
            fgRgb={fgRgb}
            bgRgb={bgRgb}
            themePalette={themePalette}
          />
        ))}

        {/* ── Cursor overlay ───────────────────────────────────────────── */}
        {state.cursor.visible && (
          <Rect
            x={cursorX}
            y={cursorY}
            width={cellWidth}
            height={cellHeight}
            color={resolvedTheme.cursorHex}
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
    overflow: 'hidden',
  },
  canvas: {
    // Canvas size is set dynamically from state.cols/rows × cell dimensions
  },
  loading: {
    // background set inline from theme
  },
});
