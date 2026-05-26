import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const DEFAULT_CELL_WIDTH = 7.2;
export const DEFAULT_CELL_HEIGHT = 16;
export const KEYBOARD_TOOLBAR_HEIGHT = 44;

// Visual breathing room around the rendered terminal content.
// These same values must be applied both here (so cols/rows shrink to match)
// and as padding on the canvas wrapper in the terminal screen.
export const CONTENT_PADDING_TOP = 8;
export const CONTENT_PADDING_H   = 4; // per side

export interface TerminalSizeResult {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  terminalWidth: number;
  terminalHeight: number;
}

export function useTerminalSize({
  cellWidth = DEFAULT_CELL_WIDTH,
  cellHeight = DEFAULT_CELL_HEIGHT,
  toolbarHeight = KEYBOARD_TOOLBAR_HEIGHT,
  paddingTop = 0,
  paddingH = 0,
}: {
  cellWidth?: number;
  cellHeight?: number;
  toolbarHeight?: number;
  paddingTop?: number;
  paddingH?: number;
} = {}): TerminalSizeResult {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const terminalWidth  = width  - insets.left  - insets.right  - paddingH * 2;
  const terminalHeight = height - insets.top   - insets.bottom - toolbarHeight - paddingTop;

  const cols = Math.max(1, Math.floor(terminalWidth  / cellWidth));
  const rows = Math.max(1, Math.floor(terminalHeight / cellHeight));

  return { cols, rows, cellWidth, cellHeight, terminalWidth, terminalHeight };
}
