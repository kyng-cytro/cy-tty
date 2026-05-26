import { forwardRef, useCallback, useRef, useState } from "react";
import { Alert, Keyboard, ScrollView, StyleSheet, View } from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import {
  Button,
  Chip,
  HelperText,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Crypto from "expo-crypto";

import { KeyStore, type KeyMeta } from "@/core/keys/key-store";
import type { SshProfile, AuthMethod } from "@/core/profiles/types";

export interface ConnectionSheetProps {
  onSave: (profile: SshProfile) => void;
  initialHost?: string;
  editProfile?: SshProfile;
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
  if (authMethod === "key" && !selectedKeyId) {
    errors.key = "Select or import an SSH key";
  }
  return errors;
}

export const ConnectionSheet = forwardRef<
  BottomSheetModal,
  ConnectionSheetProps
>(function ConnectionSheet({ onSave, initialHost = "", editProfile }, ref) {
  const theme = useTheme();

  const labelRef = useRef(editProfile?.label ?? "");
  const hostRef = useRef(editProfile?.host ?? initialHost);
  const portRef = useRef(String(editProfile?.port ?? 22));
  const usernameRef = useRef(editProfile?.username ?? "");
  const passwordRef = useRef(editProfile?.password ?? "");

  const [authMethod, setAuthMethod] = useState<AuthMethod>(
    editProfile?.authMethod ?? "password",
  );
  const [showPassword, setShowPassword] = useState(false);
  const [keys, setKeys] = useState<KeyMeta[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(
    editProfile?.privateKeyId ?? null,
  );
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pemText, setPemText] = useState("");
  const [importingKey, setImportingKey] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const showError = (field: string) => submitted && !!formErrors[field];

  const loadKeys = useCallback(async () => {
    setKeys(await KeyStore.list());
  }, []);

  const handleAuthMethodChange = useCallback(
    (method: AuthMethod) => {
      setAuthMethod(method);
      if (method === "key") void loadKeys();
    },
    [loadKeys],
  );

  const handlePickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      setPemText(await FileSystem.readAsStringAsync(result.assets[0].uri));
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
      setKeys(await KeyStore.list());
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
  }, [pemText]);

  const handleSave = useCallback(async () => {
    const host = hostRef.current.trim();
    const port = portRef.current;
    const username = usernameRef.current.trim();
    const label = labelRef.current.trim();
    const password = passwordRef.current;

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
        : { privateKeyId: selectedKeyId! }),
      createdAt: editProfile?.createdAt ?? Date.now(),
      lastConnected: editProfile?.lastConnected,
    });
    (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
  }, [authMethod, selectedKeyId, editProfile, onSave, ref]);

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
          <View style={styles.chips}>
            <Chip
              selected={authMethod === "password"}
              onPress={() => handleAuthMethodChange("password")}
              icon="lock"
              style={styles.chip}
            >
              Password
            </Chip>
            <Chip
              selected={authMethod === "key"}
              onPress={() => handleAuthMethodChange("key")}
              icon="key"
              style={styles.chip}
            >
              SSH Key
            </Chip>
          </View>

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
                      marginBottom: 6,
                    }}
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

              <HelperText type="error" visible={showError("key")}>
                {formErrors.key}
              </HelperText>
            </View>
          )}

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
  chips: { flexDirection: "row", gap: 8, marginBottom: 8 },
  chip: { flexShrink: 1 },
  keySection: { gap: 8 },
  importRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  importBtn: { flex: 1 },
  pemInput: { minHeight: 120, fontFamily: "monospace" },
  importConfirm: { marginTop: 4 },
  saveBtn: { marginTop: 24, borderRadius: 12 },
  saveBtnContent: { paddingVertical: 6 },
});
