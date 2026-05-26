import { requireNativeView } from 'expo';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

const NativeTerminalKeyboard = requireNativeView<{
  style?: StyleProp<ViewStyle>;
  focused?: boolean;
  onInput?: (e: { nativeEvent: { data: string } }) => void;
}>('ExpoTerminalKeyboard');

export interface TerminalKeyboardViewProps {
  focused: boolean;
  onInput: (data: string) => void;
}

export function TerminalKeyboardView({ focused, onInput }: TerminalKeyboardViewProps) {
  return (
    <NativeTerminalKeyboard
      style={styles.hidden}
      focused={focused}
      onInput={(e) => onInput(e.nativeEvent.data)}
    />
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
});
