import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
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

// ── Status overlay ─────────────────────────────────────────────────────────

function StatusOverlay() {
  const theme = useTheme();
  const { status, error, disconnect } = useTerminalSessionContext();

  if (status === "connected") return null;

  const handleBack = () => {
    disconnect();
    router.back();
  };

  return (
    <View style={[styles.overlay, { backgroundColor: theme.colors.surface + "ee" }]}>
      {status === "connecting" && (
        <>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text variant="bodyLarge" style={[styles.overlayText, { color: theme.colors.onSurface }]}>
            Connecting…
          </Text>
          <Button mode="outlined" onPress={handleBack} style={styles.overlayBtn}>
            Cancel
          </Button>
        </>
      )}

      {(status === "idle" || status === "error") && (
        <>
          <MaterialCommunityIcons name="alert-circle-outline" size={52} color={theme.colors.error} />
          <Text variant="titleMedium" style={{ color: theme.colors.error, marginTop: 8 }}>
            Connection failed
          </Text>
          <Text variant="bodyMedium" style={[styles.overlayText, { color: theme.colors.onSurfaceVariant }]}>
            {error ?? "An unknown error occurred"}
          </Text>
          <Button mode="outlined" onPress={handleBack} style={styles.overlayBtn}>
            Back
          </Button>
        </>
      )}

      {status === "disconnected" && (
        <>
          <MaterialCommunityIcons name="lan-disconnect" size={52} color={theme.colors.onSurfaceVariant} />
          <Text variant="titleMedium" style={[styles.overlayText, { color: theme.colors.onSurface }]}>
            Session ended
          </Text>
          <Button mode="outlined" onPress={handleBack} style={styles.overlayBtn}>
            Back
          </Button>
        </>
      )}
    </View>
  );
}

// ── Floating header ─────────────────────────────────────────────────────────

interface FloatingHeaderProps {
  label: string;
  opacity: SharedValue<number>;
}

function FloatingHeader({ label, opacity }: FloatingHeaderProps) {
  const theme = useTheme();
  const { status, disconnect } = useTerminalSessionContext();

  const handleMinimize   = useCallback(() => router.back(), []);
  const handleDisconnect = useCallback(() => { disconnect(); router.back(); }, [disconnect]);

  if (status !== "connected") return null;

  return (
    <Animated.View
      style={[styles.floatingHeader, { backgroundColor: theme.colors.surface + "dd" }, { opacity }]}
      pointerEvents="box-none"
    >
      <IconButton
        icon="arrow-left"
        size={20}
        iconColor={theme.colors.onSurface}
        onPress={handleMinimize}
        accessibilityLabel="Minimize — return to tabs without disconnecting"
        style={styles.headerBtn}
      />
      <Text variant="labelMedium" numberOfLines={1} style={[styles.headerLabel, { color: theme.colors.onSurface }]}>
        {label}
      </Text>
      <IconButton
        icon="close"
        size={20}
        iconColor={theme.colors.error}
        onPress={handleDisconnect}
        accessibilityLabel="Disconnect and close"
        style={styles.headerBtn}
      />
    </Animated.View>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────

const SENTINEL = "​"; // zero-width space — never sent to SSH

export default function TerminalScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { get } = useSessionManager();
  const { setFontSize, fontSize, resolvedTheme } = useTerminalPreferences();

  const session = get(id ?? "");

  // ── Keyboard input ─────────────────────────────────────────────────────

  const textInputRef      = useRef<TextInput>(null);
  const isInputFocusedRef = useRef(false);
  // Tracks the actual native text so we can diff on each onChangeText.
  // No async setNativeProps reset needed during typing → no accumulation race.
  const prevTextRef       = useRef(SENTINEL);

  // Only blur→focus when the input is already focused (keyboard was manually
  // dismissed). Otherwise a plain focus() is enough and avoids the flicker
  // that keyboardDidHide fires during an unnecessary blur.
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

  // ── Pinch-to-resize ────────────────────────────────────────────────────

  const pinchStartSize = useRef(fontSize);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => { pinchStartSize.current = fontSize; })
    .onUpdate((e) => {
      const next = Math.round(Math.max(9, Math.min(24, pinchStartSize.current * e.scale)));
      runOnJS(setFontSize)(next);
    });

  // ── Auto-hide floating header ──────────────────────────────────────────

  const headerOpacity = useSharedValue(1);
  const hideTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showHeader = useCallback(() => {
    headerOpacity.value = withTiming(1, { duration: 150 });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      headerOpacity.value = withTiming(0, { duration: 600 });
    }, 3000);
  }, [headerOpacity]);

  useEffect(() => {
    showHeader();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [showHeader]);

  // ── Session guard ──────────────────────────────────────────────────────

  if (!session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.error, margin: 24 }}>Session not found.</Text>
        <Button onPress={() => router.back()}>Go back</Button>
      </SafeAreaView>
    );
  }

  const label = session.profile.username
    ? `${session.profile.username}@${session.profile.host}`
    : session.profile.host;

  const sessionCtx = useMemo<TerminalSessionContextValue>(
    () => ({
      write: session.write,
      disconnect: session.disconnect,
      status: session.status,
      error: session.error,
      cols: session.cols,
      rows: session.rows,
      showKeyboard,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.write, session.disconnect, session.status, session.error, session.cols, session.rows, showKeyboard],
  );

  return (
    <TerminalSessionContext.Provider value={sessionCtx}>
      <SafeAreaView
        edges={["top", "left", "right", "bottom"]}
        style={[styles.container, { backgroundColor: resolvedTheme.backgroundHex }]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <GestureDetector gesture={pinchGesture}>
            <Pressable style={styles.flex} onPress={() => { showHeader(); showKeyboard(); }}>
              <TerminalCanvas state={session.terminalState} onCellSize={session.resize} style={styles.flex} />
            </Pressable>
          </GestureDetector>

          {/* Diff-based input receiver — always holds SENTINEL as a baseline.
              onChangeText compares against prevTextRef to find exactly what
              changed. No reset on every keystroke → no accumulation race.
              Buffer is trimmed back to SENTINEL once it grows past 20 chars. */}
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
            onFocus={() => { isInputFocusedRef.current = true; }}
            onBlur={()  => { isInputFocusedRef.current = false; }}
            onChangeText={(text) => {
              const prev = prevTextRef.current;

              if (text.length > prev.length) {
                const added = text.slice(prev.length).replace(/​/g, "");
                if (added === "\n" || added === "\r\n") session.write("\r");
                else if (added) session.write(added);
              } else if (text.length < prev.length) {
                const deleted = prev.length - text.length;
                for (let i = 0; i < deleted; i++) session.write("\x7f");
              }

              prevTextRef.current = text;

              if (text.length > 20) {
                textInputRef.current?.setNativeProps({ text: SENTINEL });
                prevTextRef.current = SENTINEL;
              }
            }}
            onSubmitEditing={() => session.write("\r")}
          />

          <TerminalKeyboard />
          <StatusOverlay />
          <FloatingHeader label={label} opacity={headerOpacity} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TerminalSessionContext.Provider>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

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
  overlayText: {
    textAlign: "center",
    marginTop: 4,
  },
  overlayBtn: {
    marginTop: 12,
    minWidth: 110,
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
  headerLabel: {
    flex: 1,
    textAlign: "center",
  },
});
