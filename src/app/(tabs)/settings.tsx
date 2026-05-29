import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DevSettings,
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
  Dialog,
  Divider,
  IconButton,
  Portal,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useSshUrlSettings } from '@/core/security/ssh-url-settings-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Updates from 'expo-updates';
import { exportBackup, importBackup } from '@/core/backup/backup';
import { router } from 'expo-router';

import { KeyStore, validatePem, type KeyMeta } from '@/core/keys/key-store';
import { useTerminalPreferences } from '@/core/theme/preferences-context';
import { getCategories, getThemesByCategory } from '@/core/theme/color-themes';
import type { TerminalTheme } from '@/core/theme/types';
import type { TerminalFont } from '@/core/theme/fonts';

function SshKeysSection() {
  const theme = useTheme();
  const [keys, setKeys] = useState<KeyMeta[]>([]);

  const reload = useCallback(async () => {
    setKeys(await KeyStore.list());
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const handleImport = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/plain', 'application/x-pem-file', 'application/octet-stream'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      let uri = result.assets[0].uri;
      if (!uri.startsWith("file://")) {
        const dest = (FileSystem.cacheDirectory ?? "") + `picked_key_${Date.now()}.pem`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        uri = dest;
      }
      const pem = await FileSystem.readAsStringAsync(uri);
      const pemErr = validatePem(pem);
      if (pemErr) {
        Alert.alert('Not a valid key file', `This file doesn't look like a PEM private key.\n\n${pemErr}`);
        return;
      }
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
          <View style={styles.itemRow}>
            <MaterialCommunityIcons
              name="key-outline" size={22} color={theme.colors.onSurfaceVariant} style={styles.listIcon}
            />
            <View style={styles.itemText}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>No keys imported</Text>
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}>
                Import an id_rsa or ed25519 key file
              </Text>
            </View>
          </View>
        ) : (
          keys.map((k, i) => (
            <View key={k.id}>
              <View style={styles.itemRow}>
                <MaterialCommunityIcons
                  name="key-variant" size={22} color={theme.colors.secondary} style={styles.listIcon}
                />
                <View style={styles.itemText}>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>{k.label}</Text>
                  <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {`Added ${new Date(k.createdAt).toLocaleDateString()}`}
                  </Text>
                </View>
                <IconButton
                  icon="delete-outline" size={18} iconColor={theme.colors.error}
                  onPress={() => handleDelete(k)} style={styles.itemAction}
                />
              </View>
              {i < keys.length - 1 && <Divider />}
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

function SecuritySection() {
  const theme = useTheme();
  const { settings, setAutoOpen } = useSshUrlSettings();

  return (
    <View style={styles.section}>
      <Text
        variant="titleSmall"
        style={[styles.sectionTitle, styles.sectionRow, { color: theme.colors.onSurfaceVariant }]}
      >
        SECURITY
      </Text>

      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.itemRow}>
          <MaterialCommunityIcons
            name="shield-link-variant-outline"
            size={22}
            color={theme.colors.onSurfaceVariant}
            style={styles.listIcon}
          />
          <View style={styles.itemText}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
              Auto-open authentication links
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}>
              Automatically open browser links for supported auth providers (e.g. Tailscale)
            </Text>
          </View>
          <Switch
            value={settings.autoOpen}
            onValueChange={setAutoOpen}
            color={theme.colors.primary}
          />
        </View>
      </Card>
    </View>
  );
}

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
  const swatchBg  = item.background;
  const swatchFg  = item.foreground;
  const swatchAcc = item.ansi[4];

  return (
    <TouchableOpacity onPress={onPress} style={styles.swatchBtn} activeOpacity={0.7}>
      <View
        style={[
          styles.swatch,
          { borderColor: isActive ? uiTheme.colors.primary : 'transparent' },
        ]}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: swatchBg, borderRadius: 8 }]} />
        <View style={styles.swatchDots}>
          <View style={[styles.dot, { backgroundColor: swatchFg }]} />
          <View style={[styles.dot, { backgroundColor: swatchAcc }]} />
          <View style={[styles.dot, { backgroundColor: item.ansi[1] }]} />
        </View>
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

function TerminalSection() {
  const uiTheme = useTheme();
  const { theme: activeTheme, font: activeFont, fontSize, allFonts, setTheme, setFont, setFontSize } =
    useTerminalPreferences();

  const categories = getCategories();

  const [fontOpen, setFontOpen] = useState(true);
  const [themeOpen, setThemeOpen] = useState(false);

  const MIN_SIZE = 9;
  const MAX_SIZE = 20;
  const [sliderWidth, setSliderWidth] = useState(0);
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
      setFontSize(newSize);
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
        <View style={styles.settingRow}>
          <MaterialCommunityIcons name="format-size" size={22} color={uiTheme.colors.onSurfaceVariant} style={styles.listIcon} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text variant="bodyMedium" style={{ color: uiTheme.colors.onSurface }}>Font size</Text>
              <Text variant="bodyMedium" style={{ color: uiTheme.colors.primary, fontWeight: '600' }}>
                {displaySize}pt
              </Text>
            </View>
            <View
              style={[styles.sliderTrack, { backgroundColor: uiTheme.colors.surfaceVariant }]}
              onLayout={handleSliderLayout}
              {...sliderHandlers}
            >
              <View
                style={[styles.sliderFill, { backgroundColor: uiTheme.colors.primary, width: thumbLeft + 10 }]}
              />
              <View
                style={[styles.sliderThumb, { backgroundColor: uiTheme.colors.primary, left: thumbLeft }]}
              />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text variant="labelSmall" style={{ color: uiTheme.colors.onSurfaceVariant }}>{MIN_SIZE}</Text>
              <Text variant="labelSmall" style={{ color: uiTheme.colors.onSurfaceVariant }}>{MAX_SIZE}</Text>
            </View>
          </View>
        </View>

        <Divider />

        <TouchableOpacity
          onPress={() => setFontOpen((o) => !o)}
          activeOpacity={0.7}
          style={styles.accordionHeader}
        >
          <MaterialCommunityIcons name="format-font" size={22} color={uiTheme.colors.onSurfaceVariant} style={styles.listIcon} />
          <View style={styles.accordionMeta}>
            <Text variant="bodyMedium" style={{ color: uiTheme.colors.onSurface }}>Font</Text>
            <Text variant="labelSmall" style={{ color: uiTheme.colors.primary }}>{activeFont.name}</Text>
          </View>
          <MaterialCommunityIcons
            name={fontOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={uiTheme.colors.onSurfaceVariant}
          />
        </TouchableOpacity>

        {fontOpen && (
          <View>
            <Divider />
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
                    <View
                      style={[
                        styles.fontBadge,
                        { backgroundColor: isActive ? uiTheme.colors.primary : uiTheme.colors.surfaceVariant },
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
          </View>
        )}

        <Divider />

        <TouchableOpacity
          onPress={() => setThemeOpen((o) => !o)}
          activeOpacity={0.7}
          style={styles.accordionHeader}
        >
          <MaterialCommunityIcons name="palette-outline" size={22} color={uiTheme.colors.onSurfaceVariant} style={styles.listIcon} />
          <View style={styles.accordionMeta}>
            <Text variant="bodyMedium" style={{ color: uiTheme.colors.onSurface }}>Colour theme</Text>
            <Text variant="labelSmall" style={{ color: uiTheme.colors.primary }}>{activeTheme.name}</Text>
          </View>
          <MaterialCommunityIcons
            name={themeOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={uiTheme.colors.onSurfaceVariant}
          />
        </TouchableOpacity>

        {themeOpen && (
          <View style={{ paddingBottom: 8 }}>
            <Divider />
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
          </View>
        )}

        <Divider />

        <TouchableOpacity
          onPress={() => router.push('/keyboard-keys')}
          activeOpacity={0.7}
          style={styles.accordionHeader}
        >
          <MaterialCommunityIcons
            name="keyboard-settings-outline"
            size={22}
            color={uiTheme.colors.onSurfaceVariant}
            style={styles.listIcon}
          />
          <View style={styles.accordionMeta}>
            <Text variant="bodyMedium" style={{ color: uiTheme.colors.onSurface }}>
              Keyboard keys
            </Text>
            <Text variant="labelSmall" style={{ color: uiTheme.colors.onSurfaceVariant }}>
              Reorder and toggle keys
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={uiTheme.colors.onSurfaceVariant}
          />
        </TouchableOpacity>
      </Card>
    </View>
  );
}

type PasswordDialogIntent = 'export' | { fileUri: string };

function BackupSection() {
  const theme = useTheme();
  const [exportBusy, setExportBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [dialogIntent, setDialogIntent] = useState<PasswordDialogIntent | null>(null);
  const passwordRef = useRef('');
  const confirmRef = useRef('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [inputResetKey, setInputResetKey] = useState(0);

  const closeDialog = useCallback(() => {
    setDialogIntent(null);
    passwordRef.current = '';
    confirmRef.current = '';
    setShowPassword(false);
    setPasswordError('');
    setInputResetKey((k) => k + 1);
  }, []);

  const handleImport = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/octet-stream', 'public.data', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    Alert.alert(
      'Restore backup',
      'This will replace all your profiles, keys, and settings. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => setDialogIntent({ fileUri: result.assets![0].uri }),
        },
      ],
    );
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!dialogIntent) return;

    const pw = passwordRef.current;
    const conf = confirmRef.current;

    if (dialogIntent === 'export') {
      if (pw.length < 6) {
        setPasswordError('Password must be at least 6 characters.');
        return;
      }
      if (pw !== conf) {
        setPasswordError('Passwords do not match.');
        return;
      }
      closeDialog();
      setExportBusy(true);
      try {
        await exportBackup(pw);
      } catch (e) {
        Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setExportBusy(false);
      }
    } else {
      if (!pw) {
        setPasswordError('Password is required.');
        return;
      }
      const { fileUri } = dialogIntent;
      closeDialog();
      setImportBusy(true);
      try {
        await importBackup(fileUri, pw);
        Alert.alert(
          'Restored',
          'Backup restored successfully.',
          [{ text: 'Restart', onPress: () => { __DEV__ ? DevSettings.reload() : void Updates.reloadAsync(); } }],
        );
      } catch (e) {
        Alert.alert('Restore failed', e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setImportBusy(false);
      }
    }
  }, [dialogIntent, closeDialog]);

  const isExport = dialogIntent === 'export';

  return (
    <View style={styles.section}>
      <Text
        variant="titleSmall"
        style={[styles.sectionTitle, styles.sectionRow, { color: theme.colors.onSurfaceVariant }]}
      >
        BACKUP
      </Text>

      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          onPress={() => setDialogIntent('export')}
          disabled={exportBusy}
          activeOpacity={0.7}
          style={styles.backupRow}
        >
          <MaterialCommunityIcons
            name="export-variant"
            size={22}
            color={theme.colors.onSurfaceVariant}
            style={styles.listIcon}
          />
          <View style={styles.itemText}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Export backup</Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}>
              Save all profiles, keys and settings to an encrypted file
            </Text>
          </View>
          {exportBusy
            ? <ActivityIndicator size={18} color={theme.colors.primary} />
            : <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
          }
        </TouchableOpacity>

        <Divider />

        <TouchableOpacity
          onPress={handleImport}
          disabled={importBusy}
          activeOpacity={0.7}
          style={styles.backupRow}
        >
          <MaterialCommunityIcons
            name="import"
            size={22}
            color={theme.colors.onSurfaceVariant}
            style={styles.listIcon}
          />
          <View style={styles.itemText}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>Import backup</Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, opacity: 0.7 }}>
              Restore from a .cytty backup file — replaces all current data
            </Text>
          </View>
          {importBusy
            ? <ActivityIndicator size={18} color={theme.colors.primary} />
            : <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
          }
        </TouchableOpacity>
      </Card>

      <Portal>
        <Dialog visible={dialogIntent !== null} onDismiss={closeDialog}>
          <Dialog.Title>{isExport ? 'Set backup password' : 'Enter backup password'}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 12, color: theme.colors.onSurfaceVariant }}>
              {isExport
                ? 'This password encrypts your backup. You will need it to restore.'
                : 'Enter the password you set when exporting.'}
            </Text>
            <TextInput
              key={`pw-${inputResetKey}`}
              mode="outlined"
              label="Password"
              defaultValue=""
              onChangeText={(t) => { passwordRef.current = t; setPasswordError(''); }}
              secureTextEntry={!showPassword}
              autoFocus
              error={!!passwordError}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword((v) => !v)}
                />
              }
            />
            {isExport && (
              <TextInput
                key={`cf-${inputResetKey}`}
                mode="outlined"
                label="Confirm password"
                defaultValue=""
                onChangeText={(t) => { confirmRef.current = t; setPasswordError(''); }}
                secureTextEntry={!showPassword}
                error={!!passwordError}
                style={{ marginTop: 8 }}
              />
            )}
            {!!passwordError && (
              <Text variant="labelSmall" style={{ color: theme.colors.error, marginTop: 4 }}>
                {passwordError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeDialog}>Cancel</Button>
            <Button onPress={handleConfirm}>{isExport ? 'Export' : 'Restore'}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

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
        <SecuritySection />
        <TerminalSection />
        <BackupSection />
      </ScrollView>
    </SafeAreaView>
  );
}

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
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 10,
    gap: 10,
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  itemAction: {
    margin: 0,
    marginRight: 0,
  },
  backupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
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
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
  },
  accordionMeta: {
    flex: 1,
    gap: 2,
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
  categorySection: { paddingBottom: 8 },
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
