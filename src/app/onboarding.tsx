import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  StyleSheet,
  View,
  type ViewToken,
} from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

export const ONBOARDING_KEY = "cy_tty_onboarding_completed";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type Slide = {
  id: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
};

const SLIDES: Slide[] = [
  {
    id: "1",
    icon: "server-network",
    title: "SSH at Your\nFingertips",
    subtitle:
      "Connect to any server from your pocket. Manage profiles and jump right in — no laptop needed.",
  },
  {
    id: "2",
    icon: "console-network",
    title: "Multiple Sessions,\nZero Friction",
    subtitle:
      "Run concurrent SSH sessions and switch between them without losing context or dropping a connection.",
  },
  {
    id: "3",
    icon: "palette-outline",
    title: "Your Terminal,\nYour Way",
    subtitle:
      "Pick your theme, font, and keyboard layout. cy-tty adapts to the workflow you already love.",
  },
];

function SlideItem({ slide }: { slide: Slide }) {
  const theme = useTheme();

  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <View
        style={[
          styles.illustrationContainer,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        <View
          style={[
            styles.iconRing,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <MaterialCommunityIcons
            name={slide.icon}
            size={72}
            color={theme.colors.primary}
          />
        </View>
      </View>
      <View style={styles.textBlock}>
        <Text variant="headlineLarge" style={styles.title}>
          {slide.title}
        </Text>
        <Text
          variant="bodyLarge"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          {slide.subtitle}
        </Text>
      </View>
    </View>
  );
}

function Dots({ count, active }: { count: number; active: number }) {
  const theme = useTheme();
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor:
                i === active
                  ? theme.colors.primary
                  : theme.colors.surfaceVariant,
              width: i === active ? 20 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const handleDiveIn = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    router.replace("/(tabs)");
  };

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  };

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.root}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => <SlideItem slide={item} />}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        style={styles.list}
      />
      <View style={styles.footer}>
        <Dots count={SLIDES.length} active={activeIndex} />
        <Button
          mode="contained"
          onPress={isLast ? handleDiveIn : handleNext}
          style={styles.cta}
          contentStyle={styles.ctaContent}
          labelStyle={styles.ctaLabel}
        >
          {isLast ? "Dive In" : "Next"}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { flex: 1 },
  slide: {
    flex: 1,
  },
  illustrationContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginHorizontal: 24,
    marginTop: 24,
    borderRadius: 28,
  },
  iconRing: {
    width: 148,
    height: 148,
    borderRadius: 74,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 8,
    gap: 12,
  },
  title: {
    fontWeight: "700",
    lineHeight: 40,
  },
  subtitle: {
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 20,
    alignItems: "center",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  cta: {
    width: "100%",
    borderRadius: 28,
  },
  ctaContent: {
    paddingVertical: 6,
  },
  ctaLabel: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});
