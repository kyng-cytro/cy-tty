# Cy TTY

A mobile SSH terminal for Android (and eventually iOS) built with Expo. Connect to remote servers, manage multiple live sessions, and work from your phone with a proper terminal experience.

> ⚠️ **Early / unstable** — core functionality works but the app is under active development. Expect rough edges, missing features, and breaking changes between commits. Not yet production-ready.

---

## Screenshots

---

## Features

- **SSH connections** — password, public-key (RSA, Ed25519, ECDSA, OpenSSH format), and browser-based (Tailscale / keyboard-interactive URL) authentication
- **Multi-session** — open multiple SSH sessions simultaneously; each runs independently in the background
- **Terminal emulator** — VT100/VT220/xterm-256color state machine with SGR colours, alternate screen, scroll regions, and UTF-8
- **Skia renderer** — hardware-accelerated canvas via `@shopify/react-native-skia`; dirty-row diffing so only changed lines repaint
- **Network scan** — auto-discovers SSH hosts on your local `/24` subnet with OS detection from SSH banners
- **Encrypted storage** — profiles and private keys encrypted at rest using the OS keychain (`expo-secure-store`) and AES via `expo-crypto`
- **SSH key management** — import PEM keys by file picker or paste; keys stored encrypted in the app's document directory
- **Device lock** — mark individual connections as locked; biometric / device PIN required before a session opens
- **URL auth** — when the SSH server issues a keyboard-interactive URL challenge (e.g. Tailscale), the app prompts with Approve / Deny; optionally auto-opens in browser via the Security settings toggle
- **Global search** — search across saved profiles, active sessions, and discovered hosts from any tab
- **Terminal customisation** — font choice, font size (pinch-to-zoom), and colour theme picker
- **Keyboard toolbar** — Ctrl, Shift, Alt, Tab, Esc, arrow keys, and Ctrl+C above the system keyboard; haptic feedback on every key

---

## Tech Stack

| Layer         | Library                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Framework     | Expo 56 (prebuild — no Expo Go)                                                                                     |
| SSH transport | `modules/expo-ssh` — JSch (Android) / NMSSH (iOS)                                                                   |
| VT parser     | `modules/expo-ghostty-vt` — custom TypeScript state machine, shaped to swap in libghostty when its C API stabilises |
| Renderer      | `@shopify/react-native-skia`                                                                                        |
| UI            | `react-native-paper` (Material Design 3)                                                                            |
| Gestures      | `react-native-gesture-handler` + `react-native-reanimated`                                                          |
| Navigation    | Expo Router (file-based)                                                                                            |
| Storage       | `expo-secure-store`, `expo-file-system`, `expo-crypto`                                                              |
| Auth          | `expo-local-authentication`                                                                                         |
| Haptics       | `expo-haptics`                                                                                                      |

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Bun](https://bun.sh) (used as package manager — do not use npm/npx)
- Android Studio + Android SDK (for Android builds)
- Xcode 15+ (for iOS builds)

### Install

```bash
git clone https://github.com/kyng-cytro/cy-tty.git
cd cy-tty
bun install
```

### Run on Android

```bash
bunx expo run:android
```

### Run on iOS

```bash
bunx expo run:ios
```

> Expo Go is **not** supported — the app uses custom native modules and requires a full native build.

---

## Project Structure

```
cy-tty/
├── modules/
│   ├── expo-ssh/              # SSH transport native module
│   │   ├── android/           #   JSch (mwiede fork — OpenSSH key support)
│   │   ├── ios/               #   NMSSH
│   │   └── src/               #   TypeScript API + types
│   └── expo-ghostty-vt/       # VT parser (pure TypeScript today, native later)
│       └── src/               #   VTParser · Terminal · GhosttyVt namespace
├── src/
│   ├── app/
│   │   ├── _layout.tsx        # Root: SshUrlSettingsProvider + SessionManagerProvider + PaperProvider
│   │   ├── (tabs)/
│   │   │   ├── index.tsx      # Connect tab — network scan + profiles + FAB
│   │   │   ├── sessions.tsx   # Active sessions list
│   │   │   └── settings.tsx   # SSH keys + terminal preferences + security (URL auth toggle)
│   │   └── terminal/[id].tsx  # Full-screen terminal screen
│   ├── components/
│   │   ├── common/            # SwipeableRow
│   │   ├── connection/        # ConnectionSheet · ProfileCard · DeviceCard
│   │   ├── search/            # GlobalSearchSheet
│   │   └── terminal/          # TerminalCanvas · TerminalKeyboard
│   ├── core/
│   │   ├── auth/              # requireDeviceAuth
│   │   ├── keys/              # KeyStore (encrypted key files)
│   │   ├── network/           # subnet scanner
│   │   ├── profiles/          # SshProfile types + SecureStore CRUD
│   │   ├── security/          # SshUrlSettings (auto-open URL auth) + React context
│   │   ├── sessions/          # SessionManager context
│   │   └── theme/             # colour themes · fonts · preferences
│   ├── hooks/                 # use-ssh-session · use-terminal · use-terminal-size · use-profiles · use-network-scan
│   └── utils/                 # haptics
├── AGENTS.md                  # AI agent instructions
├── PLAN.md                    # Architecture reference
├── TASKS.md                   # Implementation checklist
└── app.json
```

---

## Contributing

Contributions are welcome!

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m "Add new feature"`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

Please open an issue first if you'd like to discuss a major change.

---

## License

MIT
