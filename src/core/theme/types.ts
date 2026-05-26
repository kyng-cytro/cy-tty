export interface TerminalTheme {
  id: string;
  name: string;
  category: string;
  dark: boolean;
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  ansi: readonly [
    string, string, string, string, string, string, string, string,
    string, string, string, string, string, string, string, string,
  ];
}

export interface ResolvedTheme {
  backgroundHex: string;
  backgroundRgb: number;
  foregroundRgb: number;
  cursorHex: string;
  selectionHex: string;
  ansiPalette: readonly number[];
}

export function hexToRgb(hex: string): number {
  const h = hex.replace('#', '');
  return parseInt(h, 16);
}

export function resolveTheme(theme: TerminalTheme): ResolvedTheme {
  return {
    backgroundHex: theme.background,
    backgroundRgb: hexToRgb(theme.background),
    foregroundRgb: hexToRgb(theme.foreground),
    cursorHex: theme.cursor,
    selectionHex: theme.selection,
    ansiPalette: theme.ansi.map(hexToRgb),
  };
}
