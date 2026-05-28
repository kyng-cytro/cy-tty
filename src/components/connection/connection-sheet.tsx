import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  HelperText,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { KeyStore, validatePem, type KeyMeta } from "@/core/keys/key-store";
import type { AuthMethod, SshProfile } from "@/core/profiles/types";

export interface ConnectionSheetProps {
  onSave: (profile: SshProfile) => void;
  initialHost?: string;
  editProfile?: SshProfile;
  onOpenChange?: (open: boolean) => void;
  /** Increment this each time the sheet is opened to guarantee form reset. */
  openVersion?: number;
}

function validate(
  host: string,
  port: string,
  authMethod: AuthMethod,
  selectedKeyId: string | null,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!host.trim()) errors.host = "Host is required";
  const n = Number(port);
  if (!port.trim() || !Number.isInteger(n) || n < 1 || n > 65535) {
    errors.port = "Port must be 1–65535";
  }
  if (authMethod === "key" && !selectedKeyId)
    errors.key = "Select or import an SSH key";
  return errors;
}

export const ConnectionSheet = forwardRef<
  BottomSheetModal,
  ConnectionSheetProps
>(function ConnectionSheet(
  { onSave, initialHost = "", editProfile, onOpenChange, openVersion },
  ref,
) {
  const theme = useTheme();

  const labelRef = useRef(editProfile?.label ?? "");
  const hostRef = useRef(editProfile?.host ?? initialHost);
  const portRef = useRef(String(editProfile?.port ?? 22));
  const usernameRef = useRef(editProfile?.username ?? "");
  const passwordRef = useRef(editProfile?.password ?? "");
  const passphraseRef = useRef(editProfile?.keyPassphrase ?? "");

  const [authMethod, setAuthMethod] = useState<AuthMethod>(
    editProfile?.authMethod ?? "none",
  );
  const [showPassword, setShowPassword] = useState(false);
  const [keys, setKeys] = useState<KeyMeta[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(
    editProfile?.privateKeyId ?? null,
  );
  const [pemText, setPemText] = useState("");
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [importingKey, setImportingKey] = useState(false);
  const [locked, setLocked] = useState(editProfile?.locked ?? false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    labelRef.current = editProfile?.label ?? "";
    hostRef.current = editProfile?.host ?? initialHost;
    portRef.current = String(editProfile?.port ?? 22);
    usernameRef.current = editProfile?.username ?? "";
    passwordRef.current = editProfile?.password ?? "";
    passphraseRef.current = editProfile?.keyPassphrase ?? "";
    setAuthMethod(editProfile?.authMethod ?? "none");
    setSelectedKeyId(editProfile?.privateKeyId ?? null);
    setLocked(editProfile?.locked ?? false);
    setShowPassword(false);
    setShowPasteArea(false);
    setPemText("");
    setFormErrors({});
    setSubmitted(false);
    setResetKey((k) => k + 1);
  }, [editProfile, initialHost, openVersion]);

  const showError = (field: string) => submitted && !!formErrors[field];

  const loadKeys = useCallback(async () => {
    setKeys(await KeyStore.list());
  }, []);

  useEffect(() => {
    if (authMethod === "key") void loadKeys();
  }, [authMethod, loadKeys]);

  const handlePickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["text/plain", "application/x-pem-file", "application/octet-stream"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      let uri = result.assets[0].uri;
      if (!uri.startsWith("file://")) {
        const dest =
          (FileSystem.cacheDirectory ?? "") + `picked_key_${Date.now()}.pem`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        uri = dest;
      }
      const content = await FileSystem.readAsStringAsync(uri);
      const pemErr = validatePem(content);
      if (pemErr) {
        Alert.alert(
          "Not a valid key file",
          `This file doesn't look like a PEM private key.\n\n${pemErr}`,
        );
        return;
      }
      setPemText(content);
      setShowPasteArea(true);
    } catch {
      Alert.alert("Error", "Could not read the selected file.");
    }
  }, []);

  const handleImportPem = useCallback(async () => {
    if (!pemText.trim()) return;
    setImportingKey(true);
    try {
      const id = await KeyStore.import(pemText.trim(), `Key ${Date.now()}`);
      await loadKeys();
      setSelectedKeyId(id);
      setShowPasteArea(false);
      setPemText("");
    } catch {
      Alert.alert(
        "Import failed",
        "The key could not be imported. Check that it is valid PEM.",
      );
    } finally {
      setImportingKey(false);
    }
  }, [pemText, loadKeys]);

  const handleSave = useCallback(async () => {
    const host = hostRef.current.trim();
    const port = portRef.current;
    const username = usernameRef.current.trim();
    const label = labelRef.current.trim();
    const password = passwordRef.current;
    const keyPassphrase = passphraseRef.current;

    const errors = validate(host, port, authMethod, selectedKeyId);
    setFormErrors(errors);
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;

    Keyboard.dismiss();
    onSave({
      id: editProfile?.id ?? Crypto.randomUUID(),
      label: label || (username ? `${username}@${host}` : host),
      host,
      port: Number(port),
      username,
      authMethod,
      ...(authMethod === "password"
        ? { password }
        : authMethod === "key"
          ? {
              privateKeyId: selectedKeyId!,
              ...(keyPassphrase ? { keyPassphrase } : {}),
            }
          : {}),
      locked,
      createdAt: editProfile?.createdAt ?? Date.now(),
      lastConnected: editProfile?.lastConnected,
    });
    (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
  }, [authMethod, selectedKeyId, locked, editProfile, onSave, ref]);

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

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={["75%", "95%"]}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.onSurfaceVariant }}
      backdropComponent={renderBackdrop}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onChange={(index) => onOpenChange?.(index >= 0)}
    >
      <BottomSheetView style={styles.sheetView}>
        <ScrollView
          key={resetKey}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <Text
            variant="headlineSmall"
            style={[styles.title, { color: theme.colors.onSurface }]}
          >
            {editProfile ? "Edit Connection" : "New Connection"}
          </Text>

          <TextInput
            label="Label (optional)"
            defaultValue={labelRef.current}
            onChangeText={(t) => {
              labelRef.current = t;
            }}
            mode="outlined"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            left={<TextInput.Icon icon="tag-outline" />}
          />

          <TextInput
            label="Host"
            defaultValue={hostRef.current}
            onChangeText={(t) => {
              hostRef.current = t;
            }}
            mode="outlined"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            error={showError("host")}
            style={styles.input}
            left={<TextInput.Icon icon="server" />}
          />
          <HelperText type="error" visible={showError("host")}>
            {formErrors.host}
          </HelperText>

          <TextInput
            label="Port"
            defaultValue={portRef.current}
            onChangeText={(t) => {
              portRef.current = t;
            }}
            mode="outlined"
            keyboardType="number-pad"
            error={showError("port")}
            style={styles.input}
            left={<TextInput.Icon icon="pound" />}
          />
          <HelperText type="error" visible={showError("port")}>
            {formErrors.port}
          </HelperText>

          <TextInput
            label="Username (optional)"
            defaultValue={usernameRef.current}
            onChangeText={(t) => {
              usernameRef.current = t;
            }}
            mode="outlined"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            left={<TextInput.Icon icon="account" />}
          />

          <Text
            variant="labelMedium"
            style={[
              styles.sectionLabel,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Authentication
          </Text>
          <SegmentedButtons
            value={authMethod}
            onValueChange={(v) => setAuthMethod(v as AuthMethod)}
            style={styles.segmented}
            buttons={[
              { value: "none", label: "None", icon: "minus-circle-outline" },
              { value: "key", label: "SSH Key", icon: "key" },
              { value: "password", label: "Password", icon: "lock" },
            ]}
          />

          {authMethod === "password" && (
            <TextInput
              label="Password (optional)"
              defaultValue={passwordRef.current}
              onChangeText={(t) => {
                passwordRef.current = t;
              }}
              mode="outlined"
              secureTextEntry={!showPassword}
              style={styles.input}
              left={<TextInput.Icon icon="lock" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? "eye-off" : "eye"}
                  onPress={() => setShowPassword((v) => !v)}
                />
              }
            />
          )}

          {authMethod === "key" && (
            <View style={styles.keySection}>
              {keys.length > 0 && (
                <>
                  <Text
                    variant="labelSmall"
                    style={{
                      color: theme.colors.onSurfaceVariant,
                      marginBottom: 4,
                    }}
                  >
                    Saved keys
                  </Text>
                  {keys.map((k) => {
                    const selected = selectedKeyId === k.id;
                    return (
                      <Pressable
                        key={k.id}
                        onPress={() => setSelectedKeyId(k.id)}
                        style={[
                          styles.keyRow,
                          {
                            backgroundColor: selected
                              ? theme.colors.primaryContainer
                              : theme.colors.surfaceVariant,
                            borderColor: selected
                              ? theme.colors.primary
                              : "transparent",
                          },
                        ]}
                        android_ripple={{ color: theme.colors.primary + "33" }}
                      >
                        <MaterialCommunityIcons
                          name="key-variant"
                          size={18}
                          color={
                            selected
                              ? theme.colors.primary
                              : theme.colors.onSurfaceVariant
                          }
                        />
                        <Text
                          variant="bodyMedium"
                          style={{
                            flex: 1,
                            color: selected
                              ? theme.colors.onPrimaryContainer
                              : theme.colors.onSurfaceVariant,
                          }}
                          numberOfLines={1}
                        >
                          {k.label}
                        </Text>
                        {selected && (
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={18}
                            color={theme.colors.primary}
                          />
                        )}
                      </Pressable>
                    );
                  })}
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

              {showPasteArea && (() => {
                const pemErr = pemText.trim() ? validatePem(pemText) : null;
                return (
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
                      error={!!pemErr}
                    />
                    <HelperText type="error" visible={!!pemErr}>
                      {pemErr ?? ""}
                    </HelperText>
                    <Button
                      mode="contained"
                      loading={importingKey}
                      onPress={handleImportPem}
                      disabled={!pemText.trim() || !!pemErr}
                      style={styles.importConfirm}
                    >
                      Import key
                    </Button>
                  </>
                );
              })()}

              <HelperText type="error" visible={showError("key")}>
                {formErrors.key}
              </HelperText>

              <TextInput
                label="Key passphrase (optional)"
                defaultValue={passphraseRef.current}
                onChangeText={(t) => {
                  passphraseRef.current = t;
                }}
                mode="outlined"
                secureTextEntry
                style={styles.input}
                left={<TextInput.Icon icon="shield-key-outline" />}
              />
            </View>
          )}

          <Pressable
            onPress={() => setLocked((v) => !v)}
            style={[styles.lockRow, { borderColor: theme.colors.outline }]}
          >
            <MaterialCommunityIcons
              name={locked ? "lock" : "lock-open-outline"}
              size={20}
              color={
                locked ? theme.colors.primary : theme.colors.onSurfaceVariant
              }
            />
            <View style={styles.lockText}>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurface }}
              >
                Require device unlock
              </Text>
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {locked
                  ? "Fingerprint or PIN required before connecting"
                  : "Anyone can connect with this profile"}
              </Text>
            </View>
            <Switch
              value={locked}
              onValueChange={setLocked}
              color={theme.colors.primary}
            />
          </Pressable>

          <Button
            mode="contained"
            onPress={handleSave}
            style={styles.saveBtn}
            contentStyle={styles.saveBtnContent}
            icon="check"
          >
            {editProfile ? "Save changes" : "Save & Connect"}
          </Button>
        </ScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  sheetView: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48, gap: 2 },
  title: { fontWeight: "700", marginBottom: 16 },
  sectionLabel: {
    marginTop: 12,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: { marginBottom: 0 },
  segmented: { marginBottom: 8 },
  keySection: { gap: 8 },
  keyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  importRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  importBtn: { flex: 1 },
  pemInput: { minHeight: 120, fontFamily: "monospace" },
  importConfirm: { marginTop: 4 },
  lockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lockText: { flex: 1, gap: 2 },
  saveBtn: { marginTop: 12, borderRadius: 12 },
  saveBtnContent: { paddingVertical: 6 },
});
