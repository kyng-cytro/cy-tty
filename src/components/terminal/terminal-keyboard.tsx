/**
 * TerminalKeyboard
 *
 * Mobile-friendly toolbar that sits above the on-screen keyboard and provides
 * common terminal control keys that phones don't expose natively.
 *
 * Keys:
 *   ⌨  (toggle keyboard)  Ctrl+C  Tab  Esc  ←  ↑  ↓  →
 *
 * Keyboard toggle:
 *   - Tracks real keyboard visibility via Keyboard.addListener.
 *   - Shows keyboard-outline when hidden, keyboard-off-outline when visible.
 *   - Pressing the icon toggles visibility via Keyboard.dismiss() or showKeyboard().
 *
 * Consuming:
 *   Rendered inside a TerminalSessionContext provider so it can call
 *   `useTerminalSessionContext().write(...)` without any prop drilling.
 */

import { useCallback, useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';

import { useTerminalSessionContext } from './terminal-session';

// ── ANSI / VT100 control sequences ─────────────────────────────────────────

const SEND_KEYS = [
  { icon: 'alpha-c-circle-outline', label: 'Ctrl+C', data: '\x03' },
  { icon: 'keyboard-tab',           label: 'Tab',    data: '\t'   },
  { icon: 'keyboard-esc',           label: 'Esc',    data: '\x1b' },
  { icon: 'arrow-left',             label: 'Left',   data: '\x1b[D' },
  { icon: 'arrow-up',               label: 'Up',     data: '\x1b[A' },
  { icon: 'arrow-down',             label: 'Down',   data: '\x1b[B' },
  { icon: 'arrow-right',            label: 'Right',  data: '\x1b[C' },
] as const;

// ── Component ──────────────────────────────────────────────────────────────

export function TerminalKeyboard() {
  const { write, status, showKeyboard } = useTerminalSessionContext();
  const theme = useTheme();
  const disabled = status !== 'connected';

  // ── Track real keyboard visibility ────────────────────────────────────
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const handleToggle = useCallback(() => {
    if (keyboardVisible) {
      Keyboard.dismiss();
    } else {
      showKeyboard();
    }
  }, [keyboardVisible, showKeyboard]);

  return (
    <View
      style={[
        styles.toolbar,
        { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline },
      ]}
    >
      {/* Keyboard toggle — always enabled */}
      <IconButton
        icon={keyboardVisible ? 'keyboard-off-outline' : 'keyboard-outline'}
        size={20}
        iconColor={theme.colors.primary}
        onPress={handleToggle}
        accessibilityLabel={keyboardVisible ? 'Hide keyboard' : 'Show keyboard'}
        style={styles.key}
      />

      {/* Separator */}
      <View style={[styles.separator, { backgroundColor: theme.colors.outline }]} />

      {/* Terminal control keys — distributed evenly across the remaining space */}
      <View style={styles.sendKeys}>
        {SEND_KEYS.map((key) => (
          <IconButton
            key={key.label}
            icon={key.icon}
            size={20}
            disabled={disabled}
            iconColor={disabled ? theme.colors.onSurfaceDisabled : theme.colors.onSurface}
            onPress={() => write(key.data)}
            accessibilityLabel={key.label}
            style={styles.key}
          />
        ))}
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderTopWidth: 0.5,
    paddingHorizontal: 4,
  },
  key: {
    margin: 0,
    borderRadius: 6,
  },
  separator: {
    width: 0.5,
    height: 24,
    marginHorizontal: 4,
  },
  // The send-keys section takes all remaining space and spaces icons evenly.
  sendKeys: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
