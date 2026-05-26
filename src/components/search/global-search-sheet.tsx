import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { forwardRef, useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { DeviceCard } from "@/components/connection/device-card";
import { ProfileCard } from "@/components/connection/profile-card";
import type { DiscoveredHost } from "@/core/network/scanner";
import type { SshProfile } from "@/core/profiles/types";
import type { LiveSession } from "@/core/sessions/session-manager";

export interface GlobalSearchSheetProps {
  profiles: SshProfile[];
  sessions: LiveSession[];
  scannedHosts: DiscoveredHost[];
  onConnectProfile: (profile: SshProfile) => void;
  onConnectHost: (host: DiscoveredHost) => void;
  onResumeSession: (sessionId: string) => void;
  onOpenChange?: (open: boolean) => void;
}

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

export const GlobalSearchSheet = forwardRef<
  BottomSheetModal,
  GlobalSearchSheetProps
>(function GlobalSearchSheet(
  {
    profiles,
    sessions,
    scannedHosts,
    onConnectProfile,
    onConnectHost,
    onResumeSession,
    onOpenChange,
  },
  ref,
) {
  const theme = useTheme();

  // Uncontrolled: ref tracks the raw text so the input never re-renders from
  // state changes. A short debounce fires the filter state update separately.
  const queryRef = useRef("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filterQuery, setFilterQuery] = useState("");

  const handleChangeText = useCallback((text: string) => {
    queryRef.current = text;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setFilterQuery(text.trim()), 120);
  }, []);

  const filteredProfiles = useMemo(
    () =>
      filterQuery
        ? profiles.filter((p) => profileMatches(p, filterQuery))
        : profiles,
    [profiles, filterQuery],
  );

  const filteredSessions = useMemo(
    () =>
      filterQuery
        ? sessions.filter((s) => sessionMatches(s, filterQuery))
        : sessions,
    [sessions, filterQuery],
  );

  const filteredHosts = useMemo(
    () =>
      filterQuery
        ? scannedHosts.filter((h) => hostMatches(h, filterQuery))
        : scannedHosts,
    [scannedHosts, filterQuery],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    [],
  );

  const total =
    filteredProfiles.length + filteredSessions.length + filteredHosts.length;

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={["60%", "95%"]}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.onSurfaceVariant }}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onChange={(index) => onOpenChange?.(index >= 0)}
    >
      <View
        style={[styles.searchBar, { borderBottomColor: theme.colors.outline }]}
      >
        <BottomSheetTextInput
          defaultValue=""
          onChangeText={handleChangeText}
          placeholder="Search connections, sessions, hosts…"
          placeholderTextColor={theme.colors.onSurfaceVariant}
          autoFocus
          style={[styles.searchInput, { color: theme.colors.onSurface }]}
        />
      </View>

      <BottomSheetScrollView contentContainerStyle={styles.scroll}>
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

        {filteredProfiles.length > 0 && (
          <>
            <SectionHeader label="Saved Connections" />
            {filteredProfiles.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                onConnect={onConnectProfile}
              />
            ))}
          </>
        )}

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
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {filterQuery
                ? `No results for "${filterQuery}"`
                : "No connections yet"}
            </Text>
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

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
    alignItems: "center",
    paddingTop: 48,
  },
});
