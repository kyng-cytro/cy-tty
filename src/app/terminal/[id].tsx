/**
 * Terminal screen — attaches to a LiveSession from SessionManager.
 *
 * Key design decisions:
 *   • Reads the session by ID from SessionManager (not TerminalSession).
 *     This means navigating away (Minimize ←) keeps the SSH session alive
 *     and coming back resumes the exact same connection — no reconnect.
 *   • A hidden <TextInput> receives soft-keyboard input and forwards every
 *     character to session.write(). Pressing anywhere on the canvas (or the
 *     keyboard icon in the toolbar) re-focuses it.
 *   • A PinchGestureHandler adjusts font size live; the new size is committed
 *     to TerminalPreferences (and AsyncStorage) on gesture end.
 *
 * Layout:
 *   SafeAreaView (all 4 edges — bottom keeps toolbar above home indicator)
 *     KeyboardAvoidingView
 *       GestureDetector (pinch → font size)
 *         Pressable (tap → show header + focus keyboard)
 *           TerminalCanvas
 *       HiddenTextInput    ← receives soft-keyboard characters
 *       TerminalKeyboard   ← Ctrl / Tab / arrows / Esc / keyboard-toggle
 *       StatusOverlay      ← connecting / error / disconnected
 *       FloatingHeader     ← auto-hides; Minimize ← | label | Disconnect ✕
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Button, IconButton, Text, useTheme } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import {
  TerminalSessionContext,
  useTerminalSessionContext,
  type TerminalSessionContextValue,
} from '@/components/terminal/terminal-session';
import { TerminalCanvas } from '@/components/terminal/terminal-canvas';
import { TerminalKeyboard } from '@/components/terminal/terminal-keyboard';
import { useSessionManager } from '@/core/sessions/session-manager';
import { useTerminalPreferences } from '@/core/theme/preferences-context';

// ── Status overlay ─────────────────────────────────────────────────────────

function StatusOverlay() {
  const theme = useTheme();
  const { status, error, disconnect } = useTerminalSessionContext();

  if (status === 'connected') return null;

  const handleBack = () => {
    disconnect();
    router.back();
  };

  return (
    <View style={[styles.overlay, { backgroundColor: theme.colors.surface + 'ee' }]}>
      {status === 'connecting' && (
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

      {(status === 'idle' || status === 'error') && (
        <>
          <MaterialCommunityIcons name="alert-circle-outline" size={52} color={theme.colors.error} />
          <Text variant="titleMedium" style={{ color: theme.colors.error, marginTop: 8 }}>
            Connection failed
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.overlayText, { color: theme.colors.onSurfaceVariant }]}
          >
            {error ?? 'An unknown error occurred'}
          </Text>
          <Button mode="outlined" onPress={handleBack} style={styles.overlayBtn}>
            Back
          </Button>
        </>
      )}

      {status === 'disconnected' && (
        <>
          <MaterialCommunityIcons
            name="lan-disconnect"
            size={52}
            color={theme.colors.onSurfaceVariant}
          />
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

  const handleMinimize = useCallback(() => router.back(), []);

  const handleDisconnect = useCallback(() => {
    disconnect();
    router.back();
  }, [disconnect]);

  // Only render when connected — overlay handles other states
  if (status !== 'connected') return null;

  return (
    <Animated.View
      style={[
        styles.floatingHeader,
        { backgroundColor: theme.colors.surface + 'dd' },
        { opacity },
      ]}
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
        accessibilityLabel="Disconnect and close"
        style={styles.headerBtn}
      />
    </Animated.View>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function TerminalScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { get } = useSessionManager();
  const { setFontSize, fontSize } = useTerminalPreferences();

  const session = get(id ?? '');

  // ── Soft keyboard via hidden TextInput ─────────────────────────────────
  const textInputRef = useRef<TextInput>(null);

  // Sentinel character always kept in the TextInput so `onChangeText` can
  // detect Backspace (text becomes '' when the sentinel is deleted).
  const SENTINEL = '​'; // zero-width space — invisible, never sent to SSH

  const resetSentinel = useCallback(() => {
    textInputRef.current?.setNativeProps({ text: SENTINEL });
  }, []);

  // blur → focus cycle forces the soft keyboard to appear even when the
  // input is already focused but the user manually dismissed the keyboard.
  const showKeyboard = useCallback(() => {
    textInputRef.current?.blur();
    setTimeout(() => {
      textInputRef.current?.focus();
      resetSentinel();
    }, 50);
  }, [resetSentinel]);

  // Auto-focus + seed sentinel when the terminal screen mounts
  useEffect(() => {
    const t = setTimeout(() => {
      textInputRef.current?.focus();
      resetSentinel();
    }, 350);
    return () => clearTimeout(t);
  }, [resetSentinel]);

  // ── Pinch-to-resize ────────────────────────────────────────────────────
  // Capture font size at the START of the pinch so scale is relative to it.
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

  // ── Auto-hide floating header ──────────────────────────────────────────
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

  // ── Session not found (expired / invalid id) ───────────────────────────
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

  // ── Provide session data via TerminalSessionContext ────────────────────
  // Children (TerminalKeyboard, StatusOverlay, FloatingHeader) consume this
  // via useTerminalSessionContext() — no prop drilling needed.
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
        edges={['top', 'left', 'right', 'bottom']}
        style={[styles.container, { backgroundColor: '#1a1b26' }]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Canvas + pinch gesture + tap-to-focus */}
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
           * Hidden TextInput — the actual keyboard receiver.
           *
           * Sentinel design: the input always holds a single zero-width space
           * (SENTINEL). Every keystroke appends to (or deletes from) that
           * baseline. We strip the sentinel from whatever `onChangeText`
           * receives and send only the real characters. This prevents the
           * char-accumulation bug caused by the async `setNativeProps` clear.
           *
           * Backspace detection: when the user presses Backspace the sentinel
           * is consumed → text becomes '' → we send DEL (\x7f).
           *
           * Enter: handled by `onSubmitEditing` (fires without dismissing
           * because blurOnSubmit={false}).
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
            onChangeText={(text) => {
              // Strip the sentinel marker; what's left is what the user typed.
              const stripped = text.replace(/​/g, ''); // zero-width space
              if (stripped.length > 0) {
                // Handle newlines from some Android keyboards
                session.write(stripped === '\n' || stripped === '\r\n' ? '\r' : stripped);
              } else if (text.length === 0) {
                // Sentinel was deleted → Backspace
                session.write('\x7f');
              }
              // Always restore the sentinel so the next keystroke has a baseline
              resetSentinel();
            }}
            // Return key sends \r without dismissing the keyboard
            onSubmitEditing={() => {
              session.write('\r');
              resetSentinel();
            }}
          />

          {/* Toolbar — Ctrl / Tab / arrows / Esc / keyboard-show */}
          <TerminalKeyboard />

          {/* Connection state overlays */}
          <StatusOverlay />

          {/* Auto-hiding header — rendered last so it floats above everything */}
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
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    bottom: 44, // sit just above the keyboard toolbar
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  overlayText: {
    textAlign: 'center',
    marginTop: 4,
  },
  overlayBtn: {
    marginTop: 12,
    minWidth: 110,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 4,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  headerBtn: { margin: 0 },
  headerLabel: {
    flex: 1,
    textAlign: 'center',
  },
});
