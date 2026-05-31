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
import { Button, IconButton, Text, useTheme } from "react-native-paper";
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

function applyModifier(data: string, mod: "ctrl" | "alt" | "shift"): string {
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
  } else if (mod === "alt") {
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
  } else {
    switch (data) {
      case "\x1b[D":
        return "\x1b[1;2D";
      case "\x1b[C":
        return "\x1b[1;2C";
      case "\x1b[A":
        return "\x1b[1;2A";
      case "\x1b[B":
        return "\x1b[1;2B";
      case "\t":
        return "\x1b[Z";
    }
    if (data.length === 1) return data.toUpperCase();
  }
  return data;
}

function StatusScreen({
  onExit,
  label,
}: {
  onExit: () => void;
  label: string;
}) {
  const theme = useTheme();
  const { status, error, pendingAuthUrl, approveAuth, denyAuth } =
    useTerminalSessionContext();

  const domain =
    pendingAuthUrl?.match(/https?:\/\/([^/]+)/)?.[1] ?? pendingAuthUrl;

  return (
    <View style={styles.statusScreen}>
      {status === "connecting" && pendingAuthUrl && (
        <>
          <MaterialCommunityIcons
            name="shield-lock-outline"
            size={48}
            color={theme.colors.primary}
          />
          <Text
            variant="titleLarge"
            style={[styles.statusTitle, { color: theme.colors.onSurface }]}
          >
            Authentication Required
          </Text>
          <Text
            variant="bodyMedium"
            style={[
              styles.statusMessage,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            This server wants to open a link in your browser to complete sign-in
          </Text>
          {!!domain && (
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.primary, marginTop: 4 }}
            >
              {domain}
            </Text>
          )}
          <View style={styles.statusActions}>
            <Button mode="outlined" onPress={denyAuth}>
              Deny
            </Button>
            <Button mode="contained" onPress={approveAuth}>
              Open in Browser
            </Button>
          </View>
        </>
      )}

      {status === "connecting" && !pendingAuthUrl && (
        <>
          <MaterialCommunityIcons
            name="console-network-outline"
            size={48}
            color={theme.colors.primary}
          />
          <Text
            variant="titleMedium"
            style={[styles.statusTitle, { color: theme.colors.onSurface }]}
          >
            Connecting
          </Text>
          {!!label && (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {label}
            </Text>
          )}
          <Button mode="text" onPress={onExit} style={styles.statusBtn}>
            Cancel
          </Button>
        </>
      )}

      {(status === "idle" || status === "error") && (
        <>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={48}
            color={theme.colors.error}
          />
          <Text
            variant="titleMedium"
            style={[styles.statusTitle, { color: theme.colors.onSurface }]}
          >
            Connection Failed
          </Text>
          {!!label && (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {label}
            </Text>
          )}
          <Text
            variant="bodyMedium"
            style={[
              styles.statusMessage,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {error ?? "An unknown error occurred"}
          </Text>
          <Button mode="text" onPress={onExit} style={styles.statusBtn}>
            Back
          </Button>
        </>
      )}

      {status === "disconnected" && (
        <>
          <MaterialCommunityIcons
            name="lan-disconnect"
            size={48}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            variant="titleMedium"
            style={[styles.statusTitle, { color: theme.colors.onSurface }]}
          >
            Session Ended
          </Text>
          {!!label && (
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {label}
            </Text>
          )}
          <Button mode="text" onPress={onExit} style={styles.statusBtn}>
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

  const [scrollOffset, setScrollOffset] = useState(0);
  const scrollOffsetRef = useRef(0);
  const scrollDrag = useSharedValue(0);

  const [modifier, setModifier] = useState<"ctrl" | "alt" | "shift" | null>(
    null,
  );
  const modifierRef = useRef<"ctrl" | "alt" | "shift" | null>(null);
  modifierRef.current = modifier;

  const toggleModifier = useCallback((mod: "ctrl" | "alt" | "shift") => {
    setModifier((prev) => {
      const next = prev === mod ? null : mod;
      modifierRef.current = next;
      return next;
    });
  }, []);

  const write = useCallback(
    (data: string) => {
      if (scrollOffsetRef.current !== 0) {
        scrollOffsetRef.current = 0;
        setScrollOffset(0);
      }
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

  const pinchStartSize = useSharedValue(fontSize);

  const pinchGesture = Gesture.Pinch()
    .enabled(session?.status === "connected")
    .onStart(() => {
      pinchStartSize.value = fontSize;
    })
    .onUpdate((e) => {
      const next = Math.round(
        Math.max(9, Math.min(24, pinchStartSize.value * e.scale)),
      );
      runOnJS(setFontSize)(next);
    });

  const cellHeight = useSharedValue(fontSize + 4);

  const updateScrollOffset = useCallback(
    (delta: number) => {
      if (!session) return;
      const scrollbackLen = session.terminalState.scrollback.length;
      const next = Math.max(
        0,
        Math.min(scrollbackLen, scrollOffsetRef.current + delta),
      );
      if (next !== scrollOffsetRef.current) {
        scrollOffsetRef.current = next;
        setScrollOffset(next);
      }
    },
    [session],
  );

  const panGesture = Gesture.Pan()
    .enabled(session?.status === "connected")
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      scrollDrag.value = 0;
    })
    .onUpdate((e) => {
      const rowDelta = Math.trunc(
        (e.translationY - scrollDrag.value) / cellHeight.value,
      );
      if (rowDelta !== 0) {
        scrollDrag.value = scrollDrag.value + rowDelta * cellHeight.value;
        runOnJS(updateScrollOffset)(rowDelta);
      }
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
      pendingAuthUrl: session?.pendingAuthUrl ?? null,
      approveAuth: session?.approveAuth ?? (() => {}),
      denyAuth: session?.denyAuth ?? (() => {}),
    }),
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
      session?.pendingAuthUrl,
      session?.approveAuth,
      session?.denyAuth,
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
        {session.status !== "connected" ? (
          <StatusScreen onExit={handleExit} label={label} />
        ) : (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <GestureDetector
              gesture={Gesture.Simultaneous(pinchGesture, panGesture)}
            >
              <Pressable
                style={styles.flex}
                onPress={() => {
                  toggleHeader();
                  showKeyboard();
                }}
              >
                <TerminalCanvas
                  state={session.terminalState}
                  scrollOffset={scrollOffset}
                  onCellSize={(cw, ch) => {
                    cellHeight.value = ch;
                    session.resize(cw, ch);
                  }}
                  style={[styles.flex, styles.canvasPadding]}
                />
              </Pressable>
            </GestureDetector>

            <TerminalKeyboardView
              focused={keyboardFocused}
              onInput={(data) => writeRef.current(data)}
            />

            <TerminalKeyboard />
            <FloatingHeader label={label} opacity={headerOpacity} />
          </KeyboardAvoidingView>
        )}
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
  statusScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  statusTitle: {
    textAlign: "center",
    marginTop: 8,
  },
  statusMessage: {
    textAlign: "center",
  },
  statusBtn: { marginTop: 8 },
  statusActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
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
