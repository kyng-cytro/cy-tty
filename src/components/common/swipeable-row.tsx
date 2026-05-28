import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  Alert,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { tapHaptic } from "@/utils/haptics";

const THRESHOLD = 72;
const MAX_DRAG = 96;
const RESISTANCE = 0.55;

interface SwipeAction {
  /** Called when the swipe is confirmed (after optional Alert). */
  onAction: () => void;
  /** If provided, shows an Alert before calling onAction. */
  confirm?: {
    title: string;
    message: string;
    /** Label for the confirm button. Defaults to "Confirm". */
    label?: string;
  };
  color?: string;
  icon?: string;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  left?: SwipeAction;
  right?: SwipeAction;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

function triggerAction(action: SwipeAction) {
  if (action.confirm) {
    Alert.alert(action.confirm.title, action.confirm.message, [
      { text: "Cancel", style: "cancel" },
      {
        text: action.confirm.label ?? "Confirm",
        style: "destructive",
        onPress: action.onAction,
      },
    ]);
  } else {
    action.onAction();
  }
}

const SNAP = { duration: 220, easing: Easing.out(Easing.cubic) };

export function SwipeableRow({
  children,
  left,
  right,
  borderRadius = 12,
  style,
}: SwipeableRowProps) {
  const x = useSharedValue(0);
  const didVibrate = useSharedValue(false);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-12, 12])
    .onStart(() => {
      didVibrate.value = false;
    })
    .onUpdate((e) => {
      let next = e.translationX * RESISTANCE;
      if (next > 0 && !right) next = 0;
      if (next < 0 && !left) next = 0;
      x.value = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, next));

      const pastThreshold =
        (x.value <= -THRESHOLD && !!left) || (x.value >= THRESHOLD && !!right);
      if (pastThreshold && !didVibrate.value) {
        didVibrate.value = true;
        runOnJS(tapHaptic)();
      } else if (!pastThreshold) {
        didVibrate.value = false;
      }
    })
    .onEnd(() => {
      if (x.value <= -THRESHOLD && left) runOnJS(triggerAction)(left);
      else if (x.value >= THRESHOLD && right) runOnJS(triggerAction)(right);
      x.value = withTiming(0, SNAP);
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const leftBgStyle = useAnimatedStyle(() => ({
    opacity: x.value < 0 ? Math.min(1, -x.value / THRESHOLD) : 0,
  }));
  const rightBgStyle = useAnimatedStyle(() => ({
    opacity: x.value > 0 ? Math.min(1, x.value / THRESHOLD) : 0,
  }));

  return (
    <View style={[styles.wrapper, { borderRadius }, style]}>
      {left && (
        <Animated.View
          style={[
            styles.actionRight,
            { backgroundColor: left.color ?? "#c62828", borderRadius },
            leftBgStyle,
          ]}
        >
          <MaterialCommunityIcons
            name={(left.icon ?? "delete-outline") as any}
            size={22}
            color="white"
          />
        </Animated.View>
      )}

      {right && (
        <Animated.View
          style={[
            styles.actionLeft,
            { backgroundColor: right.color ?? "#1565c0", borderRadius },
            rightBgStyle,
          ]}
        >
          <MaterialCommunityIcons
            name={(right.icon ?? "pencil-outline") as any}
            size={22}
            color="white"
          />
        </Animated.View>
      )}

      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
  },
  actionRight: {
    ...StyleSheet.absoluteFill,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 22,
  },
  actionLeft: {
    ...StyleSheet.absoluteFill,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingLeft: 22,
  },
});
