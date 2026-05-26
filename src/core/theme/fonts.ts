/**
 * Terminal font definitions.
 *
 * To add a new font:
 *   1. Drop the Regular and Bold .ttf files in assets/fonts/
 *   2. Add a new entry to TERMINAL_FONTS below
 *   3. Add the require() calls to the asset map
 *
 * Font assets are statically required so Metro can bundle them.
 */

export interface TerminalFont {
  /** Unique ID used for storage. */
  id: string;
  /** Display name shown in Settings. */
  name: string;
  /** Short descriptor shown as subtitle. */
  description: string;
  /** Whether ligatures are supported (informational only). */
  ligatures: boolean;
}

// ── Font definitions ──────────────────────────────────────────────────────────

export const TERMINAL_FONTS: readonly TerminalFont[] = [
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    description: 'JetBrains · Ligatures',
    ligatures: true,
  },
  {
    id: 'fira-code',
    name: 'Fira Code',
    description: 'Nikita Prokopov · Ligatures',
    ligatures: true,
  },
  {
    id: 'cascadia-code',
    name: 'Cascadia Code',
    description: 'Microsoft · Ligatures',
    ligatures: true,
  },
  {
    id: 'hack',
    name: 'Hack',
    description: 'Source Foundry · No ligatures',
    ligatures: false,
  },
];

// ── Asset map ─────────────────────────────────────────────────────────────────
//
// Each font needs Regular + Bold variants. The require() calls must be
// statically analysable by Metro — no dynamic paths.

export type FontVariant = 'regular' | 'bold';

/** Return the static asset for a given font ID and variant. */
export function getFontAsset(
  fontId: string,
  variant: FontVariant,
): ReturnType<typeof require> | null {
  switch (`${fontId}:${variant}`) {
    case 'jetbrains-mono:regular':
      return require('../../../assets/fonts/JetBrainsMono-Regular.ttf');
    case 'jetbrains-mono:bold':
      return require('../../../assets/fonts/JetBrainsMono-Bold.ttf');
    case 'fira-code:regular':
      return require('../../../assets/fonts/FiraCode-Regular.ttf');
    case 'fira-code:bold':
      return require('../../../assets/fonts/FiraCode-Bold.ttf');
    case 'cascadia-code:regular':
      return require('../../../assets/fonts/CascadiaCode-Regular.ttf');
    case 'cascadia-code:bold':
      return require('../../../assets/fonts/CascadiaCode-Bold.ttf');
    case 'hack:regular':
      return require('../../../assets/fonts/Hack-Regular.ttf');
    case 'hack:bold':
      return require('../../../assets/fonts/Hack-Bold.ttf');
    default:
      return null;
  }
}

/** Get a font definition by ID, or the default JetBrains Mono. */
export function getFontById(id: string): TerminalFont {
  return TERMINAL_FONTS.find((f) => f.id === id) ?? TERMINAL_FONTS[0]!;
}
