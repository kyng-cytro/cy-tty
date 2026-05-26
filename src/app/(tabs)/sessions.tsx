import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Badge, Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  useSessionManager,
  type LiveSession,
} from "@/core/sessions/session-manager";
import { SwipeableRow } from "@/components/common/swipeable-row";
import type { SshSessionStatus } from "@/hooks/use-ssh-session";

function useStatusColors(): Record<SshSessionStatus, string> {
  const theme = useTheme();
  return {
    idle: theme.colors.onSurfaceVariant,
    connecting: theme.colors.secondary,
    connected: theme.colors.primary,
    error: theme.colors.error,
    disconnected: theme.colors.outline,
  };
}

const STATUS_LABEL: Record<SshSessionStatus, string> = {
  idle: "Idle",
  error: "Error",
  connecting: "Connecting",
  connected: "Connected",
  disconnected: "Disconnected",
};

function SessionRow({ session }: { session: LiveSession }) {
  const theme = useTheme();
  const { destroy, create } = useSessionManager();
  const statusColors = useStatusColors();

  const dotColor = statusColors[session.status];
  const canReconnect =
    session.status === "disconnected" ||
    session.status === "error" ||
    session.status === "idle";

  const handlePress = () => {
    if (canReconnect) {
      destroy(session.id);
      const newId = create(session.profile);
      router.push({ pathname: "/terminal/[id]", params: { id: newId } });
    } else {
      router.push({ pathname: "/terminal/[id]", params: { id: session.id } });
    }
  };

  return (
    <SwipeableRow
      style={styles.swipeWrapper}
      left={{
        onAction: () => destroy(session.id),
        icon: "close-circle-outline",
      }}
    >
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Pressable
          onPress={handlePress}
          android_ripple={{ color: theme.colors.primary + "22", borderless: false }}
          style={styles.pressable}
        >
          <View style={[styles.dot, { backgroundColor: dotColor }]} />

          <View style={styles.info}>
            <View style={styles.labelRow}>
              <Text variant="titleSmall" numberOfLines={1} style={[styles.labelText, { color: theme.colors.onSurface }]}>
                {session.profile.label}
              </Text>
              <Text variant="labelSmall" style={[styles.sessionTag, { color: theme.colors.onSurfaceVariant }]}>
                #{session.id.slice(-4)}
              </Text>
            </View>
            <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
              {session.profile.username ? `${session.profile.username}@` : ""}
              {session.profile.host}:{session.profile.port}
            </Text>
            <Text variant="labelSmall" style={{ color: dotColor, opacity: 0.9 }}>
              {STATUS_LABEL[session.status]}
              {session.status === "connected" && `  ·  ${session.cols}×${session.rows}`}
              {session.status === "error" && session.error ? `  —  ${session.error}` : ""}
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

export default function SessionsScreen() {
  const theme = useTheme();
  const { sessions } = useSessionManager();
  const sessionList = Array.from(sessions.values()).filter(
    (s) => s.status !== "connecting" && s.status !== "idle",
  );

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.header, { borderBottomColor: theme.colors.outline }]}>
        <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
          Sessions
        </Text>
        {sessionList.length > 0 && (
          <Badge style={{ backgroundColor: theme.colors.primary }}>
            {sessionList.length}
          </Badge>
        )}
      </View>

      {sessionList.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="console-line" size={64} color={theme.colors.onSurfaceVariant} />
          <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}>
            No active sessions
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.emptyHint, { color: theme.colors.onSurfaceVariant }]}
          >
            Connect from the Connect tab to start a session.{"\n"}
            Navigate back without disconnecting to keep sessions alive here.
          </Text>
        </View>
      ) : (
        sessionList.map((s) => <SessionRow key={s.id} session={s} />)
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  title: { fontWeight: "700" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyHint: {
    textAlign: "center",
    marginTop: 8,
    opacity: 0.7,
  },
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
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  labelText: {
    flexShrink: 1,
  },
  sessionTag: {
    opacity: 0.5,
    fontVariant: ["tabular-nums"],
  },
});
