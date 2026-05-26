import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Card, IconButton, Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';

import { useSessionManager, type LiveSession } from '@/core/sessions/session-manager';
import type { SshSessionStatus } from '@/hooks/use-ssh-session';

function useStatusColors(): Record<SshSessionStatus, string> {
  const theme = useTheme();
  return {
    idle:         theme.colors.onSurfaceVariant,
    connecting:   theme.colors.secondary,
    connected:    theme.colors.primary,
    error:        theme.colors.error,
    disconnected: theme.colors.outline,
  };
}

const STATUS_LABEL: Record<SshSessionStatus, string> = {
  idle: 'Idle',
  connecting: 'Connecting',
  connected: 'Connected',
  error: 'Error',
  disconnected: 'Disconnected',
};

function SessionRow({ session }: { session: LiveSession }) {
  const theme = useTheme();
  const { destroy, create } = useSessionManager();
  const statusColors = useStatusColors();
  const dotColor = statusColors[session.status];
  const statusLabel = STATUS_LABEL[session.status];

  const canReconnect = session.status === 'disconnected' || session.status === 'error' || session.status === 'idle';

  const handleResume = () => {
    if (canReconnect) {
      destroy(session.id);
      const newId = create(session.profile);
      router.push({ pathname: '/terminal/[id]', params: { id: newId } });
    } else {
      router.push({ pathname: '/terminal/[id]', params: { id: session.id } });
    }
  };

  const handleDisconnect = () => {
    destroy(session.id);
  };

  return (
    <Card
      style={[styles.sessionCard, { backgroundColor: theme.colors.surface }]}
      contentStyle={styles.sessionContent}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />

      <View style={styles.sessionInfo}>
        <Text variant="titleSmall" numberOfLines={1} style={{ color: theme.colors.onSurface }}>
          {session.profile.label}
        </Text>
        <Text
          variant="bodySmall"
          numberOfLines={1}
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {session.profile.username ? `${session.profile.username}@` : ''}
          {session.profile.host}:{session.profile.port}
        </Text>
        <Text variant="labelSmall" style={{ color: dotColor, opacity: 0.9 }}>
          {statusLabel}
          {session.status === 'connected' && `  ·  ${session.cols}×${session.rows}`}
          {session.status === 'error' && session.error ? `  —  ${session.error}` : ''}
        </Text>
      </View>

      <View style={styles.sessionActions}>
        <IconButton
          icon={canReconnect ? "refresh" : "play"}
          size={20}
          iconColor={theme.colors.primary}
          onPress={handleResume}
          accessibilityLabel={canReconnect ? "Reconnect" : "Resume session"}
          style={styles.actionBtn}
        />
        <IconButton
          icon="close"
          size={20}
          iconColor={theme.colors.error}
          onPress={handleDisconnect}
          accessibilityLabel="Disconnect session"
          style={styles.actionBtn}
        />
      </View>
    </Card>
  );
}

export default function SessionsScreen() {
  const theme = useTheme();
  const { sessions } = useSessionManager();
  const sessionList = Array.from(sessions.values());

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
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
          <MaterialCommunityIcons
            name="console-line"
            size={64}
            color={theme.colors.onSurfaceVariant}
          />
          <Text
            variant="titleMedium"
            style={{ color: theme.colors.onSurfaceVariant, marginTop: 16 }}
          >
            No active sessions
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.emptyHint, { color: theme.colors.onSurfaceVariant }]}
          >
            Connect from the Connect tab to start a session.{'\n'}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  title: { fontWeight: '700' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyHint: {
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
  sessionCard: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
  },
  sessionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  sessionInfo: {
    flex: 1,
    gap: 2,
  },
  sessionActions: { flexDirection: 'row' },
  actionBtn: { margin: 0 },
});
