/**
 * DeviceCard — a discovered SSH host from the network scan.
 *
 *   [ 🐧/🍎/🪟/💻 ]  ip / hostname        SSH-2.0-OpenSSH_9.1
 *                                           ←  Connect →
 */

import { StyleSheet, View } from 'react-native';
import { Card, IconButton, Text, useTheme } from 'react-native-paper';
import type { DiscoveredHost, GuessedOs } from '@/core/network/scanner';

// ── OS display ────────────────────────────────────────────────────────────────

const OS_EMOJI: Record<GuessedOs, string> = {
  linux: '🐧',
  macos: '🍎',
  windows: '🪟',
  unknown: '💻',
};

const OS_LABEL: Record<GuessedOs, string> = {
  linux: 'Linux',
  macos: 'macOS',
  windows: 'Windows',
  unknown: 'Unknown OS',
};

// ── Component ─────────────────────────────────────────────────────────────────

export interface DeviceCardProps {
  host: DiscoveredHost;
  onConnect: (host: DiscoveredHost) => void;
}

export function DeviceCard({ host, onConnect }: DeviceCardProps) {
  const theme = useTheme();
  const emoji = OS_EMOJI[host.guessedOs];
  const osLabel = OS_LABEL[host.guessedOs];
  const displayName = host.hostname ?? host.ip;

  return (
    <Card
      style={[styles.card, { backgroundColor: theme.colors.surface }]}
      contentStyle={styles.cardContent}
    >
      {/* OS emoji */}
      <View style={styles.emojiWrap}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text
          variant="titleSmall"
          numberOfLines={1}
          style={{ color: theme.colors.onSurface }}
        >
          {displayName}
        </Text>
        {host.hostname && (
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {host.ip}
          </Text>
        )}
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}
        >
          {osLabel}
          {host.sshBanner ? `  ·  ${host.sshBanner}` : '  ·  SSH'}
        </Text>
      </View>

      {/* Connect */}
      <IconButton
        icon="lan-connect"
        size={20}
        iconColor={theme.colors.secondary}
        onPress={() => onConnect(host)}
        accessibilityLabel={`Connect to ${displayName}`}
        style={styles.connectBtn}
      />
    </Card>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emojiWrap: {
    width: 40,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    gap: 1,
    paddingHorizontal: 8,
  },
  connectBtn: {
    margin: 0,
  },
});
