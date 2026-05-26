import type { TerminalTheme } from './types';

export const catppuccinMocha: TerminalTheme = {
  id: 'catppuccin-mocha',
  name: 'Mocha',
  category: 'Catppuccin',
  dark: true,
  background: '#1e1e2e',
  foreground: '#cdd6f4',
  cursor:     '#f5e0dc',
  selection:  '#313244',
  ansi: [
    '#45475a', '#f38ba8', '#a6e3a1', '#f9e2af',
    '#89b4fa', '#f5c2e7', '#94e2d5', '#bac2de',
    '#585b70', '#f38ba8', '#a6e3a1', '#f9e2af',
    '#89b4fa', '#f5c2e7', '#94e2d5', '#a6adc8',
  ],
};

export const catppuccinMacchiato: TerminalTheme = {
  id: 'catppuccin-macchiato',
  name: 'Macchiato',
  category: 'Catppuccin',
  dark: true,
  background: '#24273a',
  foreground: '#cad3f5',
  cursor:     '#f4dbd6',
  selection:  '#363a4f',
  ansi: [
    '#494d64', '#ed8796', '#a6da95', '#eed49f',
    '#8aadf4', '#f5bde6', '#8bd5ca', '#b8c0e0',
    '#5b6078', '#ed8796', '#a6da95', '#eed49f',
    '#8aadf4', '#f5bde6', '#8bd5ca', '#a5adcb',
  ],
};

export const catppuccinFrappe: TerminalTheme = {
  id: 'catppuccin-frappe',
  name: 'Frappé',
  category: 'Catppuccin',
  dark: true,
  background: '#303446',
  foreground: '#c6d0f5',
  cursor:     '#f2d5cf',
  selection:  '#414559',
  ansi: [
    '#51576d', '#e78284', '#a6d189', '#e5c890',
    '#8caaee', '#f4b8e4', '#81c8be', '#b5bfe2',
    '#626880', '#e78284', '#a6d189', '#e5c890',
    '#8caaee', '#f4b8e4', '#81c8be', '#a5adce',
  ],
};

export const catppuccinLatte: TerminalTheme = {
  id: 'catppuccin-latte',
  name: 'Latte',
  category: 'Catppuccin',
  dark: false,
  background: '#eff1f5',
  foreground: '#4c4f69',
  cursor:     '#dc8a78',
  selection:  '#ccd0da',
  ansi: [
    '#5c5f77', '#d20f39', '#40a02b', '#df8e1d',
    '#1e66f5', '#ea76cb', '#179299', '#acb0be',
    '#6c6f85', '#d20f39', '#40a02b', '#df8e1d',
    '#1e66f5', '#ea76cb', '#179299', '#bcc0cc',
  ],
};

export const tokyoNight: TerminalTheme = {
  id: 'tokyo-night',
  name: 'Tokyo Night',
  category: 'Tokyo Night',
  dark: true,
  background: '#1a1b26',
  foreground: '#c0caf5',
  cursor:     '#c0caf5',
  selection:  '#283457',
  ansi: [
    '#15161e', '#f7768e', '#9ece6a', '#e0af68',
    '#7aa2f7', '#bb9af7', '#7dcfff', '#a9b1d6',
    '#414868', '#f7768e', '#9ece6a', '#e0af68',
    '#7aa2f7', '#bb9af7', '#7dcfff', '#c0caf5',
  ],
};

export const tokyoNightStorm: TerminalTheme = {
  id: 'tokyo-night-storm',
  name: 'Tokyo Night Storm',
  category: 'Tokyo Night',
  dark: true,
  background: '#24283b',
  foreground: '#c0caf5',
  cursor:     '#c0caf5',
  selection:  '#2e3c64',
  ansi: [
    '#1d202f', '#f7768e', '#9ece6a', '#e0af68',
    '#7aa2f7', '#bb9af7', '#7dcfff', '#a9b1d6',
    '#414868', '#f7768e', '#9ece6a', '#e0af68',
    '#7aa2f7', '#bb9af7', '#7dcfff', '#c0caf5',
  ],
};

export const dracula: TerminalTheme = {
  id: 'dracula',
  name: 'Dracula',
  category: 'Popular',
  dark: true,
  background: '#282a36',
  foreground: '#f8f8f2',
  cursor:     '#f8f8f2',
  selection:  '#44475a',
  ansi: [
    '#21222c', '#ff5555', '#50fa7b', '#f1fa8c',
    '#bd93f9', '#ff79c6', '#8be9fd', '#f8f8f2',
    '#6272a4', '#ff6e6e', '#69ff94', '#ffffa5',
    '#d6acff', '#ff92df', '#a4ffff', '#ffffff',
  ],
};

export const oneDarkPro: TerminalTheme = {
  id: 'one-dark-pro',
  name: 'One Dark Pro',
  category: 'Popular',
  dark: true,
  background: '#282c34',
  foreground: '#abb2bf',
  cursor:     '#528bff',
  selection:  '#3e4451',
  ansi: [
    '#3f4451', '#e06c75', '#98c379', '#e5c07b',
    '#61afef', '#c678dd', '#56b6c2', '#d0d0d0',
    '#4f5666', '#be5046', '#98c379', '#e5c07b',
    '#4d99e0', '#c678dd', '#56b6c2', '#ffffff',
  ],
};

export const gruvboxDark: TerminalTheme = {
  id: 'gruvbox-dark',
  name: 'Gruvbox Dark',
  category: 'Gruvbox',
  dark: true,
  background: '#282828',
  foreground: '#ebdbb2',
  cursor:     '#ebdbb2',
  selection:  '#3c3836',
  ansi: [
    '#282828', '#cc241d', '#98971a', '#d79921',
    '#458588', '#b16286', '#689d6a', '#a89984',
    '#928374', '#fb4934', '#b8bb26', '#fabd2f',
    '#83a598', '#d3869b', '#8ec07c', '#ebdbb2',
  ],
};

export const gruvboxLight: TerminalTheme = {
  id: 'gruvbox-light',
  name: 'Gruvbox Light',
  category: 'Gruvbox',
  dark: false,
  background: '#fbf1c7',
  foreground: '#3c3836',
  cursor:     '#3c3836',
  selection:  '#d5c4a1',
  ansi: [
    '#fbf1c7', '#9d0006', '#79740e', '#b57614',
    '#076678', '#8f3f71', '#427b58', '#7c6f64',
    '#928374', '#cc241d', '#98971a', '#d79921',
    '#458588', '#b16286', '#689d6a', '#3c3836',
  ],
};

export const nord: TerminalTheme = {
  id: 'nord',
  name: 'Nord',
  category: 'Popular',
  dark: true,
  background: '#2e3440',
  foreground: '#d8dee9',
  cursor:     '#d8dee9',
  selection:  '#3b4252',
  ansi: [
    '#3b4252', '#bf616a', '#a3be8c', '#ebcb8b',
    '#81a1c1', '#b48ead', '#88c0d0', '#e5e9f0',
    '#4c566a', '#bf616a', '#a3be8c', '#ebcb8b',
    '#81a1c1', '#b48ead', '#8fbcbb', '#eceff4',
  ],
};

export const solarizedDark: TerminalTheme = {
  id: 'solarized-dark',
  name: 'Solarized Dark',
  category: 'Solarized',
  dark: true,
  background: '#002b36',
  foreground: '#839496',
  cursor:     '#839496',
  selection:  '#073642',
  ansi: [
    '#073642', '#dc322f', '#859900', '#b58900',
    '#268bd2', '#d33682', '#2aa198', '#eee8d5',
    '#002b36', '#cb4b16', '#586e75', '#657b83',
    '#839496', '#6c71c4', '#93a1a1', '#fdf6e3',
  ],
};

export const solarizedLight: TerminalTheme = {
  id: 'solarized-light',
  name: 'Solarized Light',
  category: 'Solarized',
  dark: false,
  background: '#fdf6e3',
  foreground: '#657b83',
  cursor:     '#586e75',
  selection:  '#eee8d5',
  ansi: [
    '#073642', '#dc322f', '#859900', '#b58900',
    '#268bd2', '#d33682', '#2aa198', '#eee8d5',
    '#002b36', '#cb4b16', '#586e75', '#657b83',
    '#839496', '#6c71c4', '#93a1a1', '#fdf6e3',
  ],
};

export const monokai: TerminalTheme = {
  id: 'monokai',
  name: 'Monokai',
  category: 'ACE / Popular',
  dark: true,
  background: '#272822',
  foreground: '#f8f8f2',
  cursor:     '#f8f8f0',
  selection:  '#49483e',
  ansi: [
    '#272822', '#f92672', '#a6e22e', '#f4bf75',
    '#66d9e8', '#ae81ff', '#a1efe4', '#f8f8f2',
    '#75715e', '#f92672', '#a6e22e', '#f4bf75',
    '#66d9e8', '#ae81ff', '#a1efe4', '#f9f8f5',
  ],
};

export const tomorrowNight: TerminalTheme = {
  id: 'tomorrow-night',
  name: 'Tomorrow Night',
  category: 'Tomorrow',
  dark: true,
  background: '#1d1f21',
  foreground: '#c5c8c6',
  cursor:     '#c5c8c6',
  selection:  '#373b41',
  ansi: [
    '#1d1f21', '#cc6666', '#b5bd68', '#f0c674',
    '#81a2be', '#b294bb', '#8abeb7', '#c5c8c6',
    '#969896', '#cc6666', '#b5bd68', '#f0c674',
    '#81a2be', '#b294bb', '#8abeb7', '#e0e0e0',
  ],
};

export const tomorrowNightBlue: TerminalTheme = {
  id: 'tomorrow-night-blue',
  name: 'Tomorrow Night Blue',
  category: 'Tomorrow',
  dark: true,
  background: '#002451',
  foreground: '#ffffff',
  cursor:     '#ffffff',
  selection:  '#003f8e',
  ansi: [
    '#00346e', '#ff9da4', '#d1f1a9', '#ffeead',
    '#bbdaff', '#ebbbff', '#99ffff', '#ffffff',
    '#7285b7', '#ff9da4', '#d1f1a9', '#ffeead',
    '#bbdaff', '#ebbbff', '#99ffff', '#ffffff',
  ],
};

export const tomorrowNightEighties: TerminalTheme = {
  id: 'tomorrow-night-eighties',
  name: 'Tomorrow Night Eighties',
  category: 'Tomorrow',
  dark: true,
  background: '#2d2d2d',
  foreground: '#cccccc',
  cursor:     '#cccccc',
  selection:  '#515151',
  ansi: [
    '#2d2d2d', '#f2777a', '#99cc99', '#ffcc66',
    '#6699cc', '#cc99cc', '#66cccc', '#cccccc',
    '#999999', '#f2777a', '#99cc99', '#ffcc66',
    '#6699cc', '#cc99cc', '#66cccc', '#ffffff',
  ],
};

export const ayuDark: TerminalTheme = {
  id: 'ayu-dark',
  name: 'Ayu Dark',
  category: 'Ayu',
  dark: true,
  background: '#0d1017',
  foreground: '#bfbdb6',
  cursor:     '#e6b450',
  selection:  '#1a2233',
  ansi: [
    '#0d1017', '#ea6c73', '#91b362', '#f9af4f',
    '#53bdfa', '#fae994', '#90e1c6', '#bfbdb6',
    '#686868', '#f07178', '#b8cc52', '#ffb454',
    '#59c2ff', '#ffee99', '#95e6cb', '#ffffff',
  ],
};

export const ayuMirage: TerminalTheme = {
  id: 'ayu-mirage',
  name: 'Ayu Mirage',
  category: 'Ayu',
  dark: true,
  background: '#1f2430',
  foreground: '#cbccc6',
  cursor:     '#ffcc66',
  selection:  '#34455a',
  ansi: [
    '#191e2a', '#ff3333', '#bae67e', '#ffd580',
    '#73d0ff', '#d4bfff', '#95e6cb', '#c7c7c7',
    '#686868', '#f27983', '#bae67e', '#ffd580',
    '#73d0ff', '#d4bfff', '#95e6cb', '#ffffff',
  ],
};

export const vscodeDark: TerminalTheme = {
  id: 'vscode-dark',
  name: 'VS Code Dark+',
  category: 'VS Code',
  dark: true,
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor:     '#aeafad',
  selection:  '#264f78',
  ansi: [
    '#000000', '#cd3131', '#0dbc79', '#e5e510',
    '#2472c8', '#bc3fbc', '#11a8cd', '#e5e5e5',
    '#666666', '#f14c4c', '#23d18b', '#f5f543',
    '#3b8eea', '#d670d6', '#29b8db', '#e5e5e5',
  ],
};

export const vscodeLight: TerminalTheme = {
  id: 'vscode-light',
  name: 'VS Code Light+',
  category: 'VS Code',
  dark: false,
  background: '#ffffff',
  foreground: '#333333',
  cursor:     '#333333',
  selection:  '#add6ff',
  ansi: [
    '#000000', '#cd3131', '#00bc00', '#949800',
    '#0451a5', '#bc05bc', '#0598bc', '#555555',
    '#666666', '#cd3131', '#14ce14', '#b5ba00',
    '#0451a5', '#bc05bc', '#0598bc', '#a5a5a5',
  ],
};

export const materialDark: TerminalTheme = {
  id: 'material-dark',
  name: 'Material Dark',
  category: 'Material',
  dark: true,
  background: '#212121',
  foreground: '#eeffff',
  cursor:     '#ffcc00',
  selection:  '#3c3c3c',
  ansi: [
    '#546e7a', '#f07178', '#c3e88d', '#ffcb6b',
    '#82aaff', '#c792ea', '#89ddff', '#eeffff',
    '#607d8b', '#ff5370', '#c3e88d', '#ffcb6b',
    '#82aaff', '#c792ea', '#89ddff', '#ffffff',
  ],
};

export const materialOcean: TerminalTheme = {
  id: 'material-ocean',
  name: 'Material Ocean',
  category: 'Material',
  dark: true,
  background: '#0f111a',
  foreground: '#8f93a2',
  cursor:     '#84ffff',
  selection:  '#1f2233',
  ansi: [
    '#090b10', '#f07178', '#c3e88d', '#ffcb6b',
    '#82aaff', '#c792ea', '#89ddff', '#ffffff',
    '#464b5d', '#ff5370', '#c3e88d', '#ffcb6b',
    '#82aaff', '#c792ea', '#89ddff', '#ffffff',
  ],
};

export const materialPalenight: TerminalTheme = {
  id: 'material-palenight',
  name: 'Palenight',
  category: 'Material',
  dark: true,
  background: '#292d3e',
  foreground: '#bfc7d5',
  cursor:     '#bfc7d5',
  selection:  '#444267',
  ansi: [
    '#292d3e', '#f07178', '#c3e88d', '#ffcb6b',
    '#82aaff', '#c792ea', '#89ddff', '#d0d0d0',
    '#434758', '#ff8b92', '#ddffa7', '#ffe585',
    '#9cc4ff', '#e1acff', '#a3f7ff', '#ffffff',
  ],
};

export const nightOwl: TerminalTheme = {
  id: 'night-owl',
  name: 'Night Owl',
  category: 'Popular',
  dark: true,
  background: '#011627',
  foreground: '#d6deeb',
  cursor:     '#80a4c2',
  selection:  '#1d3b53',
  ansi: [
    '#1d3b53', '#fc514e', '#a1cd5e', '#e3d18a',
    '#82aaff', '#c792ea', '#7fdbca', '#d6deeb',
    '#7c8f8f', '#ff5874', '#21c7a8', '#ecc48d',
    '#82aaff', '#ae81ff', '#7fdbca', '#ffffff',
  ],
};

export const oceanicNext: TerminalTheme = {
  id: 'oceanic-next',
  name: 'Oceanic Next',
  category: 'ACE / Popular',
  dark: true,
  background: '#1b2b34',
  foreground: '#cdd3de',
  cursor:     '#c0c5ce',
  selection:  '#4f5b66',
  ansi: [
    '#29414f', '#ec5f67', '#99c794', '#fac863',
    '#6699cc', '#c594c5', '#5fb3b3', '#a7adba',
    '#405860', '#ec5f67', '#99c794', '#fac863',
    '#6699cc', '#c594c5', '#5fb3b3', '#d8dee9',
  ],
};

export const cobalt2: TerminalTheme = {
  id: 'cobalt2',
  name: 'Cobalt2',
  category: 'ACE / Popular',
  dark: true,
  background: '#193549',
  foreground: '#ffffff',
  cursor:     '#f0cc09',
  selection:  '#0050a4',
  ansi: [
    '#000000', '#ff3b2c', '#2dcd73', '#e6d85c',
    '#0271bb', '#ff2c86', '#149eff', '#c7c7c7',
    '#546576', '#ff4d3d', '#3de37b', '#e9e177',
    '#2aaae8', '#ff4da8', '#49baff', '#ffffff',
  ],
};

export const atomOneLight: TerminalTheme = {
  id: 'atom-one-light',
  name: 'Atom One Light',
  category: 'ACE / Popular',
  dark: false,
  background: '#fafafa',
  foreground: '#383a42',
  cursor:     '#383a42',
  selection:  '#e5e5e6',
  ansi: [
    '#696c77', '#e45649', '#50a14f', '#c18401',
    '#4078f2', '#a626a4', '#0184bc', '#a0a1a7',
    '#383a42', '#e45649', '#50a14f', '#c18401',
    '#4078f2', '#a626a4', '#0184bc', '#e5e5e6',
  ],
};

export const cobaltAce: TerminalTheme = {
  id: 'cobalt-ace',
  name: 'Cobalt',
  category: 'ACE / Popular',
  dark: true,
  background: '#002240',
  foreground: '#ffffff',
  cursor:     '#ff9900',
  selection:  '#024d8f',
  ansi: [
    '#000000', '#ff2222', '#00d900', '#d9d900',
    '#1f7eff', '#ff00ff', '#00d9d9', '#cccccc',
    '#555555', '#ff6666', '#66ff66', '#ffff66',
    '#66a3ff', '#ff66ff', '#66ffff', '#ffffff',
  ],
};

export const githubDark: TerminalTheme = {
  id: 'github-dark',
  name: 'GitHub Dark',
  category: 'Popular',
  dark: true,
  background: '#0d1117',
  foreground: '#e6edf3',
  cursor:     '#e6edf3',
  selection:  '#264f78',
  ansi: [
    '#484f58', '#ff7b72', '#3fb950', '#d29922',
    '#58a6ff', '#bc8cff', '#39c5cf', '#b1bac4',
    '#6e7681', '#ffa198', '#56d364', '#e3b341',
    '#79c0ff', '#d2a8ff', '#56d4dd', '#f0f6fc',
  ],
};

export const rosePine: TerminalTheme = {
  id: 'rose-pine',
  name: 'Rosé Pine',
  category: 'Popular',
  dark: true,
  background: '#191724',
  foreground: '#e0def4',
  cursor:     '#e0def4',
  selection:  '#2a2837',
  ansi: [
    '#26233a', '#eb6f92', '#31748f', '#f6c177',
    '#9ccfd8', '#c4a7e7', '#ebbcba', '#e0def4',
    '#6e6a86', '#eb6f92', '#31748f', '#f6c177',
    '#9ccfd8', '#c4a7e7', '#ebbcba', '#e0def4',
  ],
};

export const merbivore: TerminalTheme = {
  id: 'merbivore',
  name: 'Merbivore',
  category: 'ACE / Popular',
  dark: true,
  background: '#161616',
  foreground: '#e6d354',
  cursor:     '#e6d354',
  selection:  '#3c3c3c',
  ansi: [
    '#2c0922', '#ff0080', '#00ff00', '#c8a020',
    '#0020c0', '#8000c0', '#0080c0', '#e6d354',
    '#666666', '#ff5500', '#80ff80', '#ffe540',
    '#6699ff', '#cc66ff', '#66ccff', '#ffffff',
  ],
};

export const ALL_THEMES: readonly TerminalTheme[] = [
  tokyoNight,
  tokyoNightStorm,
  catppuccinMocha,
  catppuccinMacchiato,
  catppuccinFrappe,
  catppuccinLatte,
  dracula,
  oneDarkPro,
  nightOwl,
  nord,
  rosePine,
  githubDark,
  gruvboxDark,
  gruvboxLight,
  solarizedDark,
  solarizedLight,
  tomorrowNight,
  tomorrowNightBlue,
  tomorrowNightEighties,
  ayuDark,
  ayuMirage,
  vscodeDark,
  vscodeLight,
  materialDark,
  materialOcean,
  materialPalenight,
  monokai,
  oceanicNext,
  cobalt2,
  cobaltAce,
  merbivore,
  atomOneLight,
];

export function getThemeById(id: string): TerminalTheme {
  return ALL_THEMES.find((t) => t.id === id) ?? tokyoNight;
}

export function getCategories(): string[] {
  const seen = new Set<string>();
  const cats: string[] = [];
  for (const t of ALL_THEMES) {
    if (!seen.has(t.category)) {
      seen.add(t.category);
      cats.push(t.category);
    }
  }
  return cats;
}

export function getThemesByCategory(category: string): TerminalTheme[] {
  return ALL_THEMES.filter((t) => t.category === category);
}
