/**
 * Color conversion utilities for the Skia renderer.
 *
 * resolveColor() in grid.ts produces packed 0xAARRGGBB integers.
 * Skia's `color` prop accepts hex strings like "#rrggbbaa".
 */

/**
 * Convert a packed 0xAARRGGBB integer from resolveColor() to a CSS hex string.
 * Alpha is always 0xFF for terminal colors so the output is always "#rrggbb".
 */
export function argbToHex(argb: number): string {
  const r = (argb >> 16) & 0xff;
  const g = (argb >> 8) & 0xff;
  const b = argb & 0xff;
  return (
    '#' +
    r.toString(16).padStart(2, '0') +
    g.toString(16).padStart(2, '0') +
    b.toString(16).padStart(2, '0')
  );
}

// ── Default theme colors (dark terminal, Material You surface tones) ───────

/** Default terminal foreground: warm white. */
export const DEFAULT_FG_RGB = 0xe0e0e0; // 0xFFE0E0E0
/** Default terminal background: near-black surface. */
export const DEFAULT_BG_RGB = 0x1a1b26; // Tokyo Night base

export const DEFAULT_FG_HEX = argbToHex(0xff000000 | DEFAULT_FG_RGB);
export const DEFAULT_BG_HEX = argbToHex(0xff000000 | DEFAULT_BG_RGB);
