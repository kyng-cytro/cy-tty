import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Clipboard from "expo-clipboard";
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

import { TerminalCanvas, type SelectionRange } from "@/components/terminal/terminal-canvas";
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
      case "\x1b[D": return "\x1b[1;5D";
      case "\x1b[C": return "\x1b[1;5C";
      case "\x1b[A": return "\x1b[1;5A";
      case "\x1b[B": return "\x1b[1;5B";
      case "\t":     return "\x1b[27;5;9~";
    }
  } else if (mod === "alt") {
    if (data.length === 1) return "\x1b" + data;
    switch (data) {
      case "\x1b[D": return "\x1b[1;3D";
      case "\x1b[C": return "\x1b[1;3C";
      case "\x1b[A": return "\x1b[1;3A";
      case "\x1b[B": return "\x1b[1;3B";
      case "\t":     return "\x1b[27;3;9~";
    }
  } else {
    // shift
    switch (data) {
      case "\x1b[D": return "\x1b[1;2D";
      case "\x1b[C": return "\x1b[1;2C";
      case "\x1b[A": return "\x1b[1;2A";
      case "\x1b[B": return "\x1b[1;2B";
      case "\t":     return "\x1b[Z";
    }
    if (data.length === 1) return data.toUpperCase();
  }
  return data;
}

function StatusOverlay({ onExit }: { onExit: () => void }) {
  const theme = useTheme();
  const { status, error, pendingAuthUrl, approveAuth, denyAuth } =
    useTerminalSessionContext();

  if (status === "connected") return null;

  return (
    <View
      style={[styles.overlay, { backgroundColor: theme.colors.surface + "ee" }]}
    >
      {status === "connecting" && pendingAuthUrl && (
        <>
          <MaterialCommunityIcons
            name="shield-link-variant-outline"
            size={52}
            color={theme.colors.primary}
          />
          <Text
            variant="titleMedium"
            style={{ color: theme.colors.onSurface, marginTop: 8 }}
          >
            Authentication Required
          </Text>
          <Text
            variant="bodyMedium"
            style={[
              styles.overlayText,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            This session wants to open a link in your browser to complete
            authentication:
          </Text>
          <Text
            variant="labelSmall"
            numberOfLines={3}
            style={[
              styles.overlayUrl,
              {
                color: theme.colors.primary,
                backgroundColor: theme.colors.surfaceVariant,
              },
            ]}
          >
            {pendingAuthUrl}
          </Text>
          <View style={styles.overlayActions}>
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

  const [scrollOffset, setScrollOffset] = useState(0);
  const scrollOffsetRef = useRef(0);
  const scrollDragRef = useRef(0);

  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const selectionAnchorRef = useRef<{ row: number; col: number } | null>(null);
  // Shared value so the pan worklet can check whether a selection is in progress
  const hasSelectionAnchor = useSharedValue(false);

  const [modifier, setModifier] = useState<"ctrl" | "alt" | "shift" | null>(null);
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
      // Snap back to live view and clear selection when user types
      if (scrollOffsetRef.current !== 0) {
        scrollOffsetRef.current = 0;
        setScrollOffset(0);
      }
      selectionAnchorRef.current = null;
      hasSelectionAnchor.value = false;
      setSelection(null);
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
    .enabled(session?.status === "connected")
    .onStart(() => {
      pinchStartSize.current = fontSize;
    })
    .onUpdate((e) => {
      const next = Math.round(
        Math.max(9, Math.min(24, pinchStartSize.current * e.scale)),
      );
      runOnJS(setFontSize)(next);
    });

  const cellHeightRef = useRef(fontSize + 4);

  const updateScrollOffset = useCallback(
    (delta: number) => {
      if (!session) return;
      const scrollbackLen = session.terminalState.scrollback.length;
      const next = Math.max(0, Math.min(scrollbackLen, scrollOffsetRef.current + delta));
      if (next !== scrollOffsetRef.current) {
        scrollOffsetRef.current = next;
        setScrollOffset(next);
      }
    },
    [session],
  );

  const cellWidthRef = useRef(fontSize * 0.6);

  const copySelection = useCallback(() => {
    if (!selection || !session) return;
    const { scrollback, grid, cols } = session.terminalState;
    const combined = [...scrollback, ...grid];
    const end = Math.max(0, combined.length - scrollOffsetRef.current);
    const start = Math.max(0, end - session.rows);
    const displayGrid = combined.slice(start, end);

    const r0 = selection.startRow;
    const c0 = selection.startCol;
    const r1 = selection.endRow;
    const c1 = selection.endCol;
    const [sr, sc, er, ec] =
      r0 < r1 || (r0 === r1 && c0 <= c1)
        ? [r0, c0, r1, c1]
        : [r1, c1, r0, c0];

    const lines: string[] = [];
    for (let r = sr; r <= er; r++) {
      const row = displayGrid[r];
      if (!row) continue;
      const startC = r === sr ? sc : 0;
      const endC = r === er ? ec + 1 : cols;
      const text = row
        .slice(startC, endC)
        .map((cell) => cell.char || " ")
        .join("")
        .trimEnd();
      lines.push(text);
    }
    Clipboard.setStringAsync(lines.join("\n")).catch(() => {});
    selectionAnchorRef.current = null;
    hasSelectionAnchor.value = false;
    setSelection(null);
  }, [selection, session, hasSelectionAnchor]);

  const sessionCols = session?.cols ?? 80;
  const sessionRows = session?.rows ?? 24;

  const startSelectionAt = useCallback(
    (x: number, y: number) => {
      const cw = cellWidthRef.current;
      const ch = cellHeightRef.current;
      if (cw === 0 || ch === 0) return;
      const col = Math.max(0, Math.min(sessionCols - 1, Math.floor(x / cw)));
      const row = Math.max(0, Math.min(sessionRows - 1, Math.floor(y / ch)));
      selectionAnchorRef.current = { row, col };
      hasSelectionAnchor.value = true;
      setSelection({ startRow: row, startCol: col, endRow: row, endCol: col });
    },
    [sessionCols, sessionRows],
  );

  const extendSelectionTo = useCallback(
    (x: number, y: number) => {
      const anchor = selectionAnchorRef.current;
      if (!anchor) return;
      const cw = cellWidthRef.current;
      const ch = cellHeightRef.current;
      if (cw === 0 || ch === 0) return;
      const col = Math.max(0, Math.min(sessionCols - 1, Math.floor(x / cw)));
      const row = Math.max(0, Math.min(sessionRows - 1, Math.floor(y / ch)));
      setSelection({
        startRow: anchor.row,
        startCol: anchor.col,
        endRow: row,
        endCol: col,
      });
    },
    [sessionCols, sessionRows],
  );

  const longPressGesture = Gesture.LongPress()
    .enabled(session?.status === "connected")
    .minDuration(400)
    .onStart((e) => {
      runOnJS(startSelectionAt)(e.x, e.y);
    });

  const panGesture = Gesture.Pan()
    .enabled(session?.status === "connected")
    .activeOffsetY([-8, 8])
    .failOffsetX([-20, 20])
    .onBegin(() => {
      scrollDragRef.current = 0;
    })
    .onUpdate((e) => {
      // If a selection anchor exists, extend selection instead of scrolling
      if (hasSelectionAnchor.value) {
        runOnJS(extendSelectionTo)(e.x, e.y);
        return;
      }
      const rowDelta = Math.trunc(
        (scrollDragRef.current - e.translationY) / cellHeightRef.current,
      );
      if (rowDelta !== 0) {
        scrollDragRef.current = e.translationY + rowDelta * cellHeightRef.current;
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
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <GestureDetector gesture={Gesture.Exclusive(longPressGesture, Gesture.Simultaneous(pinchGesture, panGesture))}>
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
                selection={selection}
                onCellSize={(cw, ch) => {
                  cellWidthRef.current = cw;
                  cellHeightRef.current = ch;
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
          {selection && (
            <View style={styles.copyBar} pointerEvents="box-none">
              <Button
                mode="contained"
                compact
                onPress={copySelection}
                style={styles.copyBtn}
              >
                Copy
              </Button>
              <Button
                mode="outlined"
                compact
                onPress={() => {
                  selectionAnchorRef.current = null;
                  hasSelectionAnchor.value = false;
                  setSelection(null);
                }}
                style={styles.copyBtn}
              >
                Cancel
              </Button>
            </View>
          )}
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
  overlayUrl: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    fontFamily: "monospace",
    textAlign: "center",
  },
  overlayActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  copyBar: {
    position: "absolute",
    bottom: 56,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    pointerEvents: "box-none",
  },
  copyBtn: { minWidth: 80 },
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
