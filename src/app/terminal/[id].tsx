import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
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

// Ctrl: a-z → \x01-\x1a; a handful of punctuation; arrow/tab escape sequences.
// Alt: prepend ESC to any single char or remap arrow sequences.
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

function StatusOverlay() {
  const theme = useTheme();
  const { status, error, disconnect } = useTerminalSessionContext();

  if (status === "connected") return null;

  const handleBack = () => {
    disconnect();
    router.back();
  };

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
          <Button
            mode="outlined"
            onPress={handleBack}
            style={styles.overlayBtn}
          >
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
          <Button
            mode="outlined"
            onPress={handleBack}
            style={styles.overlayBtn}
          >
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
          <Button
            mode="outlined"
            onPress={handleBack}
            style={styles.overlayBtn}
          >
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

const SENTINEL = "​"; // zero-width space — never sent to SSH

export default function TerminalScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { get } = useSessionManager();
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

  // Single write entry-point: applies the active modifier then clears it.
  // Both toolbar key presses and soft-keyboard chars funnel through here.
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

  const textInputRef = useRef<TextInput>(null);
  const isInputFocusedRef = useRef(false);
  const prevTextRef = useRef(SENTINEL);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only blur→focus when already focused (keyboard was manually dismissed).
  // Plain focus() suffices otherwise and avoids the keyboardDidHide flicker.
  const showKeyboard = useCallback(() => {
    if (isInputFocusedRef.current) {
      textInputRef.current?.blur();
      requestAnimationFrame(() => textInputRef.current?.focus());
    } else {
      textInputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      textInputRef.current?.focus();
      textInputRef.current?.setNativeProps({ text: SENTINEL });
      prevTextRef.current = SENTINEL;
    }, 350);
    return () => clearTimeout(t);
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

  const showHeader = useCallback(() => {
    headerOpacity.value = withTiming(1, { duration: 150 });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      headerOpacity.value = withTiming(0, { duration: 600 });
    }, 3000);
  }, [headerOpacity]);

  useEffect(() => {
    showHeader();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [showHeader]);

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

  const label = session.profile.username
    ? `${session.profile.username}@${session.profile.host}`
    : session.profile.host;

  const sessionCtx = useMemo<TerminalSessionContextValue>(
    () => ({
      write,
      disconnect: session.disconnect,
      status: session.status,
      error: session.error,
      cols: session.cols,
      rows: session.rows,
      showKeyboard,
      modifier,
      toggleModifier,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      write,
      session.disconnect,
      session.status,
      session.error,
      session.cols,
      session.rows,
      showKeyboard,
      modifier,
      toggleModifier,
    ],
  );

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
                showHeader();
                showKeyboard();
              }}
            >
              <TerminalCanvas
                state={session.terminalState}
                onCellSize={session.resize}
                style={styles.flex}
              />
            </Pressable>
          </GestureDetector>

          {/*
           * Diff-based input: prevTextRef mirrors the native buffer.
           * onChangeText sends only the delta — no reset during typing, no race.
           * Idle timer fires after 800 ms of inactivity and safely resets the
           * buffer at a point when no keystrokes can be in-flight.
           */}
          <TextInput
            ref={textInputRef}
            style={styles.hiddenInput}
            multiline={false}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete="off"
            blurOnSubmit={false}
            defaultValue={SENTINEL}
            onFocus={() => {
              isInputFocusedRef.current = true;
            }}
            onBlur={() => {
              isInputFocusedRef.current = false;
            }}
            onChangeText={(text) => {
              const prev = prevTextRef.current;

              if (text.length > prev.length) {
                const added = text.slice(prev.length).replace(/​/g, "");
                if (added === "\n" || added === "\r\n") writeRef.current("\r");
                else if (added) writeRef.current(added);
              } else if (text.length < prev.length) {
                for (let i = 0; i < prev.length - text.length; i++)
                  writeRef.current("\x7f");
              }

              prevTextRef.current = text;

              // Idle reset: safe because 800 ms of silence means no in-flight keystrokes.
              if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
              idleTimerRef.current = setTimeout(() => {
                textInputRef.current?.setNativeProps({ text: SENTINEL });
                prevTextRef.current = SENTINEL;
              }, 800);
            }}
            onSubmitEditing={() => writeRef.current("\r")}
          />

          <TerminalKeyboard />
          <StatusOverlay />
          <FloatingHeader label={label} opacity={headerOpacity} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TerminalSessionContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    bottom: 44,
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
