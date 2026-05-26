/**
 * ProfileCard — compact list item for a saved SSH profile.
 *
 *   [ 🐧/🍎/🪟/💻 ]  label          host:port
 *                       last connected  ←  connect →
 */

import { StyleSheet, View } from 'react-native';
import { Card, IconButton, Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { SshProfile } from '@/core/profiles/types';

// ── OS icon mapping ───────────────────────────────────────────────────────────

type OsEmoji = '🐧' | '🍎' | '🪟' | '💻';

function osEmoji(label: string, host: string): OsEmoji {
  const combined = `${label} ${host}`.toLowerCase();
  if (combined.includes('windows') || combined.includes('win')) return '🪟';
  if (combined.includes('mac') || combined.includes('apple')) return '🍎';
  if (
    combined.includes('linux') ||
    combined.includes('ubuntu') ||
    combined.includes('debian') ||
    combined.includes('centos') ||
    combined.includes('fedora') ||
    combined.includes('raspberr')
  )
    return '🐧';
  return '💻';
}

function formatLastConnected(ts?: number): string {
  if (!ts) return 'Never connected';
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface ProfileCardProps {
  profile: SshProfile;
  onConnect: (profile: SshProfile) => void;
  onEdit?: (profile: SshProfile) => void;
  onDelete?: (profile: SshProfile) => void;
}

export function ProfileCard({ profile, onConnect, onEdit, onDelete }: ProfileCardProps) {
  const theme = useTheme();
  const emoji = osEmoji(profile.label, profile.host);

  return (
    <Card
      style={[styles.card, { backgroundColor: theme.colors.surface }]}
      contentStyle={styles.cardContent}
    >
      {/* OS emoji */}
      <View style={styles.emojiWrap}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>

      {/* Info block */}
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
          {profile.username ? `${profile.username}@` : ''}{profile.host}:{profile.port}
        </Text>
        <Text
          variant="labelSmall"
          style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}
        >
          {formatLastConnected(profile.lastConnected)}
          {profile.authMethod === 'key' && '  🔑'}
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {onEdit && (
          <IconButton
            icon="pencil-outline"
            size={18}
            iconColor={theme.colors.onSurfaceVariant}
            onPress={() => onEdit(profile)}
            style={styles.actionBtn}
          />
        )}
        {onDelete && (
          <IconButton
            icon="delete-outline"
            size={18}
            iconColor={theme.colors.error}
            onPress={() => onDelete(profile)}
            style={styles.actionBtn}
          />
        )}
        <IconButton
          icon="play"
          size={20}
          iconColor={theme.colors.primary}
          onPress={() => onConnect(profile)}
          style={styles.connectBtn}
        />
      </View>
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
    gap: 0,
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    margin: 0,
  },
  connectBtn: {
    margin: 0,
  },
});
