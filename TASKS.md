# cy-tty Tasks

> Track implementation progress. Check boxes as work is completed.

---

## 🔧 Setup

- [x] Remove `web` output from `app.json`
- [x] Remove `react-native-web` from dependencies
- [x] `bun add react-native-paper @shopify/react-native-skia expo-build-properties`
- [x] `bunx expo prebuild` — generate `ios/` and `android/`

---

## 📡 expo-ssh (SSH Transport)

- [x] Scaffold module: `modules/expo-ssh/` (created manually following template)
- [x] iOS: `ExpoSsh.podspec` with NMSSH dependency
- [x] iOS: `ExpoSshModule.swift` — NMSSHSession + NMSSHChannel + NMSSHChannelDelegate
- [x] Android: `build.gradle` with JSch dependency
- [x] Android: `ExpoSshModule.kt` — JSch SSH2, background read thread
- [x] JS: `src/index.ts` SshClient API + `src/ExpoSshModule.types.ts`
- [x] Autolinked via `expo-ssh: file:./modules/expo-ssh` in package.json
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
- [x] `src/hooks/use-terminal-size.ts` — cols/rows from useWindowDimensions + safe area + toolbar height

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

- [x] `src/hooks/use-ssh-session.ts` — connect → shell channel → pipe bytes → send resize
- [x] `src/components/terminal/terminal-session.tsx` — wire SSH → VT → canvas

---

## 📱 UI Screens

- [x] `src/app/_layout.tsx` — `PaperProvider` + Tokyo Night theme + `SessionManagerProvider`
- [x] `src/app/(tabs)/_layout.tsx` — bottom tab bar: Connect · Sessions · Settings
- [x] `src/app/(tabs)/index.tsx` — Connect tab: app header + network scan section + recent connections + FAB + search icon
- [x] `src/app/(tabs)/sessions.tsx` — Active sessions from SessionManager (status badge, resume, disconnect)
- [x] `src/app/(tabs)/settings.tsx` — SSH Keys + Known Hosts + Terminal sections
- [x] `src/app/terminal/[id].tsx` — fixed keyboard + SafeArea bottom edge + auto-hide header (Minimize ← | label | Disconnect ✕) + Cancel/Retry/Reconnect overlays
- [x] `src/components/terminal/terminal-keyboard.tsx` — Ctrl · Tab · arrows · Esc toolbar (above home indicator)
- [x] `src/components/connection/connection-sheet.tsx` — @gorhom/bottom-sheet form: label/host/port/username/auth-method/key-import
- [x] `src/components/connection/profile-card.tsx` — saved profile card with OS emoji, last-connected, connect/edit/delete
- [x] `src/components/connection/device-card.tsx` — scanned device card with OS emoji, SSH banner, connect
- [x] `src/components/search/global-search-sheet.tsx` — cross-tab search sheet (profiles + sessions + hosts)
- [x] `src/core/profiles/types.ts` + `storage.ts` — SecureStore-backed encrypted profile CRUD
- [x] `src/core/keys/key-store.ts` — AES-encrypted SSH private key storage (expo-file-system + expo-crypto)
- [x] `src/core/keys/known-hosts.ts` — known_hosts verification + SecureStore persistence
- [x] `src/core/sessions/session-manager.tsx` — global live session context; sessions survive navigation
- [x] `src/core/network/scanner.ts` + `use-network-scan.ts` — TCP port-22 subnet scan with SSH banner grab + OS detection
- [x] `modules/expo-ssh` — added `connectWithKey` (NMSSH key auth iOS + JSch key auth Android)
- [x] `src/hooks/use-ssh-session.ts` — key auth support via `privateKeyPem` option

---

## ✨ Polish

- [x] `KeyboardAvoidingView` for on-screen keyboard
- [x] PTY resize on device orientation change — `useTerminalSize` uses `useWindowDimensions` (auto)
- [x] Terminal keyboard visible above home indicator — SafeAreaView `edges` now includes `bottom`
- [x] SSH key authentication (id_rsa + known_hosts management)
- [x] Encrypted credential storage (expo-secure-store + expo-crypto)
- [x] Network scan for SSH devices on app open
- [x] Global search (cross-tab sheet) with profiles, sessions, discovered hosts
- [x] Session persistence — SessionManager keeps SSH alive when minimising
- [x] Go back without closing session (Minimize button in terminal)
- [x] Error state UI (connection failed, disconnected) — `StatusOverlay` in terminal screen
- [x] Loading state during SSH handshake — spinner in `StatusOverlay`
