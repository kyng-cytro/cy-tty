import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { IconButton, useTheme } from "react-native-paper";

import { tapHaptic } from "@/utils/haptics";
import { useTerminalSessionContext } from "./terminal-session";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

interface SendKey {
  icon?: IconName;
  label: string;
  data: string;
  repeatable: boolean;
}

const SEND_KEYS: SendKey[] = [
  { icon: "keyboard-tab", label: "Tab", data: "\t", repeatable: false },
  { icon: "keyboard-esc", label: "Esc", data: "\x1b", repeatable: false },
  { icon: "arrow-left", label: "Left", data: "\x1b[D", repeatable: true },
  { icon: "arrow-up", label: "Up", data: "\x1b[A", repeatable: true },
  { icon: "arrow-down", label: "Down", data: "\x1b[B", repeatable: true },
  { icon: "arrow-right", label: "Right", data: "\x1b[C", repeatable: true },
  { label: "F1", data: "\x1bOP", repeatable: true },
  { label: "F2", data: "\x1bOQ", repeatable: true },
  { label: "F3", data: "\x1bOR", repeatable: true },
  { label: "F4", data: "\x1bOS", repeatable: true },
  { label: "F5", data: "\x1b[15~", repeatable: true },
  { label: "F6", data: "\x1b[17~", repeatable: true },
  { label: "F7", data: "\x1b[18~", repeatable: true },
  { label: "F8", data: "\x1b[19~", repeatable: true },
  { label: "F9", data: "\x1b[20~", repeatable: true },
  { label: "F10", data: "\x1b[21~", repeatable: true },
  { label: "F11", data: "\x1b[23~", repeatable: true },
  { label: "F12", data: "\x1b[24~", repeatable: true },
];

interface HoldableKeyProps {
  icon?: IconName;
  label: string;
  data: string;
  write: (data: string) => void;
  disabled: boolean;
  repeatable: boolean;
  iconColor: string;
}

function HoldableKey({
  icon,
  label,
  data,
  write,
  disabled,
  repeatable,
  iconColor,
}: HoldableKeyProps) {
  const repeatTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRepeat = useCallback(() => {
    if (repeatTimeout.current) {
      clearTimeout(repeatTimeout.current);
      repeatTimeout.current = null;
    }
    if (repeatInterval.current) {
      clearInterval(repeatInterval.current);
      repeatInterval.current = null;
    }
  }, []);

  useEffect(() => stopRepeat, [stopRepeat]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    tapHaptic();
    write(data);
    if (!repeatable) return;
    repeatTimeout.current = setTimeout(() => {
      repeatInterval.current = setInterval(() => write(data), 80);
    }, 400);
  }, [disabled, write, data, repeatable]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={stopRepeat}
      disabled={disabled}
      accessibilityLabel={label}
      style={icon ? styles.iconKey : styles.fnKey}
    >
      {icon ? (
        <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
      ) : (
        <Text style={[styles.fnKeyText, { color: iconColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function TerminalKeyboard() {
  const { write, status, showKeyboard, hideKeyboard, modifier, toggleModifier } =
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
    tapHaptic();
    if (keyboardVisible) hideKeyboard();
    else showKeyboard();
  }, [keyboardVisible, showKeyboard, hideKeyboard]);

  const iconColor = disabled
    ? theme.colors.onSurfaceDisabled
    : theme.colors.onSurface;

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

      <Pressable
        style={[styles.modKey, disabled && styles.modKeyDisabled]}
        onPress={() => {
          tapHaptic();
          write("\x03");
        }}
        disabled={disabled}
        accessibilityLabel="Send Ctrl+C"
      >
        <Text
          style={[
            styles.modKeyText,
            {
              color: disabled
                ? theme.colors.onSurfaceDisabled
                : theme.colors.onSurface,
            },
          ]}
        >
          ctrl^c
        </Text>
      </Pressable>

      {(["ctrl", "shift", "alt"] as const).map((mod) => (
        <Pressable
          key={mod}
          style={[
            styles.modKey,
            modifier === mod && {
              backgroundColor: theme.colors.primaryContainer,
            },
          ]}
          onPress={() => {
            tapHaptic();
            toggleModifier(mod);
          }}
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sendKeysScroll}
        contentContainerStyle={styles.sendKeys}
      >
        {SEND_KEYS.map((key) => (
          <HoldableKey
            key={key.label}
            icon={key.icon}
            label={key.label}
            data={key.data}
            write={write}
            disabled={disabled}
            repeatable={key.repeatable}
            iconColor={iconColor}
          />
        ))}
      </ScrollView>
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
  modKeyDisabled: {
    opacity: 0.4,
  },
  modKeyText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  sendKeysScroll: {
    flex: 1,
  },
  sendKeys: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 4,
  },
  iconKey: {
    width: 40,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
  },
  fnKey: {
    minWidth: 34,
    height: 36,
    paddingHorizontal: 5,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
  },
  fnKeyText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
    textAlign: "center",
  },
});
