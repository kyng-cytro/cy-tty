/**
 * TerminalPreferencesContext
 *
 * Provides terminal display preferences (colour theme, font, font size) to the
 * entire app.  Preferences are persisted to AsyncStorage so they survive app
 * restarts.
 *
 * Usage:
 *   const { theme, resolvedTheme, fontId, fontSize, setTheme, setFont, setFontSize } =
 *     useTerminalPreferences();
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { ALL_THEMES, getThemeById } from './color-themes';
import type { TerminalTheme, ResolvedTheme } from './types';
import { resolveTheme } from './types';
import { TERMINAL_FONTS, getFontById, type TerminalFont } from './fonts';

// ── Storage keys ─────────────────────────────────────────────────────────────

const KEY_THEME_ID  = 'cy_tty_theme_id';
const KEY_FONT_ID   = 'cy_tty_font_id';
const KEY_FONT_SIZE = 'cy_tty_font_size';

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_THEME_ID  = 'tokyo-night';
const DEFAULT_FONT_ID   = 'jetbrains-mono';
const DEFAULT_FONT_SIZE = 13;

// ── Context value ─────────────────────────────────────────────────────────────

export interface TerminalPreferencesContextValue {
  /** Full theme definition (for Settings UI). */
  theme: TerminalTheme;
  /** Pre-resolved colours as packed integers (for renderer). */
  resolvedTheme: ResolvedTheme;
  /** All available themes. */
  allThemes: readonly TerminalTheme[];

  /** Active font definition. */
  font: TerminalFont;
  /** All available fonts. */
  allFonts: readonly TerminalFont[];

  /** Active font size in points. */
  fontSize: number;

  setTheme: (themeId: string) => void;
  setFont:  (fontId: string)  => void;
  setFontSize: (size: number) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const TerminalPreferencesContext = createContext<TerminalPreferencesContextValue | null>(null);

export function useTerminalPreferences(): TerminalPreferencesContextValue {
  const ctx = useContext(TerminalPreferencesContext);
  if (!ctx) throw new Error('useTerminalPreferences must be inside <TerminalPreferencesProvider>');
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function TerminalPreferencesProvider({ children }: { children: ReactNode }) {
  const [themeId,  setThemeIdState]  = useState(DEFAULT_THEME_ID);
  const [fontId,   setFontIdState]   = useState(DEFAULT_FONT_ID);
  const [fontSize, setFontSizeState] = useState(DEFAULT_FONT_SIZE);
  const [loaded,   setLoaded]        = useState(false);

  // ── Load saved prefs ────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const values = await AsyncStorage.getMany([
          KEY_THEME_ID, KEY_FONT_ID, KEY_FONT_SIZE,
        ]);
        const tid = values[KEY_THEME_ID];
        const fid = values[KEY_FONT_ID];
        const fsz = values[KEY_FONT_SIZE];
        if (tid) setThemeIdState(tid);
        if (fid) setFontIdState(fid);
        if (fsz) setFontSizeState(Number(fsz));
      } catch {
        // Use defaults on read error
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // ── Setters with persistence ────────────────────────────────────────────
  const setTheme = useCallback((id: string) => {
    setThemeIdState(id);
    void AsyncStorage.setItem(KEY_THEME_ID, id);
  }, []);

  const setFont = useCallback((id: string) => {
    setFontIdState(id);
    void AsyncStorage.setItem(KEY_FONT_ID, id);
  }, []);

  const setFontSize = useCallback((size: number) => {
    setFontSizeState(size);
    void AsyncStorage.setItem(KEY_FONT_SIZE, String(size));
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────
  const theme         = useMemo(() => getThemeById(themeId),  [themeId]);
  const resolvedTheme = useMemo(() => resolveTheme(theme),    [theme]);
  const font          = useMemo(() => getFontById(fontId),    [fontId]);

  const value = useMemo<TerminalPreferencesContextValue>(
    () => ({
      theme,
      resolvedTheme,
      allThemes: ALL_THEMES,
      font,
      allFonts: TERMINAL_FONTS,
      fontSize,
      setTheme,
      setFont,
      setFontSize,
    }),
    [theme, resolvedTheme, font, fontSize, setTheme, setFont, setFontSize],
  );

  // Don't render children until prefs are loaded (avoids flash of wrong theme)
  if (!loaded) return null;

  return (
    <TerminalPreferencesContext.Provider value={value}>
      {children}
    </TerminalPreferencesContext.Provider>
  );
}
