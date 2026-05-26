/**
 * ConnectionForm
 *
 * Material You form for entering SSH connection details.
 * On submit, navigates to the terminal screen passing credentials as
 * route params (expo-router query string — encoded by the framework).
 *
 * Fields:
 *   • Host      — hostname or IP address
 *   • Port      — defaults to 22
 *   • Username
 *   • Password  — secureTextEntry
 */

import { useState } from 'react';
import { StyleSheet, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { router } from 'expo-router';

// ── Validation ─────────────────────────────────────────────────────────────

function validate(host: string, port: string, username: string, password: string) {
  const errors: Record<string, string> = {};
  if (!host.trim()) errors.host = 'Host is required';
  const portNum = Number(port);
  if (!port.trim() || !Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    errors.port = 'Port must be 1 – 65535';
  }
  if (!username.trim()) errors.username = 'Username is required';
  if (!password) errors.password = 'Password is required';
  return errors;
}

// ── Component ──────────────────────────────────────────────────────────────

export function ConnectionForm() {
  const theme = useTheme();

  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = validate(host, port, username, password);
  const hasErrors = Object.keys(errors).length > 0;

  function markTouched(field: string) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  function showError(field: string) {
    return (touched[field] || submitted) && !!errors[field];
  }

  function handleConnect() {
    setSubmitted(true);
    if (hasErrors) return;

    router.push({
      pathname: '/terminal/[id]',
      params: {
        id: '0',
        host: host.trim(),
        port,
        username: username.trim(),
        password,
      },
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* ── Title ─────────────────────────────────────────────────────── */}
          <Text
            variant="headlineSmall"
            style={[styles.title, { color: theme.colors.onSurface }]}
          >
            New Connection
          </Text>

          {/* ── Host ──────────────────────────────────────────────────────── */}
          <TextInput
            label="Host"
            value={host}
            onChangeText={setHost}
            onBlur={() => markTouched('host')}
            mode="outlined"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="next"
            error={showError('host')}
            style={styles.input}
            left={<TextInput.Icon icon="server" />}
          />
          <HelperText type="error" visible={showError('host')}>
            {errors.host}
          </HelperText>

          {/* ── Port ──────────────────────────────────────────────────────── */}
          <TextInput
            label="Port"
            value={port}
            onChangeText={setPort}
            onBlur={() => markTouched('port')}
            mode="outlined"
            keyboardType="number-pad"
            returnKeyType="next"
            error={showError('port')}
            style={styles.input}
            left={<TextInput.Icon icon="pound" />}
          />
          <HelperText type="error" visible={showError('port')}>
            {errors.port}
          </HelperText>

          {/* ── Username ──────────────────────────────────────────────────── */}
          <TextInput
            label="Username"
            value={username}
            onChangeText={setUsername}
            onBlur={() => markTouched('username')}
            mode="outlined"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            error={showError('username')}
            style={styles.input}
            left={<TextInput.Icon icon="account" />}
          />
          <HelperText type="error" visible={showError('username')}>
            {errors.username}
          </HelperText>

          {/* ── Password ──────────────────────────────────────────────────── */}
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            onBlur={() => markTouched('password')}
            mode="outlined"
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={handleConnect}
            error={showError('password')}
            style={styles.input}
            left={<TextInput.Icon icon="lock" />}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword((v) => !v)}
              />
            }
          />
          <HelperText type="error" visible={showError('password')}>
            {errors.password}
          </HelperText>

          {/* ── Connect button ────────────────────────────────────────────── */}
          <Button
            mode="contained"
            onPress={handleConnect}
            style={styles.button}
            contentStyle={styles.buttonContent}
            icon="connection"
          >
            Connect
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    gap: 2,
  },
  title: {
    marginBottom: 16,
    fontWeight: '700',
  },
  input: {
    // Width set by parent padding
  },
  button: {
    marginTop: 16,
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 6,
  },
});
