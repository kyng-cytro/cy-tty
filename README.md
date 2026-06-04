# Cy TTY

A mobile SSH terminal for Android (and eventually iOS) built with Expo. Connect to remote servers, manage multiple live sessions, and work from your phone with a proper terminal experience.

> **Early / unstable** — core functionality works but the app is under active development. Expect rough edges and breaking changes between commits.

---

## Screenshots

---

## Features

- **SSH connections** — password, public-key (RSA, Ed25519, ECDSA, OpenSSH format), and browser-based (Tailscale / keyboard-interactive URL) auth
- **Multi-session** — open multiple SSH sessions simultaneously; each runs independently in the background
- **Terminal emulator** — VT100/VT220/xterm-256color with SGR colours, alternate screen, scroll regions, and UTF-8
- **Skia renderer** — hardware-accelerated canvas; dirty-row diffing so only changed lines repaint
- **Network scan** — auto-discovers SSH hosts on your local `/24` subnet with OS detection from SSH banners
- **Encrypted storage** — profiles and private keys encrypted at rest via the OS keychain and AES
- **SSH key management** — import PEM keys by file picker or paste; stored encrypted in the app's document directory
- **Device lock** — mark connections as locked; biometric / device PIN required before a session opens
- **URL auth** — when the server issues a keyboard-interactive URL challenge (e.g. Tailscale), the app prompts Approve / Deny with an optional auto-open toggle
- **Global search** — search across saved profiles, active sessions, and discovered hosts
- **Terminal customisation** — font choice, font size (pinch-to-zoom), colour theme picker
- **Keyboard toolbar** — Ctrl, Shift, Alt, Tab, Esc, arrow keys above the system keyboard with haptic feedback

---

## Tech Stack

| Layer | Library |
| --- | --- |
| Framework | Expo 56 (prebuild — no Expo Go) |
| SSH transport | `modules/expo-ssh` — JSch (Android) / NMSSH (iOS) |
| VT parser | `modules/expo-ghostty-vt` — custom TypeScript state machine |
| Renderer | `@shopify/react-native-skia` |
| UI | `react-native-paper` (Material Design 3) |
| Navigation | Expo Router (file-based) |
| Storage | `expo-secure-store`, `expo-file-system`, `expo-crypto` |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh)
- Android Studio + Android SDK (for Android builds)
- Xcode 15+ (for iOS builds)

### Install

```bash
git clone https://github.com/kyng-cytro/cy-tty.git
cd cy-tty
bun install
```

### Run

```bash
# Android
bunx expo run:android

# iOS
bunx expo run:ios
```

---

## License

MIT
