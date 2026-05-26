/**
 * Settings tab — SSH Keys, Known Hosts, and Terminal appearance.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  Card,
  Divider,
  IconButton,
  List,
  Text,
  useTheme,
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

import { KeyStore, type KeyMeta } from '@/core/keys/key-store';
import { KnownHosts, type KnownHost } from '@/core/keys/known-hosts';
import { useTerminalPreferences } from '@/core/theme/preferences-context';
import { getCategories, getThemesByCategory } from '@/core/theme/color-themes';
import type { TerminalTheme } from '@/core/theme/types';
import type { TerminalFont } from '@/core/theme/fonts';

// ── SSH Keys section ──────────────────────────────────────────────────────────

function SshKeysSection() {
  const theme = useTheme();
  const [keys, setKeys] = useState<KeyMeta[]>([]);

  const reload = useCallback(async () => {
    setKeys(await KeyStore.list());
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const handleImport = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      const pem = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const name = result.assets[0].name ?? `Key ${keys.length + 1}`;
      await KeyStore.import(pem.trim(), name.replace(/\.[^.]+$/, ''));
      await reload();
    } catch {
      Alert.alert('Import failed', 'Could not read or import the selected key file.');
    }
  }, [keys.length, reload]);

  const handleDelete = useCallback(
    (key: KeyMeta) => {
      Alert.alert('Delete key', `Delete "${key.label}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await KeyStore.remove(key.id);
            await reload();
          },
        },
      ]);
    },
    [reload],
  );

  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
          SSH KEYS
        </Text>
        <Button mode="text" compact icon="plus" onPress={handleImport} textColor={theme.colors.primary}>
          Import
        </Button>
      </View>

      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {keys.length === 0 ? (
          <List.Item
            title="No keys imported"
            description="Import an id_rsa or ed25519 key file"
            style={styles.emptyListItem}
            left={() => (
              <MaterialCommunityIcons
                name="key-outline" size={24} color={theme.colors.onSurfaceVariant} style={styles.listIcon}
              />
            )}
            titleStyle={{ color: theme.colors.onSurfaceVariant }}
            descriptionStyle={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}
          />
        ) : (
          keys.map((k, i) => (
            <View key={k.id}>
              <List.Item
                title={k.label}
                description={`Added ${new Date(k.createdAt).toLocaleDateString()}`}
                left={() => (
                  <MaterialCommunityIcons
                    name="key-variant" size={22} color={theme.colors.secondary} style={styles.listIcon}
                  />
                )}
                right={() => (
                  <IconButton
                    icon="delete-outline" size={18} iconColor={theme.colors.error}
                    onPress={() => handleDelete(k)} style={{ margin: 0 }}
                  />
                )}
                titleStyle={{ color: theme.colors.onSurface }}
                descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
              />
              {i < keys.length - 1 && <Divider />}
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

// ── Known Hosts section ───────────────────────────────────────────────────────

function KnownHostsSection() {
  const theme = useTheme();
  const [hosts, setHosts] = useState<KnownHost[]>([]);

  const reload = useCallback(async () => {
    setHosts(await KnownHosts.getAll());
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const handleRemove = useCallback(
    (h: KnownHost) => {
      Alert.alert('Remove host', `Remove "${h.host}" from known hosts?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await KnownHosts.remove(h.host);
            await reload();
          },
        },
      ]);
    },
    [reload],
  );

  return (
    <View style={styles.section}>
      <Text
        variant="titleSmall"
        style={[styles.sectionTitle, styles.sectionRow, { color: theme.colors.onSurfaceVariant }]}
      >
        KNOWN HOSTS
      </Text>

      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        {hosts.length === 0 ? (
          <List.Item
            title="No hosts verified yet"
            description="Verified fingerprints appear here after first connect"
            style={styles.emptyListItem}
            left={() => (
              <MaterialCommunityIcons
                name="shield-check-outline" size={24} color={theme.colors.onSurfaceVariant} style={styles.listIcon}
              />
            )}
            titleStyle={{ color: theme.colors.onSurfaceVariant }}
            descriptionStyle={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}
          />
        ) : (
          hosts.map((h, i) => (
            <View key={h.host}>
              <List.Item
                title={h.host}
                description={`${h.algorithm}  ·  ${h.fingerprint.slice(0, 32)}…`}
                left={() => (
                  <MaterialCommunityIcons
                    name="shield-check" size={22} color={theme.colors.primary} style={styles.listIcon}
                  />
                )}
                right={() => (
                  <IconButton
                    icon="delete-outline" size={18} iconColor={theme.colors.error}
                    onPress={() => handleRemove(h)} style={{ margin: 0 }}
                  />
                )}
                titleStyle={{ color: theme.colors.onSurface }}
                descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
                descriptionNumberOfLines={1}
              />
              {i < hosts.length - 1 && <Divider />}
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

// ── Theme colour swatch ───────────────────────────────────────────────────────

function ThemeSwatch({
  item,
  isActive,
  onPress,
}: {
  item: TerminalTheme;
  isActive: boolean;
  onPress: () => void;
}) {
  const uiTheme = useTheme();
  // Show a 3-colour mini preview: background, foreground, accent (ANSI blue)
  const swatchBg  = item.background;
  const swatchFg  = item.foreground;
  const swatchAcc = item.ansi[4]; // ANSI blue

  return (
    <TouchableOpacity onPress={onPress} style={styles.swatchBtn} activeOpacity={0.7}>
      <View
        style={[
          styles.swatch,
          { borderColor: isActive ? uiTheme.colors.primary : 'transparent' },
        ]}
      >
        {/* Background layer */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: swatchBg, borderRadius: 8 }]} />
        {/* Three mini colour dots */}
        <View style={styles.swatchDots}>
          <View style={[styles.dot, { backgroundColor: swatchFg }]} />
          <View style={[styles.dot, { backgroundColor: swatchAcc }]} />
          <View style={[styles.dot, { backgroundColor: item.ansi[1] }]} />
        </View>
        {/* Active check */}
        {isActive && (
          <View style={styles.swatchCheck}>
            <MaterialCommunityIcons name="check" size={12} color="#ffffff" />
          </View>
        )}
      </View>
      <Text
        numberOfLines={1}
        style={[styles.swatchLabel, { color: uiTheme.colors.onSurface }]}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );
}

// ── Terminal section ──────────────────────────────────────────────────────────

function TerminalSection() {
  const uiTheme = useTheme();
  const { theme: activeTheme, font: activeFont, fontSize, allFonts, setTheme, setFont, setFontSize } =
    useTerminalPreferences();

  const categories = getCategories();

  // ── Font size slider ────────────────────────────────────────────────────
  const MIN_SIZE = 9;
  const MAX_SIZE = 20;
  const [sliderWidth, setSliderWidth] = useState(0);
  // localSize: non-null while dragging (gives instant visual feedback);
  // null when idle (falls back to committed fontSize from preferences).
  const [localSize, setLocalSize] = useState<number | null>(null);
  const displaySize = localSize ?? fontSize;
  const thumbPct  = (displaySize - MIN_SIZE) / (MAX_SIZE - MIN_SIZE);
  const thumbLeft = sliderWidth > 0 ? thumbPct * (sliderWidth - 20) : 0;

  const pctFromEvent = (e: GestureResponderEvent) =>
    Math.max(0, Math.min(1, e.nativeEvent.locationX / sliderWidth));

  const sliderHandlers = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder:  () => true,
    onResponderGrant: (e: GestureResponderEvent) => {
      setLocalSize(Math.round(MIN_SIZE + pctFromEvent(e) * (MAX_SIZE - MIN_SIZE)));
    },
    onResponderMove: (e: GestureResponderEvent) => {
      setLocalSize(Math.round(MIN_SIZE + pctFromEvent(e) * (MAX_SIZE - MIN_SIZE)));
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      const newSize = Math.round(MIN_SIZE + pctFromEvent(e) * (MAX_SIZE - MIN_SIZE));
      setLocalSize(null);
      setFontSize(newSize); // commit to AsyncStorage
    },
    onResponderTerminate: () => setLocalSize(null),
  };

  const handleSliderLayout = useCallback((e: LayoutChangeEvent) => {
    setSliderWidth(e.nativeEvent.layout.width);
  }, []);

  return (
    <View style={styles.section}>
      <Text variant="titleSmall" style={[styles.sectionTitle, styles.sectionRow, { color: uiTheme.colors.onSurfaceVariant }]}>
        TERMINAL
      </Text>

      <Card style={[styles.card, { backgroundColor: uiTheme.colors.surface }]}>

        {/* ── Font size ─────────────────────────────────────────────────── */}
        <View style={styles.settingRow}>
          <MaterialCommunityIcons name="format-size" size={22} color={uiTheme.colors.onSurfaceVariant} style={styles.listIcon} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text variant="bodyMedium" style={{ color: uiTheme.colors.onSurface }}>Font size</Text>
              <Text variant="bodyMedium" style={{ color: uiTheme.colors.primary, fontWeight: '600' }}>
                {displaySize}pt
              </Text>
            </View>
            {/* Slider track */}
            <View
              style={[styles.sliderTrack, { backgroundColor: uiTheme.colors.surfaceVariant }]}
              onLayout={handleSliderLayout}
              {...sliderHandlers}
            >
              <View
                style={[
                  styles.sliderFill,
                  { backgroundColor: uiTheme.colors.primary, width: thumbLeft + 10 },
                ]}
              />
              <View
                style={[
                  styles.sliderThumb,
                  { backgroundColor: uiTheme.colors.primary, left: thumbLeft },
                ]}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text variant="labelSmall" style={{ color: uiTheme.colors.onSurfaceVariant }}>{MIN_SIZE}</Text>
              <Text variant="labelSmall" style={{ color: uiTheme.colors.onSurfaceVariant }}>{MAX_SIZE}</Text>
            </View>
          </View>
        </View>

        <Divider />

        {/* ── Font picker ───────────────────────────────────────────────── */}
        <View style={styles.fontPickerHeader}>
          <MaterialCommunityIcons name="format-font" size={22} color={uiTheme.colors.onSurfaceVariant} style={styles.listIcon} />
          <Text variant="bodyMedium" style={[styles.fontPickerLabel, { color: uiTheme.colors.onSurface }]}>
            Font
          </Text>
        </View>
        {allFonts.map((f: TerminalFont, i) => {
          const isActive = f.id === activeFont.id;
          return (
            <View key={f.id}>
              <TouchableOpacity
                onPress={() => setFont(f.id)}
                activeOpacity={0.6}
                style={[
                  styles.fontRow,
                  isActive && { backgroundColor: uiTheme.colors.primaryContainer ?? uiTheme.colors.surfaceVariant },
                ]}
              >
                {/* "Aa" sample badge */}
                <View
                  style={[
                    styles.fontBadge,
                    {
                      backgroundColor: isActive ? uiTheme.colors.primary : uiTheme.colors.surfaceVariant,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.fontBadgeText,
                      { color: isActive ? uiTheme.colors.onPrimary : uiTheme.colors.onSurfaceVariant },
                    ]}
                  >
                    Aa
                  </Text>
                </View>

                {/* Name + description */}
                <View style={styles.fontInfo}>
                  <Text
                    variant="bodyMedium"
                    style={{ color: isActive ? uiTheme.colors.primary : uiTheme.colors.onSurface, fontWeight: isActive ? '600' : '400' }}
                  >
                    {f.name}
                  </Text>
                  <View style={styles.fontMeta}>
                    <Text variant="labelSmall" style={{ color: uiTheme.colors.onSurfaceVariant }}>
                      {f.description}
                    </Text>
                  </View>
                </View>

                {/* Active checkmark / ligature badge row */}
                <View style={styles.fontRight}>
                  {f.ligatures && (
                    <View style={[styles.ligaBadge, { borderColor: isActive ? uiTheme.colors.primary : uiTheme.colors.outline }]}>
                      <Text style={[styles.ligaBadgeText, { color: isActive ? uiTheme.colors.primary : uiTheme.colors.onSurfaceVariant }]}>
                        liga
                      </Text>
                    </View>
                  )}
                  {isActive
                    ? <MaterialCommunityIcons name="check-circle" size={20} color={uiTheme.colors.primary} style={{ marginLeft: 8 }} />
                    : <MaterialCommunityIcons name="circle-outline" size={20} color={uiTheme.colors.outline} style={{ marginLeft: 8 }} />
                  }
                </View>
              </TouchableOpacity>
              {i < allFonts.length - 1 && <Divider />}
            </View>
          );
        })}

        <Divider />

        {/* ── Colour theme ─────────────────────────────────────────────── */}
        <View style={[styles.settingRow, { paddingBottom: 0 }]}>
          <MaterialCommunityIcons name="palette-outline" size={22} color={uiTheme.colors.onSurfaceVariant} style={styles.listIcon} />
          <View style={{ flex: 1, marginLeft: 8, marginBottom: 12 }}>
            <Text variant="bodyMedium" style={{ color: uiTheme.colors.onSurface, marginBottom: 4 }}>Colour theme</Text>
            <Text variant="labelSmall" style={{ color: uiTheme.colors.primary }}>{activeTheme.name}</Text>
          </View>
        </View>

        {/* Category rows */}
        {categories.map((cat) => {
          const themesInCat = getThemesByCategory(cat);
          return (
            <View key={cat} style={styles.categorySection}>
              <Text
                variant="labelSmall"
                style={[styles.categoryLabel, { color: uiTheme.colors.onSurfaceVariant }]}
              >
                {cat.toUpperCase()}
              </Text>
              <FlatList
                data={themesInCat}
                keyExtractor={(t) => t.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.swatchRow}
                renderItem={({ item }) => (
                  <ThemeSwatch
                    item={item}
                    isActive={item.id === activeTheme.id}
                    onPress={() => setTheme(item.id)}
                  />
                )}
              />
            </View>
          );
        })}
      </Card>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.header, { borderBottomColor: theme.colors.outline }]}>
        <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
          Settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <SshKeysSection />
        <KnownHostsSection />
        <TerminalSection />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontWeight: '700' },
  scroll: { paddingBottom: 40 },
  section: { paddingTop: 24 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    letterSpacing: 0.8,
    opacity: 0.7,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  listIcon: {
    alignSelf: 'center',
    marginLeft: 4,
    marginRight: 0,
  },
  emptyListItem: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  // ── Terminal section ────────────────────────────────────────────────────
  settingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  // Font size slider
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
    top: -8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  // Font picker
  fontPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 10,
  },
  fontPickerLabel: {
    fontWeight: '500',
  },
  fontRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  fontBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fontBadgeText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  fontInfo: {
    flex: 1,
    gap: 2,
  },
  fontMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fontRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ligaBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  ligaBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  // Theme swatches
  categorySection: {
    paddingBottom: 8,
  },
  categoryLabel: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  swatchRow: {
    paddingHorizontal: 16,
    gap: 10,
  },
  swatchBtn: {
    alignItems: 'center',
    width: 68,
  },
  swatch: {
    width: 60,
    height: 44,
    borderRadius: 8,
    borderWidth: 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 4,
  },
  swatchDots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  swatchCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swatchLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
});
