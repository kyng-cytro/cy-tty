export interface TerminalFont {
  id: string;
  name: string;
  description: string;
  ligatures: boolean;
}

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

export type FontVariant = 'regular' | 'bold';

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

export function getFontById(id: string): TerminalFont {
  return TERMINAL_FONTS.find((f) => f.id === id) ?? TERMINAL_FONTS[0]!;
}
