import { StyleSheet, View } from 'react-native';
import { Card, IconButton, Text, useTheme } from 'react-native-paper';
import { cardSharedStyles } from '@/components/connection/card-styles';
import type { DiscoveredHost, GuessedOs } from '@/core/network/scanner';

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
      <View style={cardSharedStyles.emojiWrap}>
        <Text style={cardSharedStyles.emoji}>{emoji}</Text>
      </View>

      <View style={cardSharedStyles.info}>
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
  connectBtn: {
    margin: 0,
  },
});
