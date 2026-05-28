# Agent Instructions — cy-tty

## Package manager

Always use **`bun`** / **`bunx`**. Never `npm` / `npx`.

## Expo version

This project targets **Expo SDK 56**. Before writing any code that touches Expo APIs, read the exact versioned docs at:

```
https://docs.expo.dev/versions/v56.0.0/
```

## Native modules

Two custom native modules live in `modules/`:

| Module | Purpose |
|--------|---------|
| `expo-ssh` | SSH transport — JSch (Android), NMSSH (iOS) |
| `expo-ghostty-vt` | VT/ANSI parser — pure TypeScript today, shaped for libghostty native swap later |

Both are autolinked via `package.json` workspace entries. After editing native code, run `bunx expo run:android` (or `ios`) for a full rebuild — Metro alone is not enough.

`expo-ssh` on Android acquires a `PowerManager.PARTIAL_WAKE_LOCK` and a `WifiManager.WifiLock(WIFI_MODE_FULL_HIGH_PERF)` for every active session and starts a `SshForegroundService` (visible notification, `dataSync` type) to prevent Android from throttling the process when backgrounded. All three are released when the session closes.

When updating `modules/expo-ssh/src/`, also sync the changed files to `node_modules/expo-ssh/src/` so TypeScript picks up the new types without a full reinstall:

```bash
cp modules/expo-ssh/src/ExpoSshModule.types.ts node_modules/expo-ssh/src/
cp modules/expo-ssh/src/index.ts node_modules/expo-ssh/src/
```

## Architecture

```
SSH bytes
  └─► expo-ssh (native)
        └─► useSshSession (hook)
              └─► SessionManager (React context — survives navigation)
                    └─► SessionNode (per-session component)
                          ├─► expo-ghostty-vt  →  TerminalDelta
                          └─► useTerminal      →  TerminalState
                                                     └─► TerminalCanvas (Skia)
```

Sessions are keyed by a string `sessionId` (`session_<timestamp>_<n>`). All native calls (`connect`, `write`, `resize`, `disconnect`) and all events (`onData`, `onError`, `onClose`, `onAuthChallenge`) carry this ID so multiple concurrent sessions never bleed into each other.

`onAuthChallenge` fires when the SSH server's keyboard-interactive handler returns a URL (e.g. Tailscale auth). `SessionNode` either opens it automatically (if `autoOpen` is enabled in `SshUrlSettings`) or surfaces it as `pendingAuthUrl` on the `LiveSession` so the terminal screen can prompt the user with Approve / Deny buttons.

## Key files

| File | What it does |
|------|-------------|
| `src/core/sessions/session-manager.tsx` | Global SSH + VT state; sessions survive tab navigation |
| `src/core/profiles/storage.ts` | SecureStore-backed profile CRUD; passwords stored separately under `cy_tty_pw_<id>` |
| `src/core/keys/key-store.ts` | AES-obfuscated private key files in `documentDirectory/cy-tty-keys/` |
| `src/core/auth/require-device-auth.ts` | Biometric / device-PIN gate for locked profiles |
| `src/core/security/ssh-url-settings.ts` | AsyncStorage-backed settings for URL auth (`autoOpen`); key `cy_tty_ssh_url_open` |
| `src/core/security/ssh-url-settings-context.tsx` | React context + provider for `SshUrlOpenSettings`; wrap at root via `<SshUrlSettingsProvider>` |
| `src/core/network/scanner.ts` | TCP port-22 subnet scan with SSH banner grab |
| `src/hooks/use-ssh-session.ts` | SSH lifecycle hook — connects on mount, filters events by sessionId |
| `src/hooks/use-terminal.ts` | GhosttyVt lifecycle; returns `state` + `processBytes` |
| `src/utils/haptics.ts` | Shared `tapHaptic()` — single call site for light impact feedback |
| `modules/expo-ghostty-vt/src/parser.ts` | Paul Williams DEC-compatible VT state machine |
| `modules/expo-ghostty-vt/src/terminal.ts` | Grid, cursor, SGR, alternate screen, dirty tracking |
| `modules/expo-ssh/android/src/main/java/expo/modules/ssh/SshForegroundService.kt` | Android foreground service that keeps sessions alive in background |

## Code style

- TypeScript strict mode — no `any`, no suppressed errors except where noted
- React hooks rules — no conditional hooks, no hooks after early returns
- `useCallback` / `useMemo` deps must be complete — don't silence exhaustive-deps without a comment explaining why
- No `console.log` / `Log.d` in committed code
- No inline comments except for non-obvious "why" explanations (not "what")
- Shared styles between components go in a shared file (e.g. `card-styles.ts`)

## Verification

After any non-trivial change:

```bash
bunx tsc --noEmit
```

Zero errors required before considering work done.
