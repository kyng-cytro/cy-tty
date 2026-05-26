/**
 * ConnectionSheet — @gorhom/bottom-sheet form for creating / editing an SSH profile.
 *
 * Fields:
 *   Label (optional), Host (required), Port, Username, Auth: Password | SSH Key
 *   Key import: paste PEM text OR pick file via expo-document-picker
 *
 * Usage:
 *   const ref = useRef<BottomSheetModal>(null);
 *   <ConnectionSheet ref={ref} onSave={handleSave} initialHost="192.168.1.1" />
 *   ref.current?.present();
 */

import { forwardRef, useCallback, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {
  Button,
  Chip,
  HelperText,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';

import { KeyStore, type KeyMeta } from '@/core/keys/key-store';
import type { SshProfile, AuthMethod } from '@/core/profiles/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConnectionSheetProps {
  /** Called when the user saves a complete profile. */
  onSave: (profile: SshProfile) => void;
  /** Pre-fill host (e.g. from a tapped device card). */
  initialHost?: string;
  /** Pass an existing profile to edit it. */
  editProfile?: SshProfile;
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate(
  host: string,
  port: string,
  authMethod: AuthMethod,
  password: string,
  selectedKeyId: string | null,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!host.trim()) errors.host = 'Host is required';
  const portNum = Number(port);
  if (!port.trim() || !Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    errors.port = 'Port must be 1–65535';
  }
  if (authMethod === 'key' && !selectedKeyId) {
    errors.key = 'Select or import an SSH key';
  }
  return errors;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ConnectionSheet = forwardRef<BottomSheetModal, ConnectionSheetProps>(
  function ConnectionSheet({ onSave, initialHost = '', editProfile }, ref) {
    const theme = useTheme();

    // ── Form state ────────────────────────────────────────────────────────────
    const [label, setLabel] = useState(editProfile?.label ?? '');
    const [host, setHost] = useState(editProfile?.host ?? initialHost);
    const [port, setPort] = useState(String(editProfile?.port ?? 22));
    const [username, setUsername] = useState(editProfile?.username ?? '');
    const [authMethod, setAuthMethod] = useState<AuthMethod>(editProfile?.authMethod ?? 'password');
    const [password, setPassword] = useState(editProfile?.password ?? '');
    const [showPassword, setShowPassword] = useState(false);

    // ── Key state ─────────────────────────────────────────────────────────────
    const [keys, setKeys] = useState<KeyMeta[]>([]);
    const [selectedKeyId, setSelectedKeyId] = useState<string | null>(
      editProfile?.privateKeyId ?? null,
    );
    const [showPasteArea, setShowPasteArea] = useState(false);
    const [pemText, setPemText] = useState('');
    const [importingKey, setImportingKey] = useState(false);

    const [submitted, setSubmitted] = useState(false);
    const errors = validate(host, port, authMethod, password, selectedKeyId);
    const hasErrors = Object.keys(errors).length > 0;

    // Load keys when auth method switches to 'key'
    const loadKeys = useCallback(async () => {
      const list = await KeyStore.list();
      setKeys(list);
    }, []);

    const handleAuthMethodChange = useCallback(
      (method: AuthMethod) => {
        setAuthMethod(method);
        if (method === 'key') void loadKeys();
      },
      [loadKeys],
    );

    // ── Key import ────────────────────────────────────────────────────────────

    const handlePickFile = useCallback(async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const uri = result.assets[0].uri;
      try {
        const pem = await FileSystem.readAsStringAsync(uri);
        setPemText(pem);
        setShowPasteArea(true);
      } catch {
        Alert.alert('Error', 'Could not read the selected file.');
      }
    }, []);

    const handleImportPem = useCallback(async () => {
      if (!pemText.trim()) return;
      setImportingKey(true);
      try {
        const label_ = `Key ${Date.now()}`;
        const id = await KeyStore.import(pemText.trim(), label_);
        const list = await KeyStore.list();
        setKeys(list);
        setSelectedKeyId(id);
        setShowPasteArea(false);
        setPemText('');
      } catch {
        Alert.alert('Import failed', 'The key could not be imported. Check that it is valid PEM.');
      } finally {
        setImportingKey(false);
      }
    }, [pemText]);

    // ── Save ──────────────────────────────────────────────────────────────────

    const handleSave = useCallback(async () => {
      setSubmitted(true);
      if (hasErrors) return;
      Keyboard.dismiss();

      const profile: SshProfile = {
        id: editProfile?.id ?? Crypto.randomUUID(),
        label: label.trim() || (username ? `${username}@${host.trim()}` : host.trim()),
        host: host.trim(),
        port: Number(port),
        username: username.trim(),
        authMethod,
        ...(authMethod === 'password' ? { password } : { privateKeyId: selectedKeyId! }),
        createdAt: editProfile?.createdAt ?? Date.now(),
        lastConnected: editProfile?.lastConnected,
      };

      onSave(profile);
      (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
    }, [
      hasErrors, label, host, port, username, authMethod,
      password, selectedKeyId, editProfile, onSave, ref,
    ]);

    // ── Backdrop ──────────────────────────────────────────────────────────────

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
      ),
      [],
    );

    const showError = (field: string) => submitted && !!errors[field];

    // ── Render ────────────────────────────────────────────────────────────────

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['75%', '95%']}
        backgroundStyle={{ backgroundColor: theme.colors.surface }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.onSurfaceVariant }}
        backdropComponent={renderBackdrop}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetView style={styles.sheetView}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <Text
            variant="headlineSmall"
            style={[styles.title, { color: theme.colors.onSurface }]}
          >
            {editProfile ? 'Edit Connection' : 'New Connection'}
          </Text>

          {/* Label */}
          <TextInput
            label="Label (optional)"
            value={label}
            onChangeText={setLabel}
            mode="outlined"
            autoCapitalize="words"
            style={styles.input}
            left={<TextInput.Icon icon="tag-outline" />}
          />

          {/* Host */}
          <TextInput
            label="Host"
            value={host}
            onChangeText={setHost}
            mode="outlined"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            error={showError('host')}
            style={styles.input}
            left={<TextInput.Icon icon="server" />}
          />
          <HelperText type="error" visible={showError('host')}>{errors.host}</HelperText>

          {/* Port */}
          <TextInput
            label="Port"
            value={port}
            onChangeText={setPort}
            mode="outlined"
            keyboardType="number-pad"
            error={showError('port')}
            style={styles.input}
            left={<TextInput.Icon icon="pound" />}
          />
          <HelperText type="error" visible={showError('port')}>{errors.port}</HelperText>

          {/* Username */}
          <TextInput
            label="Username (optional)"
            value={username}
            onChangeText={setUsername}
            mode="outlined"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            left={<TextInput.Icon icon="account" />}
          />

          {/* Auth method */}
          <Text
            variant="labelMedium"
            style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}
          >
            Authentication
          </Text>
          <View style={styles.chips}>
            <Chip
              selected={authMethod === 'password'}
              onPress={() => handleAuthMethodChange('password')}
              icon="lock"
              style={styles.chip}
            >
              Password
            </Chip>
            <Chip
              selected={authMethod === 'key'}
              onPress={() => handleAuthMethodChange('key')}
              icon="key"
              style={styles.chip}
            >
              SSH Key
            </Chip>
          </View>

          {/* Password */}
          {authMethod === 'password' && (
            <>
              <TextInput
                label="Password (optional)"
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                secureTextEntry={!showPassword}
                style={styles.input}
                left={<TextInput.Icon icon="lock" />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword((v) => !v)}
                  />
                }
              />
            </>
          )}

          {/* SSH Key */}
          {authMethod === 'key' && (
            <View style={styles.keySection}>
              {keys.length > 0 && (
                <>
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onSurfaceVariant, marginBottom: 6 }}
                  >
                    Saved keys
                  </Text>
                  {keys.map((k) => (
                    <Chip
                      key={k.id}
                      selected={selectedKeyId === k.id}
                      onPress={() => setSelectedKeyId(k.id)}
                      icon="key-variant"
                      style={styles.chip}
                    >
                      {k.label}
                    </Chip>
                  ))}
                </>
              )}

              <View style={styles.importRow}>
                <Button
                  mode="outlined"
                  icon="file-import"
                  onPress={handlePickFile}
                  compact
                  style={styles.importBtn}
                >
                  Pick file
                </Button>
                <Button
                  mode="outlined"
                  icon="text"
                  onPress={() => setShowPasteArea((v) => !v)}
                  compact
                  style={styles.importBtn}
                >
                  Paste PEM
                </Button>
              </View>

              {showPasteArea && (
                <>
                  <TextInput
                    label="Paste PEM private key"
                    value={pemText}
                    onChangeText={setPemText}
                    mode="outlined"
                    multiline
                    numberOfLines={6}
                    style={[styles.input, styles.pemInput]}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Button
                    mode="contained"
                    loading={importingKey}
                    onPress={handleImportPem}
                    disabled={!pemText.trim()}
                    style={styles.importConfirm}
                  >
                    Import key
                  </Button>
                </>
              )}

              <HelperText type="error" visible={showError('key')}>{errors.key}</HelperText>
            </View>
          )}

          {/* Save */}
          <Button
            mode="contained"
            onPress={handleSave}
            style={styles.saveBtn}
            contentStyle={styles.saveBtnContent}
            icon="check"
          >
            {editProfile ? 'Save changes' : 'Save & Connect'}
          </Button>
        </ScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetView: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    paddingBottom: 48,
    gap: 2,
  },
  title: {
    fontWeight: '700',
    marginBottom: 16,
  },
  sectionLabel: {
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    marginBottom: 0,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexShrink: 1,
  },
  keySection: {
    gap: 8,
  },
  importRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  importBtn: {
    flex: 1,
  },
  pemInput: {
    minHeight: 120,
    fontFamily: 'monospace',
  },
  importConfirm: {
    marginTop: 4,
  },
  saveBtn: {
    marginTop: 24,
    borderRadius: 12,
  },
  saveBtnContent: {
    paddingVertical: 6,
  },
});
