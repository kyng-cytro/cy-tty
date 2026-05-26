/**
 * GlobalSearchSheet — cross-tab search overlay.
 *
 * Searches saved profiles, active sessions, and recently discovered hosts.
 * Opened by the search icon in the tab header (accessible from all tabs).
 *
 * Usage:
 *   const ref = useRef<BottomSheetModal>(null);
 *   <GlobalSearchSheet ref={ref} onConnect={handleConnect} />
 *   ref.current?.present();
 */

import { forwardRef, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Text, useTheme } from 'react-native-paper';

import { ProfileCard } from '@/components/connection/profile-card';
import { DeviceCard } from '@/components/connection/device-card';
import type { SshProfile } from '@/core/profiles/types';
import type { DiscoveredHost } from '@/core/network/scanner';
import type { LiveSession } from '@/core/sessions/session-manager';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GlobalSearchSheetProps {
  profiles: SshProfile[];
  sessions: LiveSession[];
  scannedHosts: DiscoveredHost[];
  onConnectProfile: (profile: SshProfile) => void;
  onConnectHost: (host: DiscoveredHost) => void;
  onResumeSession: (sessionId: string) => void;
}

// ── Match helpers ─────────────────────────────────────────────────────────────

function profileMatches(p: SshProfile, q: string): boolean {
  const s = q.toLowerCase();
  return (
    p.label.toLowerCase().includes(s) ||
    p.host.toLowerCase().includes(s) ||
    p.username.toLowerCase().includes(s)
  );
}

function hostMatches(h: DiscoveredHost, q: string): boolean {
  const s = q.toLowerCase();
  return (
    h.ip.includes(s) ||
    (h.hostname?.toLowerCase().includes(s) ?? false) ||
    (h.sshBanner?.toLowerCase().includes(s) ?? false)
  );
}

function sessionMatches(s: LiveSession, q: string): boolean {
  return profileMatches(s.profile, q) || s.status.includes(q.toLowerCase());
}

// ── Component ─────────────────────────────────────────────────────────────────

export const GlobalSearchSheet = forwardRef<BottomSheetModal, GlobalSearchSheetProps>(
  function GlobalSearchSheet(
    { profiles, sessions, scannedHosts, onConnectProfile, onConnectHost, onResumeSession },
    ref,
  ) {
    const theme = useTheme();
    const [query, setQuery] = useState('');

    const trimmed = query.trim();

    const filteredProfiles = useMemo(
      () => (trimmed ? profiles.filter((p) => profileMatches(p, trimmed)) : profiles),
      [profiles, trimmed],
    );

    const filteredSessions = useMemo(
      () => (trimmed ? sessions.filter((s) => sessionMatches(s, trimmed)) : sessions),
      [sessions, trimmed],
    );

    const filteredHosts = useMemo(
      () => (trimmed ? scannedHosts.filter((h) => hostMatches(h, trimmed)) : scannedHosts),
      [scannedHosts, trimmed],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
      ),
      [],
    );

    const total = filteredProfiles.length + filteredSessions.length + filteredHosts.length;

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['60%', '95%']}
        backgroundStyle={{ backgroundColor: theme.colors.surface }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.onSurfaceVariant }}
        backdropComponent={renderBackdrop}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        {/* Search input pinned above scroll */}
        <View style={[styles.searchBar, { borderBottomColor: theme.colors.outline }]}>
          <BottomSheetTextInput
            placeholder="Search connections, sessions, hosts…"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={query}
            onChangeText={setQuery}
            autoFocus
            style={[styles.searchInput, { color: theme.colors.onSurface }]}
          />
        </View>

        <BottomSheetScrollView contentContainerStyle={styles.scroll}>
          {/* Active sessions */}
          {filteredSessions.length > 0 && (
            <>
              <SectionHeader label="Active Sessions" />
              {filteredSessions.map((s) => (
                <ProfileCard
                  key={s.id}
                  profile={s.profile}
                  onConnect={() => onResumeSession(s.id)}
                />
              ))}
            </>
          )}

          {/* Saved profiles */}
          {filteredProfiles.length > 0 && (
            <>
              <SectionHeader label="Saved Connections" />
              {filteredProfiles.map((p) => (
                <ProfileCard key={p.id} profile={p} onConnect={onConnectProfile} />
              ))}
            </>
          )}

          {/* Discovered hosts */}
          {filteredHosts.length > 0 && (
            <>
              <SectionHeader label="Devices on Network" />
              {filteredHosts.map((h) => (
                <DeviceCard key={h.ip} host={h} onConnect={onConnectHost} />
              ))}
            </>
          )}

          {total === 0 && (
            <View style={styles.empty}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {trimmed ? `No results for "${trimmed}"` : 'No connections yet'}
              </Text>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

function SectionHeader({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <Text
      variant="labelMedium"
      style={[styles.sectionHeader, { color: theme.colors.onSurfaceVariant }]}
    >
      {label.toUpperCase()}
    </Text>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    fontSize: 16,
    paddingVertical: 6,
  },
  scroll: {
    paddingBottom: 32,
  },
  sectionHeader: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
  },
});
