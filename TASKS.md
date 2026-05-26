# cy-tty Tasks

> Track implementation progress. Check boxes as work is completed.

---

## 🔧 Setup

- [x] Remove `web` output from `app.json`
- [x] Remove `react-native-web` from dependencies
- [x] `bun add react-native-paper @shopify/react-native-skia expo-build-properties`
- [x] `bun add expo-secure-store expo-crypto expo-file-system expo-network expo-document-picker`
- [x] `bun add @gorhom/bottom-sheet react-native-tcp-socket expo-local-authentication`
- [x] `bunx expo prebuild` — generate `ios/` and `android/`

---

## 📡 expo-ssh (SSH Transport)

- [x] Scaffold module: `modules/expo-ssh/` (created manually following template)
- [x] iOS: `ExpoSsh.podspec` with NMSSH dependency
- [x] iOS: `ExpoSshModule.swift` — NMSSHSession + NMSSHChannel + NMSSHChannelDelegate
- [x] Android: `build.gradle` with `com.github.mwiede:jsch:0.2.19` (OpenSSH key format support)
- [x] Android: `ExpoSshModule.kt` — multi-session via `ConcurrentHashMap<String, SshSessionState>`; all methods/events carry `sessionId`
- [x] JS: `src/index.ts` SshClient API — all methods take `sessionId` as first arg
- [x] JS: `src/ExpoSshModule.types.ts` — `SshDataEvent`, `SshErrorEvent`, `SshCloseEvent` all include `sessionId`
- [x] `connectWithKey(sessionId, host, port, username, privateKeyPem, passphrase)` — JSch Android + NMSSH iOS
- [x] Autolinked via `expo-ssh: file:./modules/expo-ssh` in package.json
- [x] `node_modules/expo-ssh/src/` kept in sync manually after module source changes
- [ ] Manual test: connect → get shell prompt → receive data (requires native build)

---

## 🖥️ expo-ghostty-vt (VT Parser)

- [x] Scaffold module: `modules/expo-ghostty-vt/` (pure TypeScript — no native yet)
- [x] `src/types.ts` — TerminalCell, TerminalCursor, TerminalState, TerminalDelta, CellColor variants
- [x] `src/parser.ts` — Paul Williams DEC-compatible VT state machine (Ground/Escape/CSI/OSC/SosPmApc)
- [x] `src/terminal.ts` — Terminal grid: print, C0 control, CSI (cursor/erase/SGR/modes/scroll), alternate screen
- [x] `src/index.ts` — GhosttyVt public API: createTerminal / processBytes / resize / destroy / onTerminalDelta
- [x] Autolinked via `expo-ghostty-vt: file:./modules/expo-ghostty-vt` in package.json
- [x] Full TypeScript type-check passes (tsc --noEmit)
- [ ] iOS native: libghostty-spm XCFramework — deferred (API not yet stable, spm not public)
- [ ] Android native: Zig → NDK cross-compile — deferred (same reason)
- [ ] Manual test: SSH session → ANSI output renders correctly (requires full pipeline)

---

## 🧠 Terminal Core (JS)

- [x] `src/core/terminal/types.ts` — re-exports TerminalCell/State/Cursor/Delta from expo-ghostty-vt
- [x] `src/core/terminal/grid.ts` — createEmptyState/Grid/Cell, applyDelta, ANSI_256 palette, resolveColor/resolveCellColors
- [x] `src/hooks/use-terminal.ts` — GhosttyVt lifecycle, delta→state, dirtyRowsRef, processBytes
- [x] `src/hooks/use-terminal-size.ts` — cols/rows from useWindowDimensions + safe area + toolbar height (no `insets.bottom` subtraction — SafeAreaView handles it)

---

## 🎨 Terminal Rendering

- [x] Bundle JetBrains Mono Regular + Bold in `assets/fonts/`
- [x] `src/core/terminal/colors.ts` — argbToHex, DEFAULT_FG/BG_RGB/HEX
- [x] `src/components/terminal/terminal-row.tsx` — memo'd row: bg Rects + Glyphs batched by fg colour
- [x] `src/components/terminal/terminal-canvas.tsx` — Canvas: bg fill, grid rows, cursor overlay
- [x] Cell size measured from font metrics → reported via `onCellSize` callback
- [x] Cursor blink via Reanimated `useSharedValue` + `withRepeat/withSequence`
- [x] Dirty row optimisation: React.memo + applyDelta stable references

---

## 🔗 SSH Session Wiring

- [x] `src/hooks/use-ssh-session.ts` — connect → shell channel → pipe bytes → send resize; filters events by `sessionId`
- [x] `src/components/terminal/terminal-session.tsx` — exports `TerminalSessionContext` + hook only (dead `TerminalSession` component removed)

---

## 🗂️ Core Storage & Auth

- [x] `src/core/profiles/types.ts` — `SshProfile`, `AuthMethod` (`'password' | 'key'`), `locked?: boolean`
- [x] `src/core/profiles/storage.ts` — SecureStore-backed profile CRUD; passwords stored under `cy_tty_pw_<id>`
- [x] `src/core/keys/key-store.ts` — XOR-obfuscated SSH private key files in `documentDirectory/cy-tty-keys/`; key encryption bytes in SecureStore
- [x] `src/core/auth/require-device-auth.ts` — biometric / device-PIN gate; graceful `true` fallback when no hardware/enrollment
- [x] ~~`src/core/keys/known-hosts.ts`~~ — removed (not needed)

---

## 🖧 Session Manager

- [x] `src/core/sessions/session-manager.tsx` — global live session context; `SessionManagerProvider` in `_layout.tsx`
- [x] Sessions keyed by `session_<timestamp>_<n>` string IDs
- [x] `SessionNode` loader pattern: reads `privateKeyPem` from `KeyStore` async before mounting `SessionNodeInner`
- [x] `SessionNodeInner` runs `useSshSession` + `useTerminal` + `useTerminalSize`; never remounts while session is alive
- [x] Multiple concurrent sessions fully independent (no bleed between sessions)
- [x] `create(profile)` → `sessionId`; `destroy(sessionId)` → unmounts node + triggers native disconnect
- [x] `src/hooks/use-profiles.ts` — thin wrapper over `ProfileStorage`

---

## 📡 Network Scanner

- [x] `src/core/network/scanner.ts` — TCP port-22 `/24` subnet scan; 500 ms timeout; batched 32 concurrent; SSH banner grab; OS detection
- [x] `src/hooks/use-network-scan.ts` — starts scan on mount; returns `{ hosts, scanning, progress, rescan }`

---

## 📱 UI Screens

- [x] `src/app/_layout.tsx` — `PaperProvider` + Tokyo Night theme + `SessionManagerProvider`
- [x] `src/app/(tabs)/_layout.tsx` — bottom tab bar: Connect · Sessions · Settings
- [x] `src/app/(tabs)/index.tsx` — Connect tab: app header + network scan + recent profiles + FAB + search icon; `launchSession` checks `profile.locked` before connecting
- [x] `src/app/(tabs)/sessions.tsx` — active sessions from SessionManager; `#id` suffix (last 4 chars) disambiguates same-host sessions; `handlePress` checks `profile.locked`
- [x] `src/app/(tabs)/settings.tsx` — SSH Keys section (custom `itemRow` layout); Terminal section; font accordion open by default; KnownHosts section removed
- [x] `src/app/terminal/[id].tsx` — SafeAreaView all 4 edges; auto-hide header (Minimize ← | label | Disconnect ✕); Cancel/Retry/Reconnect overlays in `StatusOverlay`
- [x] `src/components/terminal/terminal-keyboard.tsx` — Ctrl · Tab · arrows · Esc toolbar above home indicator
- [x] `src/components/terminal/terminal-session.tsx` — context + hook only (no dead TerminalSession component)
- [x] `src/components/connection/connection-sheet.tsx` — bottom-sheet form; edit prefill via `resetKey` + `useEffect`; file import via `expo-file-system/legacy` + `content://` `copyAsync`; lock toggle (Switch + biometric explanation)
- [x] `src/components/connection/card-styles.ts` — shared `emojiWrap` / `emoji` / `info` styles (used by profile-card + device-card)
- [x] `src/components/connection/profile-card.tsx` — OS emoji; last-connected; auth method icon (🔑); lock icon for locked profiles
- [x] `src/components/connection/device-card.tsx` — scanned device card with OS emoji, SSH banner, connect
- [x] `src/components/common/swipeable-row.tsx` — reusable swipe-to-action row with optional confirm dialog
- [x] `src/components/search/global-search-sheet.tsx` — cross-tab search sheet (profiles + sessions + hosts)

---

## ✨ Polish & Bug Fixes

- [x] `KeyboardAvoidingView` for on-screen keyboard
- [x] PTY resize on device orientation change — `useTerminalSize` uses `useWindowDimensions`
- [x] Terminal keyboard visible above home indicator — SafeAreaView `edges` includes `bottom`
- [x] SSH key authentication (RSA, Ed25519, ECDSA, OpenSSH format via mwiede/jsch fork)
- [x] Encrypted credential storage (expo-secure-store + XOR-obfuscated key files)
- [x] Network scan for SSH devices on app open
- [x] Global search (cross-tab sheet) with profiles, sessions, discovered hosts
- [x] Session persistence — SessionManager keeps SSH alive when minimising
- [x] Minimize without disconnecting (← button in terminal header)
- [x] Error state UI (connection failed, disconnected) with Retry / Reconnect in `StatusOverlay`
- [x] Loading state during SSH handshake — spinner in `StatusOverlay`
- [x] Multi-session: multiple concurrent SSH sessions, each fully independent
- [x] Session ID disambiguation — `#xxxx` suffix on Sessions tab when same host opened multiple times
- [x] Lock connection — `locked` flag on `SshProfile`; biometric/PIN gate via `requireDeviceAuth` before `SessionManager.create()`
- [x] Visual lock/key indicators on `ProfileCard` (🔑 for key auth, 🔒 for locked profiles)
- [x] Cancel button inside `StatusOverlay` during connecting state (not a separate always-visible button)
- [x] No crash when swiping sessions away quickly (`setStatus` removed from `disconnect` callback)
- [x] Backspace works on all keyboards including Gboard (`deleteSurroundingTextInCodePoints` override in Kotlin)
- [x] Settings delete buttons flush to right edge (custom `itemRow` layout, no `List.Item` internal padding)
- [x] Edit connection prefills all fields correctly (`resetKey` + `useEffect` watching `editProfile`)

---

## 📚 Documentation

- [x] `README.md` — title, unstable disclaimer, features, tech stack, getting started, project structure, contributing, license
- [x] `AGENTS.md` — package manager, Expo version, native modules, node_modules sync, architecture, key files, code style, verification
- [x] `PLAN.md` — data flow, session lifecycle, native module details, storage table, UI screens, file map, future work
- [x] `TASKS.md` — this file

---

## 🔮 Future Work

- [ ] iOS expo-ssh testing and polish (NMSSH key auth)
- [ ] libghostty native swap-in — blocked on stable C API + XCFramework/NDK build pipeline
- [ ] Wide character (CJK) support in VT parser
- [ ] SFTP file browser
- [ ] Mosh support
- [ ] iCloud / backup-safe profile sync
- [ ] Screenshots for README
