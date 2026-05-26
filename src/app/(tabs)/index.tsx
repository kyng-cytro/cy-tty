import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  FAB,
  IconButton,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConnectionSheet } from "@/components/connection/connection-sheet";
import { DeviceCard } from "@/components/connection/device-card";
import { ProfileCard } from "@/components/connection/profile-card";
import { GlobalSearchSheet } from "@/components/search/global-search-sheet";

import type { DiscoveredHost } from "@/core/network/scanner";
import type { SshProfile } from "@/core/profiles/types";
import { useSessionManager } from "@/core/sessions/session-manager";
import { useNetworkScan } from "@/hooks/use-network-scan";
import { useProfiles } from "@/hooks/use-profiles";

export default function ConnectScreen() {
  const theme = useTheme();

  const { profiles, save, remove, touch } = useProfiles();
  const { hosts, scanning, progress } = useNetworkScan();
  const { create, sessions } = useSessionManager();

  const sheetRef = useRef<BottomSheetModal>(null);
  const searchRef = useRef<BottomSheetModal>(null);
  const editingProfile = useRef<SshProfile | undefined>(undefined);
  const prefillHost = useRef("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (searchOpen) {
        searchRef.current?.dismiss();
        return true;
      }
      if (sheetOpen) {
        sheetRef.current?.dismiss();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [sheetOpen, searchOpen]);

  const launchSession = useCallback(
    (profile: SshProfile) => {
      void touch(profile.id);
      const sessionId = create(profile);
      router.push({ pathname: "/terminal/[id]", params: { id: sessionId } });
    },
    [create, touch],
  );

  const handleSaveAndConnect = useCallback(
    async (profile: SshProfile) => {
      await save(profile);
      launchSession(profile);
    },
    [save, launchSession],
  );

  const handleConnectDevice = useCallback((host: DiscoveredHost) => {
    prefillHost.current = host.ip;
    editingProfile.current = undefined;
    sheetRef.current?.present();
  }, []);

  const handleEditProfile = useCallback((profile: SshProfile) => {
    editingProfile.current = profile;
    prefillHost.current = "";
    sheetRef.current?.present();
  }, []);

  const handleDeleteProfile = useCallback(
    (profile: SshProfile) => {
      void remove(profile.id);
    },
    [remove],
  );

  const handleResumeSession = useCallback(
    (sessionId: string) => {
      router.push({ pathname: "/terminal/[id]", params: { id: sessionId } });
    },
    [],
  );

  return (
    <BottomSheetModalProvider>
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <View
          style={[styles.header, { borderBottomColor: theme.colors.outline }]}
        >
          <View style={styles.headerLogoWrap}>
            <Image
              contentFit="contain"
              style={styles.headerLogo}
              accessibilityLabel="cy-tty"
              source={require("../../../assets/images/icon-tp.png")}
            />
          </View>
          <IconButton
            icon="magnify"
            size={22}
            iconColor={theme.colors.onSurface}
            onPress={() => searchRef.current?.present()}
            accessibilityLabel="Search connections"
          />
        </View>

        {scanning && (
          <ProgressBar
            progress={progress}
            color={theme.colors.primary}
            style={styles.progressBar}
          />
        )}

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text
                variant="titleSmall"
                style={[
                  styles.sectionTitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                DEVICES ON NETWORK
              </Text>
              {scanning && (
                <ActivityIndicator
                  size={12}
                  color={theme.colors.primary}
                  style={{ marginLeft: 8 }}
                />
              )}
            </View>

            {!scanning && hosts.length === 0 && (
              <Text
                variant="bodySmall"
                style={[
                  styles.emptyHint,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                No SSH devices found on this network.
              </Text>
            )}
            {hosts.map((h) => (
              <DeviceCard key={h.ip} host={h} onConnect={handleConnectDevice} />
            ))}
          </View>

          <View style={styles.section}>
            <Text
              variant="titleSmall"
              style={[
                styles.sectionTitle,
                styles.sectionTitleStandalone,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              RECENT CONNECTIONS
            </Text>

            {profiles.length === 0 && (
              <Text
                variant="bodySmall"
                style={[
                  styles.emptyHint,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Tap + to add your first connection.
              </Text>
            )}
            {profiles.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                onConnect={launchSession}
                onEdit={handleEditProfile}
                onDelete={handleDeleteProfile}
              />
            ))}
          </View>
        </ScrollView>

        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color={theme.colors.onPrimary}
          onPress={() => {
            editingProfile.current = undefined;
            prefillHost.current = "";
            sheetRef.current?.present();
          }}
          accessibilityLabel="Add new connection"
        />

        <ConnectionSheet
          ref={sheetRef}
          onSave={handleSaveAndConnect}
          initialHost={prefillHost.current}
          editProfile={editingProfile.current}
          onOpenChange={setSheetOpen}
        />

        <GlobalSearchSheet
          ref={searchRef}
          profiles={profiles}
          scannedHosts={hosts}
          onConnectProfile={launchSession}
          onConnectHost={handleConnectDevice}
          onResumeSession={handleResumeSession}
          sessions={Array.from(sessions.values())}
          onOpenChange={setSearchOpen}
        />
      </SafeAreaView>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 20,
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLogoWrap: {
    flex: 1,
    maxWidth: 80,
    marginLeft: -20,
  },
  headerLogo: {
    width: 80,
    height: 32,
  },
  progressBar: { height: 2 },
  scroll: { paddingBottom: 96 },
  section: { paddingTop: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    letterSpacing: 0.8,
    opacity: 0.7,
  },
  sectionTitleStandalone: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  emptyHint: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    opacity: 0.6,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    borderRadius: 16,
  },
});
