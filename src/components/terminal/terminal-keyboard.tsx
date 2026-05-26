import { useCallback, useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { IconButton, useTheme } from "react-native-paper";

import { useTerminalSessionContext } from "./terminal-session";

const SEND_KEYS = [
  { icon: "keyboard-tab",        label: "Tab",    data: "\t"      },
  { icon: "keyboard-esc",        label: "Esc",    data: "\x1b"    },
  { icon: "close-circle-outline", label: "Ctrl+C", data: "\x03"   },
  { icon: "arrow-left",          label: "Left",   data: "\x1b[D"  },
  { icon: "arrow-up",            label: "Up",     data: "\x1b[A"  },
  { icon: "arrow-down",          label: "Down",   data: "\x1b[B"  },
  { icon: "arrow-right",         label: "Right",  data: "\x1b[C"  },
] as const;

export function TerminalKeyboard() {
  const { write, status, showKeyboard, modifier, toggleModifier } =
    useTerminalSessionContext();
  const theme = useTheme();
  const disabled = status !== "connected";

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const handleToggle = useCallback(() => {
    if (keyboardVisible) Keyboard.dismiss();
    else showKeyboard();
  }, [keyboardVisible, showKeyboard]);

  return (
    <View
      style={[
        styles.toolbar,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
        },
      ]}
    >
      <IconButton
        icon={keyboardVisible ? "keyboard-off-outline" : "keyboard-outline"}
        size={20}
        iconColor={theme.colors.primary}
        onPress={handleToggle}
        accessibilityLabel={keyboardVisible ? "Hide keyboard" : "Show keyboard"}
        style={styles.key}
      />

      <View style={[styles.sep, { backgroundColor: theme.colors.outline }]} />

      {(["ctrl", "alt"] as const).map((mod) => (
        <Pressable
          key={mod}
          style={[
            styles.modKey,
            modifier === mod && {
              backgroundColor: theme.colors.primaryContainer,
            },
          ]}
          onPress={() => toggleModifier(mod)}
          accessibilityLabel={`${mod} modifier`}
        >
          <Text
            style={[
              styles.modKeyText,
              {
                color:
                  modifier === mod
                    ? theme.colors.primary
                    : theme.colors.onSurface,
              },
            ]}
          >
            {mod}
          </Text>
        </Pressable>
      ))}

      <View style={[styles.sep, { backgroundColor: theme.colors.outline }]} />

      <View style={styles.sendKeys}>
        {SEND_KEYS.map((key) => (
          <IconButton
            key={key.label}
            icon={key.icon}
            size={20}
            disabled={disabled}
            iconColor={
              disabled ? theme.colors.onSurfaceDisabled : theme.colors.onSurface
            }
            onPress={() => write(key.data)}
            accessibilityLabel={key.label}
            style={styles.key}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderTopWidth: 0.5,
    paddingHorizontal: 2,
  },
  key: {
    margin: 0,
    borderRadius: 6,
  },
  sep: {
    width: 0.5,
    height: 24,
    marginHorizontal: 3,
  },
  modKey: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  modKeyText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  sendKeys: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
