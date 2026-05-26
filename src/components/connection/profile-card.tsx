import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, StyleSheet, View } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";

import { SwipeableRow } from "@/components/common/swipeable-row";
import type { SshProfile } from "@/core/profiles/types";

type OsEmoji = "🐧" | "🍎" | "🪟" | "💻";

function osEmoji(label: string, host: string): OsEmoji {
  const s = `${label} ${host}`.toLowerCase();
  if (s.includes("windows") || s.includes("win")) return "🪟";
  if (s.includes("mac") || s.includes("apple")) return "🍎";
  if (
    s.includes("linux") ||
    s.includes("ubuntu") ||
    s.includes("debian") ||
    s.includes("centos") ||
    s.includes("fedora") ||
    s.includes("raspberr")
  )
    return "🐧";
  return "💻";
}

function formatLastConnected(ts?: number): string {
  if (!ts) return "Never connected";
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export interface ProfileCardProps {
  profile: SshProfile;
  onConnect: (profile: SshProfile) => void;
  onEdit?: (profile: SshProfile) => void;
  onDelete?: (profile: SshProfile) => void;
}

export function ProfileCard({
  profile,
  onConnect,
  onEdit,
  onDelete,
}: ProfileCardProps) {
  const theme = useTheme();
  const emoji = osEmoji(profile.label, profile.host);

  return (
    <SwipeableRow
      style={styles.swipeWrapper}
      left={
        onDelete
          ? {
              onAction: () => onDelete(profile),
              confirm: {
                title: "Delete Profile",
                message: `Delete "${profile.label}"? This cannot be undone.`,
                label: "Delete",
              },
            }
          : undefined
      }
      right={
        onEdit
          ? {
              onAction: () => onEdit(profile),
            }
          : undefined
      }
    >
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Pressable
          onPress={() => onConnect(profile)}
          android_ripple={{
            color: theme.colors.primary + "22",
            borderless: false,
          }}
          style={styles.pressable}
        >
          <View style={styles.emojiWrap}>
            <Text style={styles.emoji}>{emoji}</Text>
          </View>

          <View style={styles.info}>
            <Text
              variant="titleSmall"
              numberOfLines={1}
              style={{ color: theme.colors.onSurface }}
            >
              {profile.label}
            </Text>
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {profile.username ? `${profile.username}@` : ""}
              {profile.host}:{profile.port}
            </Text>
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}
            >
              {formatLastConnected(profile.lastConnected)}
              {profile.authMethod === "key" && "  🔑"}
            </Text>
          </View>

          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={theme.colors.onSurfaceVariant}
            style={{ opacity: 0.4 }}
          />
        </Pressable>
      </Card>
    </SwipeableRow>
  );
}

const styles = StyleSheet.create({
  swipeWrapper: {
    marginHorizontal: 16,
    marginVertical: 6,
  },
  card: {
    borderRadius: 12,
    overflow: "hidden",
  },
  pressable: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emojiWrap: {
    width: 40,
    alignItems: "center",
  },
  emoji: { fontSize: 24 },
  info: {
    flex: 1,
    gap: 1,
    paddingHorizontal: 8,
  },
});
