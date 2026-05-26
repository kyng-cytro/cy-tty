import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { TerminalKeyboardView } from "expo-terminal-keyboard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  ActivityIndicator,
  Button,
  IconButton,
  Text,
  useTheme,
} from "react-native-paper";
import Animated, {
  runOnJS,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { TerminalCanvas } from "@/components/terminal/terminal-canvas";
import { TerminalKeyboard } from "@/components/terminal/terminal-keyboard";
import {
  TerminalSessionContext,
  useTerminalSessionContext,
  type TerminalSessionContextValue,
} from "@/components/terminal/terminal-session";
import { useSessionManager } from "@/core/sessions/session-manager";
import { useTerminalPreferences } from "@/core/theme/preferences-context";
import {
  CONTENT_PADDING_H,
  CONTENT_PADDING_TOP,
} from "@/hooks/use-terminal-size";

function applyModifier(data: string, mod: "ctrl" | "alt"): string {
  if (mod === "ctrl") {
    if (data.length === 1) {
      const c = data.toLowerCase().charCodeAt(0);
      if (c >= 97 && c <= 122) return String.fromCharCode(c - 96);
      if (data === "[") return "\x1b";
      if (data === "\\") return "\x1c";
      if (data === "]") return "\x1d";
      if (data === " ") return "\x00";
    }
    switch (data) {
      case "\x1b[D":
        return "\x1b[1;5D";
      case "\x1b[C":
        return "\x1b[1;5C";
      case "\x1b[A":
        return "\x1b[1;5A";
      case "\x1b[B":
        return "\x1b[1;5B";
      case "\t":
        return "\x1b[27;5;9~";
    }
  } else {
    if (data.length === 1) return "\x1b" + data;
    switch (data) {
      case "\x1b[D":
        return "\x1b[1;3D";
      case "\x1b[C":
        return "\x1b[1;3C";
      case "\x1b[A":
        return "\x1b[1;3A";
      case "\x1b[B":
        return "\x1b[1;3B";
      case "\t":
        return "\x1b[27;3;9~";
    }
  }
  return data;
}

function StatusOverlay({ onExit }: { onExit: () => void }) {
  const theme = useTheme();
  const { status, error } = useTerminalSessionContext();

  if (status === "connected") return null;

  return (
    <View
      style={[styles.overlay, { backgroundColor: theme.colors.surface + "ee" }]}
    >
      {status === "connecting" && (
        <>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text
            variant="bodyLarge"
            style={[styles.overlayText, { color: theme.colors.onSurface }]}
          >
            Connecting…
          </Text>
          <Button mode="outlined" onPress={onExit} style={styles.overlayBtn}>
            Cancel
          </Button>
        </>
      )}

      {(status === "idle" || status === "error") && (
        <>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={52}
            color={theme.colors.error}
          />
          <Text
            variant="titleMedium"
            style={{ color: theme.colors.error, marginTop: 8 }}
          >
            Connection failed
          </Text>
          <Text
            variant="bodyMedium"
            style={[
              styles.overlayText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {error ?? "An unknown error occurred"}
          </Text>
          <Button mode="outlined" onPress={onExit} style={styles.overlayBtn}>
            Back
          </Button>
        </>
      )}

      {status === "disconnected" && (
        <>
          <MaterialCommunityIcons
            name="lan-disconnect"
            size={52}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            variant="titleMedium"
            style={[styles.overlayText, { color: theme.colors.onSurface }]}
          >
            Session ended
          </Text>
          <Button mode="outlined" onPress={onExit} style={styles.overlayBtn}>
            Back
          </Button>
        </>
      )}
    </View>
  );
}

interface FloatingHeaderProps {
  label: string;
  opacity: SharedValue<number>;
}

function FloatingHeader({ label, opacity }: FloatingHeaderProps) {
  const theme = useTheme();
  const { status, disconnect } = useTerminalSessionContext();

  const handleMinimize = useCallback(() => router.back(), []);
  const handleDisconnect = useCallback(() => {
    disconnect();
    router.back();
  }, [disconnect]);

  if (status !== "connected") return null;

  return (
    <Animated.View
      style={[
        styles.floatingHeader,
        { backgroundColor: theme.colors.surface + "dd" },
        { opacity },
      ]}
      pointerEvents="box-none"
    >
      <IconButton
        icon="arrow-left"
        size={20}
        iconColor={theme.colors.onSurface}
        onPress={handleMinimize}
        accessibilityLabel="Minimize"
        style={styles.headerBtn}
      />
      <Text
        variant="labelMedium"
        numberOfLines={1}
        style={[styles.headerLabel, { color: theme.colors.onSurface }]}
      >
        {label}
      </Text>
      <IconButton
        icon="close"
        size={20}
        iconColor={theme.colors.error}
        onPress={handleDisconnect}
        accessibilityLabel="Disconnect"
        style={styles.headerBtn}
      />
    </Animated.View>
  );
}

export default function TerminalScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { get, destroy } = useSessionManager();
  const { setFontSize, fontSize, resolvedTheme } = useTerminalPreferences();

  const session = get(id ?? "");

  const [modifier, setModifier] = useState<"ctrl" | "alt" | null>(null);
  const modifierRef = useRef<"ctrl" | "alt" | null>(null);
  modifierRef.current = modifier;

  const toggleModifier = useCallback((mod: "ctrl" | "alt") => {
    setModifier((prev) => {
      const next = prev === mod ? null : mod;
      modifierRef.current = next;
      return next;
    });
  }, []);

  const write = useCallback(
    (data: string) => {
      const mod = modifierRef.current;
      if (mod) {
        modifierRef.current = null;
        setModifier(null);
        session?.write(applyModifier(data, mod));
      } else {
        session?.write(data);
      }
    },
    [session],
  );

  const writeRef = useRef(write);
  writeRef.current = write;

  const [keyboardFocused, setKeyboardFocused] = useState(false);

  const showKeyboard = useCallback(() => setKeyboardFocused(true), []);
  const hideKeyboard = useCallback(() => setKeyboardFocused(false), []);

  const handleExit = useCallback(() => {
    destroy(id ?? "");
    router.back();
  }, [destroy, id]);

  useEffect(() => {
    const t = setTimeout(() => setKeyboardFocused(true), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardFocused(false),
    );
    return () => sub.remove();
  }, []);

  const pinchStartSize = useRef(fontSize);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      pinchStartSize.current = fontSize;
    })
    .onUpdate((e) => {
      const next = Math.round(
        Math.max(9, Math.min(24, pinchStartSize.current * e.scale)),
      );
      runOnJS(setFontSize)(next);
    });

  const headerOpacity = useSharedValue(1);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerShown = useRef(true);

  const showHeader = useCallback(() => {
    headerShown.current = true;
    headerOpacity.value = withTiming(1, { duration: 150 });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      headerOpacity.value = withTiming(0, { duration: 600 });
      headerShown.current = false;
    }, 3000);
  }, [headerOpacity]);

  const hideHeader = useCallback(() => {
    headerShown.current = false;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    headerOpacity.value = withTiming(0, { duration: 300 });
  }, [headerOpacity]);

  const toggleHeader = useCallback(() => {
    if (headerShown.current) hideHeader();
    else showHeader();
  }, [showHeader, hideHeader]);

  useEffect(() => {
    showHeader();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [showHeader]);

  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP,
      ).catch(() => {});
    };
  }, []);

  const label = session
    ? session.profile.username
      ? `${session.profile.username}@${session.profile.host}`
      : session.profile.host
    : "";

  const sessionCtx = useMemo<TerminalSessionContextValue>(
    () => ({
      write,
      disconnect: session?.disconnect ?? (() => {}),
      status: session?.status ?? "idle",
      error: session?.error ?? null,
      cols: session?.cols ?? 80,
      rows: session?.rows ?? 24,
      showKeyboard,
      hideKeyboard,
      modifier,
      toggleModifier,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      write,
      session?.disconnect,
      session?.status,
      session?.error,
      session?.cols,
      session?.rows,
      showKeyboard,
      hideKeyboard,
      modifier,
      toggleModifier,
    ],
  );

  if (!session) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Text style={{ color: theme.colors.error, margin: 24 }}>
          Session not found.
        </Text>
        <Button onPress={() => router.back()}>Go back</Button>
      </SafeAreaView>
    );
  }

  return (
    <TerminalSessionContext.Provider value={sessionCtx}>
      <SafeAreaView
        edges={["top", "left", "right", "bottom"]}
        style={[
          styles.container,
          { backgroundColor: resolvedTheme.backgroundHex },
        ]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <GestureDetector gesture={pinchGesture}>
            <Pressable
              style={styles.flex}
              onPress={() => {
                toggleHeader();
                showKeyboard();
              }}
            >
              <TerminalCanvas
                state={session.terminalState}
                onCellSize={session.resize}
                style={[styles.flex, styles.canvasPadding]}
              />
            </Pressable>
          </GestureDetector>

          <TerminalKeyboardView
            focused={keyboardFocused}
            onInput={(data) => writeRef.current(data)}
          />

          <TerminalKeyboard />
          <StatusOverlay onExit={handleExit} />
          <FloatingHeader label={label} opacity={headerOpacity} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TerminalSessionContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  canvasPadding: {
    paddingTop: CONTENT_PADDING_TOP,
    paddingHorizontal: CONTENT_PADDING_H,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  overlayText: { textAlign: "center", marginTop: 4 },
  overlayBtn: { marginTop: 12, minWidth: 110 },
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    paddingHorizontal: 4,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  headerBtn: { margin: 0 },
  headerLabel: { flex: 1, textAlign: "center" },
});
