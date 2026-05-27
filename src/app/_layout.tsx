import { SessionManagerProvider } from "@/core/sessions/session-manager";
import { SshUrlSettingsProvider } from "@/core/security/ssh-url-settings-context";
import { TerminalPreferencesProvider } from "@/core/theme/preferences-context";
import { useMaterial3Theme } from "@pchmn/expo-material3-theme";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { theme: m3Theme } = useMaterial3Theme({
    fallbackSourceColor: "#7aa2f7",
  });

  const theme = useMemo(
    () =>
      colorScheme === "dark"
        ? { ...MD3DarkTheme, colors: m3Theme.dark }
        : { ...MD3LightTheme, colors: m3Theme.light },
    [colorScheme, m3Theme],
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <SshUrlSettingsProvider>
      <SessionManagerProvider>
        <TerminalPreferencesProvider>
          <PaperProvider theme={theme}>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: theme.colors.background },
                headerStyle: { backgroundColor: theme.colors.surface },
                headerTintColor: theme.colors.onSurface,
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="terminal/[id]"
                options={{ headerShown: false, animation: "slide_from_bottom" }}
              />
            </Stack>
          </PaperProvider>
        </TerminalPreferencesProvider>
      </SessionManagerProvider>
      </SshUrlSettingsProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
