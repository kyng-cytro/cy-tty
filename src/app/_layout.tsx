/**
 * Root layout — replaces Expo template boilerplate.
 *
 * Provider order (outermost → innermost):
 *   GestureHandlerRootView  ← required by @gorhom/bottom-sheet
 *   SessionManagerProvider  ← keeps SSH alive across navigation
 *   TerminalPreferencesProvider ← theme + font + font-size prefs
 *   PaperProvider           ← MD3 Material You theme
 *     Stack
 *
 * Note: we do NOT merge Paper + react-navigation themes — expo-router manages
 * NavigationContainer internally, so we only configure Stack screenOptions for
 * background colour and feed the pure Paper theme to PaperProvider.
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, useColorScheme } from 'react-native';
import { useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { SessionManagerProvider } from '@/core/sessions/session-manager';
import { TerminalPreferencesProvider } from '@/core/theme/preferences-context';

// ── Component ──────────────────────────────────────────────────────────────

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // On Android 12+ this reads the system wallpaper seed colour; on iOS / older
  // Android it generates a scheme from the Tokyo Night blue fallback.
  const { theme: m3Theme } = useMaterial3Theme({ fallbackSourceColor: '#7aa2f7' });

  const theme = useMemo(
    () =>
      colorScheme === 'dark'
        ? { ...MD3DarkTheme, colors: m3Theme.dark }
        : { ...MD3LightTheme, colors: m3Theme.light },
    [colorScheme, m3Theme],
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <SessionManagerProvider>
        <TerminalPreferencesProvider>
          <PaperProvider theme={theme}>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: theme.colors.background },
                headerStyle: { backgroundColor: theme.colors.surface },
                headerTintColor: theme.colors.onSurface,
              }}
            >
              {/* Tab group — visible in Connect / Sessions / Settings */}
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              {/* Terminal screen — full-screen, slides up over the tab bar */}
              <Stack.Screen
                name="terminal/[id]"
                options={{ headerShown: false, animation: 'slide_from_bottom' }}
              />
            </Stack>
          </PaperProvider>
        </TerminalPreferencesProvider>
      </SessionManagerProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
