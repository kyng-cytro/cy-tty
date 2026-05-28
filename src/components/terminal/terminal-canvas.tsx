import React from "react";
import { Canvas, Rect, useFont } from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import {
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import type { TerminalCell, TerminalState } from "@/core/terminal/types";
import { useTerminalPreferences } from "@/core/theme/preferences-context";
import { TerminalRow } from "./terminal-row";

const JBM_REG = require("../../../assets/fonts/JetBrainsMono-Regular.ttf");
const JBM_BOLD = require("../../../assets/fonts/JetBrainsMono-Bold.ttf");
const FC_REG = require("../../../assets/fonts/FiraCode-Regular.ttf");
const FC_BOLD = require("../../../assets/fonts/FiraCode-Bold.ttf");
const CC_REG = require("../../../assets/fonts/CascadiaCode-Regular.ttf");
const CC_BOLD = require("../../../assets/fonts/CascadiaCode-Bold.ttf");
const HK_REG = require("../../../assets/fonts/Hack-Regular.ttf");
const HK_BOLD = require("../../../assets/fonts/Hack-Bold.ttf");

export interface SelectionRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface TerminalCanvasProps {
  state: TerminalState;
  scrollOffset?: number;
  selection?: SelectionRange | null;
  onCellSize?: (cellWidth: number, cellHeight: number) => void;
  style?: StyleProp<ViewStyle>;
}

function makeEmptyRow(cols: number): TerminalCell[] {
  return Array.from({ length: cols }, () => ({
    char: "",
    width: 1,
    fg: { kind: "default" as const },
    bg: { kind: "default" as const },
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    blink: false,
    inverse: false,
    invisible: false,
    strikethrough: false,
  }));
}

export function TerminalCanvas({
  state,
  scrollOffset = 0,
  selection = null,
  onCellSize,
  style,
}: TerminalCanvasProps) {
  const { resolvedTheme, font: activeFont, fontSize } = useTerminalPreferences();

  const jbmReg = useFont(JBM_REG, fontSize);
  const jbmBold = useFont(JBM_BOLD, fontSize);
  const fcReg = useFont(FC_REG, fontSize);
  const fcBold = useFont(FC_BOLD, fontSize);
  const ccReg = useFont(CC_REG, fontSize);
  const ccBold = useFont(CC_BOLD, fontSize);
  const hkReg = useFont(HK_REG, fontSize);
  const hkBold = useFont(HK_BOLD, fontSize);

  const { regularFont, boldFont } = useMemo(() => {
    switch (activeFont.id) {
      case "fira-code":
        return { regularFont: fcReg, boldFont: fcBold };
      case "cascadia-code":
        return { regularFont: ccReg, boldFont: ccBold };
      case "hack":
        return { regularFont: hkReg, boldFont: hkBold };
      default:
        return { regularFont: jbmReg, boldFont: jbmBold };
    }
  }, [activeFont.id, jbmReg, jbmBold, fcReg, fcBold, ccReg, ccBold, hkReg, hkBold]);

  const { cellWidth, cellHeight, baseline } = useMemo(() => {
    if (!regularFont) return { cellWidth: 0, cellHeight: 0, baseline: 0 };

    const metrics = regularFont.getMetrics();
    const ch = Math.ceil(-metrics.ascent + metrics.descent + (metrics.leading ?? 0));
    const rect = regularFont.measureText("M");
    const cw = Math.ceil(rect.width);
    const bl = -metrics.ascent;

    return { cellWidth: cw, cellHeight: ch, baseline: bl };
  }, [regularFont, fontSize]);

  useEffect(() => {
    if (cellWidth > 0 && cellHeight > 0) {
      onCellSize?.(cellWidth, cellHeight);
    }
  }, [cellWidth, cellHeight, onCellSize]);

  // Build the display grid: when scrolled, slice from combined scrollback+grid
  const displayGrid = useMemo(() => {
    if (scrollOffset === 0) return state.grid;
    const combined: TerminalCell[][] = [...state.scrollback, ...state.grid];
    const end = Math.max(0, combined.length - scrollOffset);
    const start = Math.max(0, end - state.rows);
    const slice = combined.slice(start, end);
    while (slice.length < state.rows) slice.unshift(makeEmptyRow(state.cols));
    return slice;
  }, [state.grid, state.scrollback, state.rows, state.cols, scrollOffset]);

  const bgHex = resolvedTheme.backgroundHex;
  const fgRgb = resolvedTheme.foregroundRgb;
  const bgRgb = resolvedTheme.backgroundRgb;
  const themePalette = resolvedTheme.ansiPalette;

  const cursorOpacity = useSharedValue(1);

  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 530 }),
        withTiming(0, { duration: 530 }),
      ),
      -1,
    );
    return () => {
      cursorOpacity.value = 1;
    };
  }, [cursorOpacity]);

  const canvasWidth = state.cols * cellWidth;
  const canvasHeight = state.rows * cellHeight;
  const cursorX = state.cursor.col * cellWidth;
  const cursorY = state.cursor.row * cellHeight;

  // Scroll indicator geometry
  const totalLines = state.scrollback.length + state.rows;
  const indicatorHeight = totalLines > state.rows
    ? Math.max(16, (state.rows / totalLines) * canvasHeight)
    : 0;
  const indicatorY = totalLines > state.rows
    ? ((state.scrollback.length - scrollOffset) / totalLines) * canvasHeight
    : 0;

  if (!regularFont || cellWidth === 0) {
    return <View style={[{ backgroundColor: bgHex }, styles.loading, style]} />;
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: bgHex }, style]}>
      <Canvas style={[styles.canvas, { width: canvasWidth, height: canvasHeight }]}>
        <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} color={bgHex} />

        {displayGrid.map((cells, rowIndex) => (
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

        {selection && (() => {
          // Normalise so start is always before end
          const r0 = selection.startRow;
          const c0 = selection.startCol;
          const r1 = selection.endRow;
          const c1 = selection.endCol;
          const [sr, sc, er, ec] =
            r0 < r1 || (r0 === r1 && c0 <= c1)
              ? [r0, c0, r1, c1]
              : [r1, c1, r0, c0];
          const rects: React.ReactElement[] = [];
          for (let r = sr; r <= er; r++) {
            const x = r === sr ? sc * cellWidth : 0;
            const endX = r === er ? (ec + 1) * cellWidth : state.cols * cellWidth;
            rects.push(
              <Rect
                key={r}
                x={x}
                y={r * cellHeight}
                width={Math.max(cellWidth, endX - x)}
                height={cellHeight}
                color="#4d8fe880"
              />,
            );
          }
          return rects;
        })()}

        {scrollOffset === 0 && state.cursor.visible && (
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

        {scrollOffset > 0 && indicatorHeight > 0 && (
          <Rect
            x={canvasWidth - 3}
            y={indicatorY}
            width={3}
            height={indicatorHeight}
            color="#ffffff44"
          />
        )}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { overflow: "hidden" },
  canvas: {},
  loading: {},
});
