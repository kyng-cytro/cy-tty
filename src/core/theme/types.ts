/**
 * Terminal theme types.
 *
 * TerminalTheme defines all colours needed to render a terminal session.
 * ANSI colours 0-15 come from the theme; 16-255 (xterm cube + greyscale)
 * use the standard xterm palette regardless of theme.
 */

export interface TerminalTheme {
  /** Unique ID used for storage. */
  id: string;
  /** Display name shown in Settings. */
  name: string;
  /** Category label for grouping (e.g. "Catppuccin", "VS Code", "ACE"). */
  category: string;
  /** Whether this is a dark or light theme (drives status bar style). */
  dark: boolean;

  // ── Core colours ─────────────────────────────────────────────────────────
  /** Terminal default background colour (hex, e.g. "#1a1b26"). */
  background: string;
  /** Terminal default foreground (text) colour. */
  foreground: string;
  /** Cursor colour. */
  cursor: string;
  /** Text-selection highlight colour. */
  selection: string;

  // ── 16 ANSI colours (0-7 normal, 8-15 bright) ───────────────────────────
  /**
   * Exactly 16 hex strings: [black, red, green, yellow, blue, magenta, cyan, white,
   *                           brBlack, brRed, brGreen, brYellow, brBlue, brMagenta, brCyan, brWhite]
   */
  ansi: readonly [
    string, string, string, string, string, string, string, string,
    string, string, string, string, string, string, string, string,
  ];
}

// ── Runtime colour representation ─────────────────────────────────────────

/**
 * Pre-processed theme colours as packed 0xRRGGBB integers (no alpha —
 * Skia renderer adds 0xff alpha prefix itself).
 */
export interface ResolvedTheme {
  backgroundHex: string;
  backgroundRgb: number;
  foregroundRgb: number;
  cursorHex: string;
  selectionHex: string;
  /** 16 packed RGB integers for ANSI colours 0-15. */
  ansiPalette: readonly number[];
}

/** Convert a "#rrggbb" hex string to a packed 0xRRGGBB integer. */
export function hexToRgb(hex: string): number {
  const h = hex.replace('#', '');
  return parseInt(h, 16);
}

/** Convert a TerminalTheme to a ResolvedTheme. */
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
