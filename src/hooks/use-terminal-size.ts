import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const DEFAULT_CELL_WIDTH = 7.2;
export const DEFAULT_CELL_HEIGHT = 16;
export const KEYBOARD_TOOLBAR_HEIGHT = 44;

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
}: {
  cellWidth?: number;
  cellHeight?: number;
  toolbarHeight?: number;
} = {}): TerminalSizeResult {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const terminalWidth  = width  - insets.left  - insets.right;
  const terminalHeight = height - insets.top   - insets.bottom - toolbarHeight;

  const cols = Math.max(1, Math.floor(terminalWidth  / cellWidth));
  const rows = Math.max(1, Math.floor(terminalHeight / cellHeight));

  return { cols, rows, cellWidth, cellHeight, terminalWidth, terminalHeight };
}
