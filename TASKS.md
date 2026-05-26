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

- [ ] `src/core/terminal/types.ts` — `TerminalCell`, `TerminalState`, `TerminalCursor`
- [ ] `src/core/terminal/grid.ts` — grid utilities (create, apply delta, diff)
- [ ] `src/hooks/use-terminal.ts` — apply VT deltas to React state
- [ ] `src/hooks/use-terminal-size.ts` — cols/rows from screen + font metrics

---

## 🎨 Terminal Rendering

- [ ] Bundle JetBrains Mono (or Fira Code) in `assets/fonts/`
- [ ] `TerminalCanvas`: load font via `useFonts`, measure cell size
- [ ] `TerminalCanvas`: background pass — batch `Rect` fills by color
- [ ] `TerminalCanvas`: glyph pass — `Glyphs` API per row
- [ ] `TerminalCanvas`: cursor overlay — blinking via `useSharedValue`
- [ ] `TerminalCanvas`: dirty row tracking — only repaint changed rows

---

## 🔗 SSH Session Wiring

- [ ] `src/hooks/use-ssh-session.ts` — connect → shell channel → pipe bytes → send resize
- [ ] `src/components/terminal/terminal-session.tsx` — wire SSH → VT → canvas

---

## 📱 UI Screens

- [ ] `src/app/_layout.tsx` — `PaperProvider` + dynamic Material You theme
- [ ] `src/components/connection/connection-form.tsx` — Paper `TextInput` + `Button`
- [ ] `src/app/index.tsx` — connection form screen
- [ ] `src/app/terminal/[id].tsx` — full-screen canvas + toolbar
- [ ] `src/components/terminal/terminal-keyboard.tsx` — Ctrl · Tab · arrows · Esc toolbar

---

## ✨ Polish

- [ ] `KeyboardAvoidingView` for on-screen keyboard
- [ ] PTY resize on device orientation change
- [ ] Error state UI (connection failed, disconnected)
- [ ] Loading state during SSH handshake
