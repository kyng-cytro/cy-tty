# cy-tty — Architecture Reference

> Mobile SSH terminal for Android (and eventually iOS).  
> Stack: Expo 56 prebuild · expo-ssh (JSch/NMSSH) · expo-ghostty-vt (VT parser) · react-native-skia · react-native-paper

---

## Data flow

```
[SSH Server]
     │  TCP/SSH stream
     ▼
[expo-ssh]                 Android: JSch (mwiede fork)
     │                     iOS: NMSSH
     │  onData(sessionId, bytes)  ← ISO-8859-1 string, binary-safe
     ▼
[useSshSession]            filters events by sessionId
     │  processBytes(data)
     ▼
[expo-ghostty-vt]          pure TypeScript VT state machine today
     │                     → native libghostty swap-in when C API stabilises
     │  TerminalDelta (dirty rows + cursor)
     ▼
[useTerminal]              applies delta → TerminalState
     │  TerminalState
     ▼
[TerminalCanvas]           @shopify/react-native-skia
     │                     Rect fills (bg) + Glyphs (text), dirty-row diffing
     ▼
[react-native-paper UI]    Material Design 3
```

---

## Session lifecycle

```
User taps Connect
  └─► SessionManager.create(profile)  →  sessionId
        └─► SessionNode mounts (hidden, permanent until destroy)
              ├─► SessionLoader: reads privateKeyPem from KeyStore if authMethod === 'key'
              └─► SessionNodeInner: useSshSession + useTerminal + useTerminalSize
  └─► router.push('/terminal/[id]', { id: sessionId })

User taps ← Minimize
  └─► router.back()  —  session stays alive in SessionManager

User taps ✕ Disconnect
  └─► SessionManager.destroy(sessionId)
        └─► SessionNode unmounts  →  useSshSession cleanup calls SshClient.disconnect(sessionId)

Sessions tab: lists sessions with status !== 'connecting' | 'idle'
  Tap  →  router.push('/terminal/[id]', { id })
  Swipe left  →  destroy(sessionId)
```

---

## Native modules

### `modules/expo-ssh/`

| Platform | Library | Notes |
|----------|---------|-------|
| Android | `com.github.mwiede:jsch:0.2.19` | Supports OpenSSH key format (ed25519, ECDSA, RSA new-format) |
| iOS | NMSSH (CocoaPod) | libssh2 wrapper |

**JS API** (all calls take `sessionId` as first arg):
```ts
SshClient.connect(sessionId, { host, port, username, password })
SshClient.connectWithKey(sessionId, host, port, username, privateKeyPem, passphrase)
SshClient.disconnect(sessionId)
SshClient.write(sessionId, data)
SshClient.resize(sessionId, cols, rows)
SshClient.onData(({ sessionId, data }) => …)
SshClient.onError(({ sessionId, message }) => …)
SshClient.onClose(({ sessionId }) => …)
SshClient.onAuthChallenge(({ sessionId, url }) => …)
```

Android stores active sessions in a `ConcurrentHashMap<String, SshSessionState>`. Each session has its own JSch session, channel, and read thread. Events are tagged with `sessionId` so the JS side routes data correctly.

**Background keepalive (Android):** when a shell opens, `ExpoSshModule` starts `SshForegroundService` (persistent notification, `foregroundServiceType=dataSync`) and acquires a `PowerManager.PARTIAL_WAKE_LOCK` + `WifiManager.WifiLock(WIFI_MODE_FULL_HIGH_PERF)` per session. JSch SSH-level keepalives run every 15 s (`setServerAliveInterval`). All locks and the service are released when every session is closed.

### `modules/expo-ghostty-vt/`

Pure TypeScript implementation with an API shaped to match the planned native module:

```ts
GhosttyVt.createTerminal(cols, rows)  → TerminalHandle
GhosttyVt.processBytes(handle, data)  → void  (fires onTerminalDelta)
GhosttyVt.resize(handle, cols, rows)  → void
GhosttyVt.destroy(handle)             → void
GhosttyVt.onTerminalDelta(handle, cb) → Unsubscribe
```

When libghostty's public C API stabilises and the XCFramework / Android NDK build pipeline is ready, only `src/index.ts` needs to change — all callers stay the same.

**VT coverage:** Ground/Escape/CSI/OSC/SosPmApc states, C0 controls, SGR (8/256/RGB colours, bold/dim/italic/underline/blink/inverse), cursor movement & save/restore, scroll regions, alternate screen (1047/1049), DECSTBM, insert/delete lines & chars, UTF-8 multi-byte reassembly, OSC 0/2 (window title).

---

## Storage

| What | Where | How |
|------|-------|-----|
| SSH profiles (minus password) | `expo-secure-store` key `CY_TTY_PROFILES` | JSON array |
| Profile passwords | `expo-secure-store` key `cy_tty_pw_<id>` | Plain string, OS-encrypted |
| SSH private keys (ciphertext) | `documentDirectory/cy-tty-keys/<id>.enc` | XOR-obfuscated with per-key random bytes |
| Key encryption bytes | `expo-secure-store` key `cy_tty_keyenc_<id>` | 32 random bytes as hex |
| Key metadata | `expo-secure-store` key `CY_TTY_KEY_META` | JSON array of `{ id, label, createdAt }` |
| URL auth settings | `AsyncStorage` key `cy_tty_ssh_url_open` | JSON `{ autoOpen: boolean }` |

---

## UI screens

| Route | Screen | Notes |
|-------|--------|-------|
| `/(tabs)/` | Connect | Network scan · recent profiles · FAB · search |
| `/(tabs)/sessions` | Sessions | Live sessions from SessionManager; `#id` suffix to disambiguate duplicates |
| `/(tabs)/settings` | Settings | SSH keys · terminal font/size/theme · security (auto-open URL auth toggle) |
| `/terminal/[id]` | Terminal | Skia canvas · floating auto-hide header · scroll (swipe up/down) · keyboard toolbar (Ctrl/shift/alt + arrow keys + haptics) |

---

## File map

```
src/
├── app/
│   ├── _layout.tsx               SshUrlSettingsProvider + SessionManagerProvider + PaperProvider
│   ├── (tabs)/
│   │   ├── index.tsx             Connect tab
│   │   ├── sessions.tsx          Active sessions
│   │   └── settings.tsx          SSH keys + terminal prefs
│   └── terminal/[id].tsx         Full-screen terminal
├── components/
│   ├── common/swipeable-row.tsx  Reusable swipe-to-action row
│   ├── connection/
│   │   ├── card-styles.ts        Shared emojiWrap/emoji/info styles
│   │   ├── connection-sheet.tsx  New/edit connection bottom sheet
│   │   ├── device-card.tsx       Scanned host card
│   │   └── profile-card.tsx      Saved profile card
│   ├── search/global-search-sheet.tsx
│   └── terminal/
│       ├── terminal-canvas.tsx   Skia renderer
│       ├── terminal-keyboard.tsx Ctrl/Alt/arrow toolbar
│       └── terminal-session.tsx  TerminalSessionContext + hook
├── core/
│   ├── auth/require-device-auth.ts          expo-local-authentication gate
│   ├── keys/key-store.ts                    Encrypted SSH key CRUD
│   ├── network/scanner.ts                   TCP port-22 subnet scan
│   ├── profiles/
│   │   ├── storage.ts                       SecureStore profile CRUD
│   │   └── types.ts                         SshProfile · AuthMethod
│   ├── security/
│   │   ├── ssh-url-settings.ts              AsyncStorage CRUD for URL auth settings
│   │   └── ssh-url-settings-context.tsx     SshUrlSettingsProvider + useSshUrlSettings hook
│   ├── sessions/session-manager.tsx         Global session context
│   └── theme/                               Colour themes · fonts · preferences
├── hooks/
│   ├── use-network-scan.ts
│   ├── use-profiles.ts
│   ├── use-ssh-session.ts
│   ├── use-terminal.ts
│   └── use-terminal-size.ts
└── utils/
    └── haptics.ts                       tapHaptic() — shared light impact feedback
```

---

## Known bugs

- **`connection-sheet.tsx` not resetting** — form fields (host, username, password, etc.) retain stale values after the sheet is dismissed or a profile is saved. The fix is to call the form reset inside the sheet's `onDismiss` handler (and after a successful save), clearing all controlled state back to defaults.

---

## Onboarding screen

A one-time paginated intro shown to new users before they reach the main tabs.

- **Route:** `src/app/onboarding.tsx` (or a `(onboarding)/` group)
- **Structure:** step screens with an image/illustration + headline + short body copy; swipeable (paging `FlatList` or `react-native-reanimated` carousel)
- **Steps (draft):** Connect to any SSH server · Multiple live sessions · Secure encrypted storage · Browser-based auth (Tailscale etc.)
- **CTA:** "Get Started" on the final step → set `hasOnboarded: true` in `AsyncStorage` → `router.replace('/(tabs)')`
- **Gate:** `_layout.tsx` checks `hasOnboarded` on mount; redirects unauthenticated users to `/onboarding` before tabs render

---

## Future work

- iOS native expo-ssh testing and polish
- libghostty native swap-in (blocked on stable C API + build pipeline)
- Wide character (CJK) support in VT parser
- SFTP file browser
- Mosh support
- iCloud / backup-safe profile sync
