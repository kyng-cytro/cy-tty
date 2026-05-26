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

export const DEFAULT_FG_RGB = 0xe0e0e0;
export const DEFAULT_BG_RGB = 0x1a1b26;

export const DEFAULT_FG_HEX = argbToHex(0xff000000 | DEFAULT_FG_RGB);
export const DEFAULT_BG_HEX = argbToHex(0xff000000 | DEFAULT_BG_RGB);
